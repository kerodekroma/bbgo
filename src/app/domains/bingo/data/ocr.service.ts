import { Injectable } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import type { GridCell } from '../domain/grid-cell.vo';
import { createGridCell } from '../domain/grid-cell.vo';
import { getColumnForNumber } from '../domain/bingo-column.type';
import type { BingoColumn } from '../domain/bingo-column.type';
import { createWorker, PSM } from 'tesseract.js';
import type { Worker, LoggerMessage } from 'tesseract.js';

export interface OcrResult {
  cells: GridCell[][];
  confidence: number;
  lowConfidenceCells: Array<{ row: number; col: number; confidence: number }>;
}

/**
 * Percentage of dark pixels in a row or column that qualifies as a grid line.
 * Grid lines span most of the card width/height, numbers only span small regions.
 */
const GRID_LINE_DARK_FRACTION = 0.25;

/**
 * Minimum grid line spacing relative to total size — prevents false positives.
 * Lines closer than 3% of image dimension are merged.
 */
const MIN_LINE_SPACING_FRACTION = 0.03;

/**
 * Maximum ratio between largest and smallest cell dimension.
 * Bingo grids are roughly square; >2.5x means detection is wrong.
 */
const MAX_CELL_ASPECT_DEVIATION = 2.5;

// ── Image preprocessing ──

interface PreprocessedImage {
  blob: Blob;
  imageData: ImageData;
  /** Binary (thresholded) canvas — used for grid detection */
  canvas: HTMLCanvasElement;
  /** Grayscale canvas — used for cell extraction (Tesseract works better with grayscale) */
  grayCanvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Adaptive threshold using integral image (summed-area table).
 * Converts grayscale to binary: each pixel is black (0) if it is
 * darker than the local mean minus `offset`, otherwise white (255).
 *
 * This handles uneven lighting (gloss/reflections) because the
 * threshold adapts to local brightness — a glossy spot on the
 * card won't wash out the numbers.
 */
function adaptiveThreshold(
  imageData: ImageData,
  width: number,
  height: number,
  kernelSize: number,
  offset: number,
): ImageData {
  const data = imageData.data;

  // Convert to grayscale if not already
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114,
    );
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  // Build integral image for O(1) local mean lookup
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    const rowPrev = (y - 1) * (width + 1);
    const rowCurr = y * (width + 1);
    for (let x = 1, pixelBase = (y - 1) * width; x <= width; x++) {
      const pixelIdx = (pixelBase + x - 1) * 4;
      integral[rowCurr + x] =
        data[pixelIdx]! +
        integral[rowCurr + x - 1]! +
        integral[rowPrev + x]! -
        integral[rowPrev + x - 1]!;
    }
  }

  const halfK = Math.floor(kernelSize / 2);
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - halfK);
    const y2 = Math.min(height - 1, y + halfK);
    const rowH = y2 - y1 + 1;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfK);
      const x2 = Math.min(width - 1, x + halfK);
      const area = rowH * (x2 - x1 + 1);

      // Sum from integral image
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)]! -
        integral[y1 * (width + 1) + (x2 + 1)]! -
        integral[(y2 + 1) * (width + 1) + x1]! +
        integral[y1 * (width + 1) + x1]!;

      const mean = sum / area;
      const pixelIdx = (y * width + x) * 4;
      const pixel = data[pixelIdx]!;

      const result = pixel < mean - offset ? 0 : 255;
      output[pixelIdx] = result;
      output[pixelIdx + 1] = result;
      output[pixelIdx + 2] = result;
      output[pixelIdx + 3] = 255;
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Auto-crop the image to remove dark borders around the card.
 *
 * Photos of bingo cards often include dark tabletop/background edges.
 * These dominate projection profiles and confuse grid detection.
 *
 * Scans from each edge inward to find where the image transitions
 * from a uniform dark border to the card content.
 * Returns the crop rectangle in image coordinates.
 */
function autoCrop(
  imageData: ImageData,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  const data = imageData.data;

  // Row dark fraction: scan rows from top
  const rowDark = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let dc = 0;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4]! < 80) dc++;
    rowDark[y] = dc / width;
  }

  // Find top crop: first row where dark fraction drops below 30%
  // after being above 60% (i.e., transition from dark border to card)
  let top = 0;
  for (let y = 0; y < height; y++) {
    if (rowDark[y]! < 0.3) {
      top = Math.max(0, y - 5);
      break;
    }
  }

  // Find bottom crop: scan from bottom
  let bottom = height;
  for (let y = height - 1; y >= 0; y--) {
    if (rowDark[y]! < 0.3) {
      bottom = Math.min(height, y + 5);
      break;
    }
  }

  // Column dark fraction: scan columns from left/right
  const colDark = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let dc = 0;
    for (let y = top; y < bottom; y++) if (data[(y * width + x) * 4]! < 80) dc++;
    colDark[x] = dc / (bottom - top);
  }

  // For columns: find where dark fraction exceeds 2%
  // (inside the card there are numbers; outside is uniform)
  let left = 0;
  for (let x = 0; x < width; x++) {
    if (colDark[x]! > 0.02) {
      left = Math.max(0, x - 5);
      break;
    }
  }
  let right = width;
  for (let x = width - 1; x >= 0; x--) {
    if (colDark[x]! > 0.02) {
      right = Math.min(width, x + 5);
      break;
    }
  }

  // Validate: crop must be at least 40% of original dimensions
  const cropW = right - left;
  const cropH = bottom - top;
  if (cropW < width * 0.3 || cropH < height * 0.3) return null;
  if (cropW < 200 || cropH < 200) return null;

  return { x: left, y: top, w: cropW, h: cropH };
}

/**
 * Load a file into an offscreen canvas, resize, auto-crop, adaptive threshold.
 * Returns the binary blob (for OCR), binary ImageData (for grid detection),
 * and binary canvas (for cell extraction).
 */
function preprocessImage(file: File): Promise<PreprocessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 1200;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const srcW = Math.round(img.width * scale);
      const srcH = Math.round(img.height * scale);

      // Step 1: Draw scaled image to get grayscale for auto-crop
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = srcW;
      tempCanvas.height = srcH;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0, srcW, srcH);
      let grayData = tempCtx.getImageData(0, 0, srcW, srcH);

      // Grayscale
      for (let i = 0; i < grayData.data.length; i += 4) {
        const g = Math.round(
          grayData.data[i]! * 0.299 +
          grayData.data[i + 1]! * 0.587 +
          grayData.data[i + 2]! * 0.114,
        );
        grayData.data[i] = g;
        grayData.data[i + 1] = g;
        grayData.data[i + 2] = g;
      }

      // Step 2: Auto-crop to strip dark borders
      const crop = autoCrop(grayData, srcW, srcH);
      const cx = crop?.x ?? 0;
      const cy = crop?.y ?? 0;
      const cw = crop?.w ?? srcW;
      const ch = crop?.h ?? srcH;
      console.log('OCR DEBUG: autoCrop result:', crop ? `(${crop.x},${crop.y}) ${crop.w}x${crop.h}` : 'null (using full: ' + cx + ',' + cy + ' ' + cw + 'x' + ch + ')');

      // Step 3: Create final canvas with cropped content
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      // Draw only the cropped region from the original image
      ctx.drawImage(img, cx / scale, cy / scale, cw / scale, ch / scale, 0, 0, cw, ch);

      // Step 4: Grayscale + adaptive threshold on cropped image
      grayData = ctx.getImageData(0, 0, cw, ch);
      for (let i = 0; i < grayData.data.length; i += 4) {
        const g = Math.round(
          grayData.data[i]! * 0.299 +
          grayData.data[i + 1]! * 0.587 +
          grayData.data[i + 2]! * 0.114,
        );
        grayData.data[i] = g;
        grayData.data[i + 1] = g;
        grayData.data[i + 2] = g;
      }

      // Save grayscale image data and create a grayscale canvas for OCR
      const grayCanvas = document.createElement('canvas');
      grayCanvas.width = cw;
      grayCanvas.height = ch;
      const grayCtx = grayCanvas.getContext('2d')!;
      grayCtx.putImageData(grayData, 0, 0);

      // Apply mild sharpening to grayscale to make digits stand out
      // (simple 3x3 unsharp mask kernel)
      const grayPixels = grayCtx.getImageData(0, 0, cw, ch);
      const sharpened = new Uint8ClampedArray(grayPixels.data);
      for (let y = 1; y < ch - 1; y++) {
        for (let x = 1; x < cw - 1; x++) {
          const idx = (y * cw + x) * 4;
          const center = grayPixels.data[idx]!;
          // 3x3 kernel: [0,-1,0; -1,5,-1; 0,-1,0] (unsharp mask)
          const sum = 5 * center
            - grayPixels.data[((y-1)*cw + x)*4]!
            - grayPixels.data[((y+1)*cw + x)*4]!
            - grayPixels.data[(y*cw + x-1)*4]!
            - grayPixels.data[(y*cw + x+1)*4]!;
          const v = Math.max(0, Math.min(255, sum));
          sharpened[idx] = v;
          sharpened[idx+1] = v;
          sharpened[idx+2] = v;
        }
      }
      const sharpenedData = new ImageData(sharpened, cw, ch);
      grayCtx.putImageData(sharpenedData, 0, 0);
      // Update grayData reference for subsequent processing
      grayData = sharpenedData;

      // Apply adaptive threshold — kernel proportional to image size
      const kernelSize = Math.max(15, Math.round(Math.min(cw, ch) / 20));
      const offset = 30;
      const binaryData = adaptiveThreshold(grayData, cw, ch, kernelSize, offset);

      // Write binary back to canvas (for grid detection)
      ctx.putImageData(binaryData, 0, 0);

      canvas.toBlob(
        blob => {
          if (blob) {
            resolve({ blob, imageData: binaryData, canvas, grayCanvas, width: cw, height: ch });
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        'image/jpeg',
        0.9,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ── Grid line detection ──

/**
 * Find the 6 horizontal and 6 vertical grid lines of a 5×5 bingo card
 * using row/column projection profiles.
 *
 * Grid detection works because horizontal grid lines span the full card
 * width (many dark pixels in that row) while numbers span only small regions.
 *
 * Returns null when grid detection fails (falls back to whole-image OCR).
 */
function detectGridLines(
  imageData: ImageData,
  width: number,
  height: number,
): { rows: number[]; cols: number[] } | null {
  const data = imageData.data;

  // ── Column projection (vertical lines) ──
  const colProfile = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let darkCount = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      if (data[i]! < 100) darkCount++; // pixel is dark
    }
    colProfile[x] = darkCount / height;
  }
  const cols = extractLines(colProfile, width);

  // ── Row projection (horizontal lines) ──
  const rowProfile = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i]! < 100) darkCount++;
    }
    rowProfile[y] = darkCount / width;
  }
  const rows = extractLines(rowProfile, height);

  // ── Validate ──
  if (!rows || !cols) return null;
  if (rows.length !== 6 || cols.length !== 6) return null;

  if (!validateGridSpacing(rows, height) || !validateGridSpacing(cols, width)) {
    return null;
  }

  return { rows, cols };
}

/**
 * Extract exactly 6 line positions from a projection profile.
 *
 * 1. Find local peaks above GRID_LINE_DARK_FRACTION
 * 2. Cluster consecutive peaks (a grid line is typically 2-5px thick)
 * 3. If >6 clusters, take the 6 strongest
 * 4. If <6 clusters, lower threshold and retry
 * 5. Sort ascending before returning
 */
function extractLines(
  profile: Float64Array,
  imageDim: number,
): number[] | null {
  const minSpacing = Math.max(3, Math.round(imageDim * MIN_LINE_SPACING_FRACTION));
  const maxLines = 6;

  // Try progressively lower thresholds until we find a candidate set
  for (let threshold = GRID_LINE_DARK_FRACTION; threshold >= 0.10; threshold -= 0.05) {
    // Find clusters of consecutive pixels above threshold
    const clusters: Array<{ start: number; end: number; peak: number; strength: number }> = [];
    let inLine = false;
    let start = 0;
    let peakVal = 0;
    let peakPos = 0;

    for (let i = 0; i < profile.length; i++) {
      if (profile[i]! > threshold) {
        if (!inLine) {
          inLine = true;
          start = i;
          peakVal = profile[i]!;
          peakPos = i;
        } else {
          if (profile[i]! > peakVal) {
            peakVal = profile[i]!;
            peakPos = i;
          }
        }
      } else {
        if (inLine) {
          // Ignore very thin clusters (noise)
          const thickness = i - start;
          if (thickness >= 1) {
            clusters.push({ start, end: i - 1, peak: peakPos, strength: peakVal });
          }
          inLine = false;
        }
      }
    }
    if (inLine) {
      clusters.push({ start, end: profile.length - 1, peak: peakPos, strength: peakVal });
    }

    // If too few lines, try a lower threshold
    if (clusters.length < maxLines) continue;

    // Sort by strength descending, take top 6
    clusters.sort((a, b) => b.strength - a.strength);
    const top = clusters.slice(0, maxLines);

    // Sort by position ascending
    top.sort((a, b) => a.peak - b.peak);

    // Merge any that are too close (just in case)
    const merged: number[] = [top[0]!.peak];
    for (let i = 1; i < top.length; i++) {
      const prev = merged[merged.length - 1]!;
      if (top[i]!.peak - prev < minSpacing) {
        // Replace with average
        merged[merged.length - 1] = Math.round((prev + top[i]!.peak) / 2);
      } else {
        merged.push(top[i]!.peak);
      }
    }

    if (merged.length === maxLines) {
      return merged;
    }
  }

  return null;
}

/**
 * Validate that grid lines are roughly evenly spaced.
 * Returns false if the largest gap is >2.5x the smallest gap
 * (indicates a detection error like a missing or extra line).
 */
function validateGridSpacing(lines: number[], imageDim: number): boolean {
  if (lines.length < 2) return false;

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(lines[i]! - lines[i - 1]!);
  }

  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);

  // All gaps must be > 0 and reasonably proportional
  if (minGap <= 0) return false;
  if (maxGap / minGap > MAX_CELL_ASPECT_DEVIATION) return false;

  // Each gap should be a reasonable fraction of the image
  // (for a 6-line grid, gaps should be ~imageDim/5)
  const expectedGap = imageDim / 5;
  for (const g of gaps) {
    if (g < expectedGap * 0.2 || g > expectedGap * 3) return false;
  }

  return true;
}

// ── Content-based grid detection (for borderless cards) ──

/**
 * Detect grid boundaries by finding where numbers sit, not grid lines.
 *
 * For borderless cards without visible grid lines, this computes a
 * horizontal projection profile (dark pixels per row), finds the 5
 * horizontal bands where numbers sit, then within each band finds
 * the 5 vertical bands where column numbers sit.
 *
 * Works because even without borders, the numbers are arranged in a
 * regular 5×5 grid with gaps between them.
 */
function detectGridFromContent(
  imageData: ImageData,
  width: number,
  height: number,
): { rows: number[]; cols: number[] } | null {
  const data = imageData.data;

  // ── Horizontal projection (dark pixels per row) ──
  const rowProfile = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[base + x * 4]! < 50) darkCount++;
    }
    rowProfile[y] = darkCount;
  }

  // Smooth profile with a box filter proportional to image size.
  const rowSmoothRadius = Math.max(5, Math.round(height / 50));
  const smoothedR = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let count = 0;
    for (let dy = -rowSmoothRadius; dy <= rowSmoothRadius; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < height) {
        sum += rowProfile[yy]!;
        count++;
      }
    }
    smoothedR[y] = sum / count;
  }

  // Mask outer margins so minima detection only searches the card body.
  // Use a small margin (5%) to only strip edge artifacts — too much causes
  // the margin area to be treated as a band, distorting row detection.
  const searchMargin = Math.round(height * 0.05);
  for (let y = 0; y < searchMargin; y++) smoothedR[y] = 1;
  for (let y = height - searchMargin; y < height; y++) smoothedR[y] = 1;

  // Find row band boundaries via local minima (gaps between number rows).
  // We search for 5 bands directly (just the 5 number rows).
  // The BINGO header is typically thin and sits above the first number row;
  // it will be absorbed into the first band if it falls above the first valley.
  const rowBands = findPeakBoundaries(smoothedR, 5, height);
  if (!rowBands || rowBands.length !== 6) return null;

  // ── Vertical projection per row band ──
  // We average column gaps across all 5 row bands for stability
  const allColGaps: number[][] = [[], [], [], []]; // 4 gaps between 5 columns
  const rowDebug: string[] = [];

  for (let ri = 0; ri < 5; ri++) {
    const yTop = rowBands[ri]!;
    const yBot = rowBands[ri + 1]!;
    if (yBot - yTop < 5) { rowDebug.push(`row${ri}:skip(thin=${yBot-yTop})`); continue; }

    const colProfile = new Uint32Array(width);
    for (let y = yTop; y < yBot; y++) {
      const base = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (data[base + x * 4]! < 50) colProfile[x] = (colProfile[x] ?? 0) + 1;
      }
    }

    // Smooth col profile — use proportional radius
    const colSmoothRadius = Math.max(5, Math.round(width / 60));
    const smoothedC = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -colSmoothRadius; dx <= colSmoothRadius; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < width) {
          sum += colProfile[xx]!;
          count++;
        }
      }
      smoothedC[x] = sum / count;
    }

    const colBands = findPeakBoundaries(smoothedC, 5, width);
    if (!colBands || colBands.length !== 6) {
      // DEBUG: sample column profile values
      const colSamples = [];
      for (let x = 0; x < width; x += Math.round(width/12)) {
        colSamples.push(`x=${x}:${Math.round(smoothedC[x]!)}`);
      }
      rowDebug.push(`row${ri}(y=${yTop}-${yBot}):col_fail [profile:${colSamples.join(',')}]`);
      continue;
    }
    rowDebug.push(`row${ri}(y=${yTop}-${yBot}):cols=${colBands.join(',')}`);

    // Record the 4 internal gap positions
    for (let ci = 0; ci < 4; ci++) {
      allColGaps[ci]!.push(colBands[ci + 1]!);
    }
  }

  console.log('OCR DEBUG: column detection per-row:', rowDebug.join(' | '));
  console.log('OCR DEBUG: allColGaps:', allColGaps.map((g,i) => `gap${i}:${g.join(',')}`).join(' | '));

  // Average column gaps across rows (if we got enough measurements)
  const avgColGaps: number[] = [];
  for (let gi = 0; gi < allColGaps.length; gi++) {
    const gaps = allColGaps[gi]!;
    if (gaps.length >= 2) {
      avgColGaps.push(Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length));
    }
  }

  let cols: number[] | null = null;

  if (avgColGaps.length === 4) {
    // All 4 gaps were measured — use them
    cols = [0, ...avgColGaps, width];
    console.log('OCR DEBUG: cols from per-row avg:', cols.join(','));
  }

  // Validate detected columns: each column must be a reasonable width.
  // For a 5-column grid, min ~10% and max ~50% of total width.
  if (cols) {
    const colWidths = cols.slice(1).map((c, i) => c - cols![i]!);
    const tooSmall = colWidths.some(w => w < width * 0.06);
    const tooLarge = colWidths.some(w => w > width * 0.45);
    if (tooSmall || tooLarge) {
      console.log('OCR DEBUG: rejecting cols — uneven column widths:', colWidths.join(','));
      cols = null;
    }
  }

  // Fallback: equal-width columns (reliable for standard bingo cards)
  if (!cols) {
    const cellW = Math.round(width / 5);
    cols = [0, cellW, cellW * 2, cellW * 3, cellW * 4, width];
    console.log('OCR DEBUG: cols from equal division:', cols.join(','));
  }

  return { rows: rowBands, cols };
}

/**
 * Find `numPeaks` number of bands in a 1D projection profile.
 *
 * Strategy: find the deepest local minima (valleys) to separate
 * the peaks. Returns numPeaks+1 boundary positions, or null if
 * the profile doesn't have enough structure.
 *
 * The minima detection window is proportional to imageDim so it
 * works at any scale — small windows create noise from intra-row
 * pixel variations.
 */
function findPeakBoundaries(
  profile: Float64Array,
  numPeaks: number,
  imageDim: number,
): number[] | null {
  const expectedGap = imageDim / numPeaks;
  const minSepar = Math.round(expectedGap * 0.3);
  const maxSepar = Math.round(expectedGap * 2.5);

  // Detection radius proportional to image dimension
  // (~1/50th of total height/width ensures we only find
  // meaningful inter-row/inter-column gaps)
  const detectRadius = Math.max(3, Math.round(imageDim / 60));

  // Find all local minima
  const minima: Array<{ pos: number; depth: number }> = [];
  for (let i = detectRadius; i < profile.length - detectRadius; i++) {
    let isMin = true;
    for (let d = 1; d <= detectRadius; d++) {
      if (
        profile[i]! > profile[i - d]! ||
        profile[i]! > profile[i + d]!
      ) {
        isMin = false;
        break;
      }
    }
    if (isMin) {
      // Depth = how much lower this is than the surrounding peaks
      const leftMax = Math.max(...Array.from({ length: detectRadius }, (_, k) => profile[i - 1 - k]!));
      const rightMax = Math.max(...Array.from({ length: detectRadius }, (_, k) => profile[i + 1 + k]!));
      const depth = Math.min(leftMax, rightMax) - profile[i]!;
      if (depth > 0) {
        minima.push({ pos: i, depth });
      }
    }
  }

  if (minima.length < numPeaks - 1) return null;

  // Sort by depth descending, take the (numPeaks-1) deepest
  minima.sort((a, b) => b.depth - a.depth);
  const selected = minima.slice(0, numPeaks - 1);
  selected.sort((a, b) => a.pos - b.pos);

  // Validate spacing
  for (let i = 1; i < selected.length; i++) {
    const gap = selected[i]!.pos - selected[i - 1]!.pos;
    if (gap < minSepar || gap > maxSepar) return null;
  }

  // Boundaries: [0, ...minima positions, imageDim]
  const boundaries: number[] = [0];
  for (const m of selected) boundaries.push(m.pos);
  boundaries.push(imageDim);

  return boundaries;
}

// ── Cell extraction ──

/**
 * Extract a single cell region from the source canvas as a blob,
 * ready for OCR. Adds a small margin to avoid the grid line itself.
 */
function extractCellBlob(
  sourceCanvas: HTMLCanvasElement,
  grid: { rows: number[]; cols: number[] },
  row: number,
  col: number,
): Promise<Blob> {
  const cellW = grid.cols[col + 1]! - grid.cols[col]!;
  const cellH = grid.rows[row + 1]! - grid.rows[row]!;
  const marginX = Math.max(3, Math.round(cellW * 0.15));
  const marginY = Math.max(3, Math.round(cellH * 0.15));

  const x = grid.cols[col]! + marginX;
  const y = grid.rows[row]! + marginY;
  const w = cellW - 2 * marginX;
  const h = cellH - 2 * marginY;

  // Ensure minimum size for OCR
  const minDim = 20;
  const actualX = x;
  const actualY = y;
  const actualW = Math.max(minDim, w);
  const actualH = Math.max(minDim, h);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = actualW;
  tempCanvas.height = actualH;
  const tempCtx = tempCanvas.getContext('2d')!;

  // Draw white background first (Tesseract works better on light bg)
  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, actualW, actualH);
  tempCtx.drawImage(sourceCanvas, actualX, actualY, actualW, actualH, 0, 0, actualW, actualH);

  return new Promise((resolve, reject) => {
    tempCanvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create cell blob'));
      },
      'image/png',
    );
  });
}

/** Cancelled error sentinel */
export class OcrCancelledError extends Error {
  constructor() {
    super('OCR cancelled');
    this.name = 'OcrCancelledError';
  }
}

// ── Service ──

@Injectable({ providedIn: 'root' })
export class OcrService implements OnDestroy {
  /** Tracks the current OCR job for cancellation */
  private currentJob: {
    workerPromise: Promise<Worker>;
    worker: Worker | null;
    aborted: boolean;
  } | null = null;

  async processImage(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<OcrResult> {
    const abort = { aborted: false };
    this.currentJob = { workerPromise: null as never, worker: null, aborted: false };

    const checkAborted = () => {
      if (abort.aborted || this.currentJob?.aborted) throw new OcrCancelledError();
    };

    try {
      // ── 1. Preprocess (0 → 15%) ──
      onProgress?.(5);
      const preprocessed = await preprocessImage(file);
      checkAborted();
      onProgress?.(15);

      console.log('OCR DEBUG: after preprocess', preprocessed.width, 'x', preprocessed.height);
      // Sample binary pixels to check preprocessing quality
      const d = preprocessed.imageData.data;
      let blackPx = 0, whitePx = 0;
      const sample = [];
      for (let i = 0; i < d.length; i += 4) {
        if (d[i]! < 128) blackPx++; else whitePx++;
        if (sample.length < 30 && i % 10000 < 4) sample.push(d[i]);
      }
      console.log('OCR DEBUG: binary pixel stats:', { black: blackPx, white: whitePx, total: d.length/4, ratio: Math.round(blackPx/(d.length/4)*100) + '%', samples: sample.slice(0,10).join(',') });

      // ── 2. Try grid-line projection (cards with visible borders) ──
      let grid = detectGridLines(
        preprocessed.imageData,
        preprocessed.width,
        preprocessed.height,
      );

      console.log('OCR DEBUG: detectGridLines result:', grid ? `rows=${grid.rows.length} cols=${grid.cols.length}` : 'null');
      if (grid) {
        console.log('OCR DEBUG: grid rows:', grid.rows.join(','));
        console.log('OCR DEBUG: grid cols:', grid.cols.join(','));
        return await this.processGridCells(
          preprocessed.grayCanvas,
          grid,
          checkAborted,
          onProgress,
        );
      }

      // ── 3. Try content-based grid detection (borderless cards) ──
      grid = detectGridFromContent(
        preprocessed.imageData,
        preprocessed.width,
        preprocessed.height,
      );

      if (grid) {
        console.log('OCR DEBUG: content rows:', grid.rows.join(','));
        console.log('OCR DEBUG: content cols:', grid.cols.join(','));
        onProgress?.(18);
        return await this.processGridCells(
          preprocessed.grayCanvas,
          grid,
          checkAborted,
          onProgress,
        );
      }

      // ── 4. Equal-grid fallback — assume a standard 5×5 card ──
      // When neither line nor content detection works, use equal division.
      // This is reliable because bingo cards always have 5 rows and 5 columns.
      const cellW = Math.round(preprocessed.width / 5);
      const cellH = Math.round(preprocessed.height / 5);
      const eqRows = [0, cellH, cellH*2, cellH*3, cellH*4, preprocessed.height];
      const eqCols = [0, cellW, cellW*2, cellW*3, cellW*4, preprocessed.width];
      console.log('OCR DEBUG: equal-grid fallback: rows=' + eqRows.join(',') + ' cols=' + eqCols.join(','));
      onProgress?.(20);
      return await this.processGridCells(
        preprocessed.grayCanvas,
        { rows: eqRows, cols: eqCols },
        checkAborted,
        onProgress,
      );
    } finally {
      // ── Cleanup ──
      if (this.currentJob?.worker) {
        try {
          await this.currentJob.worker.terminate();
        } catch {
          /* ignore */
        }
      }
      this.currentJob = null;
    }
  }

  /**
   * Cancel the current OCR processing (if any).
   */
  cancelProcessing(): void {
    const job = this.currentJob;
    if (job) {
      job.aborted = true;
      if (job.worker) {
        job.worker.terminate().catch(() => {});
      }
    }
  }

  ngOnDestroy(): void {
    this.cancelProcessing();
  }

  // ── Cell-by-cell OCR ──

  /**
   * OCR each of the 24 numbered cells individually using the detected grid.
   *
   * Steps:
   *  1. Create a shared Tesseract worker
   *  2. For each non-free cell, extract the sub-image and OCR with SINGLE_WORD
   *  3. Build the 5×5 grid from results
   *  4. Flag low-confidence cells
   */
  private async processGridCells(
    sourceCanvas: HTMLCanvasElement,
    grid: { rows: number[]; cols: number[] },
    checkAborted: () => void,
    onProgress?: (progress: number) => void,
  ): Promise<OcrResult> {
    checkAborted();

    // ── Create shared worker ──
    const worker = await createWorker('eng', undefined, {
      logger: (_message: LoggerMessage) => {
        // Ignore per-cell progress logging — we report overall progress
        // based on cells completed instead
      },
    });
    this.currentJob!.worker = worker;
    this.currentJob!.workerPromise = Promise.resolve(worker);

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_WORD,
      tessedit_char_whitelist: '0123456789',
    });

    checkAborted();

    const cellCount = 24; // 25 - 1 free cell
    let processedCount = 0;
    let totalConfidence = 0;
    let recognizedCount = 0;

    const gridCells: GridCell[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => createGridCell(0, 0, null, false)),
    );

    const lowConfidenceCells: Array<{
      row: number;
      col: number;
      confidence: number;
    }> = [];

    // ── OCR each cell ──
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const isFree = row === 2 && col === 2;

        gridCells[row]![col] = createGridCell(row, col, null, isFree);

        if (isFree) continue;

        checkAborted();

        try {
          const cellBlob = await extractCellBlob(sourceCanvas, grid, row, col);
          checkAborted();

          const { data } = await worker.recognize(cellBlob);
          checkAborted();

          const text = (data.text ?? '').trim();
          const num = parseInt(text, 10);
          const conf = Math.round(data.confidence ?? 0);

          if (!isNaN(num) && num >= 1 && num <= 75) {
            const column = getColumnForNumber(num) as BingoColumn | null;
            gridCells[row]![col] = createGridCell(
              row,
              col,
              column ? { value: num, column } : null,
              false,
            );

            totalConfidence += conf;
            recognizedCount++;

            if (conf < 60) {
              lowConfidenceCells.push({ row, col, confidence: conf });
            }
          } else {
            // Unrecognized cell
            if (conf > 0) {
              lowConfidenceCells.push({ row, col, confidence: conf });
            }
          }
        } catch (err) {
          if (err instanceof OcrCancelledError) throw err;
          // Individual cell failure — leave null in grid
        }

        processedCount++;
        // Map 15% → 90% based on cells completed
        const pct = 15 + Math.round((processedCount / cellCount) * 75);
        onProgress?.(pct);
      }
    }

    // ── Cleanup worker after all cells ──
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
    if (this.currentJob) {
      this.currentJob.worker = null;
    }

    const avgConfidence =
      recognizedCount > 0 ? Math.round(totalConfidence / recognizedCount) : 0;

    onProgress?.(98);

    // ── Free cell is always correctly placed ──
    gridCells[2]![2] = createGridCell(2, 2, null, true);

    onProgress?.(100);
    return { cells: gridCells, confidence: avgConfidence, lowConfidenceCells };
  }

  // ── Whole-image fallback OCR ──

}
