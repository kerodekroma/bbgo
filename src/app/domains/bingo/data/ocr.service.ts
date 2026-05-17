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
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Load a file into an offscreen canvas, resize, grayscale + contrast.
 * Returns the processed blob (for OCR), ImageData (for grid detection),
 * and canvas (for cell extraction).
 */
function preprocessImage(file: File): Promise<PreprocessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 1200;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Draw scaled image
      ctx.drawImage(img, 0, 0, width, height);

      // Apply grayscale + contrast
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(
          data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114,
        );
        const contrast = 1.5;
        const adjusted = Math.round(128 + (gray - 128) * contrast);
        const clamped = Math.max(0, Math.min(255, adjusted));
        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
      }
      ctx.putImageData(imageData, 0, 0);

      // For grid detection: add a second pass with adaptive threshold
      // to make grid lines vs background more distinct
      const enhancedData = ctx.getImageData(0, 0, width, height);
      const eData = enhancedData.data;
      for (let i = 0; i < eData.length; i += 4) {
        // Stronger contrast stretch for binary-like separation
        const v = eData[i]!;
        // Push values toward extremes: <128 → darker, >128 → lighter
        const stretched = v < 128 ? Math.max(0, v - 30) : Math.min(255, v + 30);
        eData[i] = stretched;
        eData[i + 1] = stretched;
        eData[i + 2] = stretched;
      }

      canvas.toBlob(
        blob => {
          if (blob) {
            resolve({ blob, imageData: enhancedData, canvas, width, height });
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
  const marginX = Math.max(2, Math.round(cellW * 0.12));
  const marginY = Math.max(2, Math.round(cellH * 0.12));

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
      'image/jpeg',
      0.92,
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

      // ── 2. Try grid detection ──
      const grid = detectGridLines(
        preprocessed.imageData,
        preprocessed.width,
        preprocessed.height,
      );

      if (grid) {
        // Grid detected → cell-by-cell OCR
        return await this.processGridCells(
          preprocessed.canvas,
          grid,
          checkAborted,
          onProgress,
        );
      }

      // ── 3. Fallback: whole-image OCR ──
      onProgress?.(20);
      return await this.processWholeImage(
        preprocessed.blob,
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

  /**
   * Fallback path: OCR the entire preprocessed image at once, then
   * use word bounding box coordinates to build the 5×5 grid.
   * This is the original approach.
   */
  private async processWholeImage(
    blob: Blob,
    checkAborted: () => void,
    onProgress?: (progress: number) => void,
  ): Promise<OcrResult> {
    checkAborted();

    const worker = await createWorker('eng', undefined, {
      logger: (m: LoggerMessage) => {
        if (m.status === 'recognizing text') {
          onProgress?.(20 + Math.round(m.progress * 70));
        }
      },
    });
    this.currentJob!.worker = worker;
    this.currentJob!.workerPromise = Promise.resolve(worker);
    checkAborted();

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      tessedit_char_whitelist: '0123456789',
    });

    const { data } = await worker.recognize(blob);
    checkAborted();
    onProgress?.(92);

    const words = data.words ?? [];
    const cells = this.parseWordsToGrid(words);
    onProgress?.(95);

    const avgConfidence =
      words.length > 0
        ? Math.round(
            words.reduce((sum, w) => sum + (w.confidence ?? 0), 0) /
              words.length,
          )
        : 0;

    const lowConfidenceCells: Array<{
      row: number;
      col: number;
      confidence: number;
    }> = [];

    for (const word of words) {
      const num = parseInt(word.text, 10);
      if (num >= 1 && num <= 75 && (word.confidence ?? 0) < 60) {
        const pos = this.findGridPosition(cells, num);
        if (pos) {
          lowConfidenceCells.push({
            row: pos.row,
            col: pos.col,
            confidence: Math.round(word.confidence ?? 0),
          });
        }
      }
    }

    onProgress?.(100);
    return { cells, confidence: avgConfidence, lowConfidenceCells };
  }

  // ── Spatial grid builder (fallback) ──

  /**
   * Build a 5×5 grid using word bounding box coordinates.
   * Groups recognized words into 5 rows by y-position,
   * then sorts each row into 5 columns by x-position.
   */
  private parseWordsToGrid(
    words: Array<{
      text: string;
      confidence?: number;
      block_num?: number;
      line_num?: number;
      word_num?: number;
      x_min?: number;
      y_min?: number;
      x_max?: number;
      y_max?: number;
    }>,
  ): GridCell[][] {
    const valid = words
      .map(w => ({ ...w, num: parseInt(w.text, 10) }))
      .filter(w => !isNaN(w.num) && w.num >= 1 && w.num <= 75);

    if (valid.length === 0) {
      return Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) =>
          createGridCell(row, col, null, row === 2 && col === 2),
        ),
      );
    }

    const sortedByY = [...valid].sort(
      (a, b) => (a.y_min ?? 0) - (b.y_min ?? 0),
    );

    const rows: typeof sortedByY[] = [];
    const rowHeight = Math.max(
      (sortedByY[sortedByY.length - 1]!.y_max ?? 0) -
        (sortedByY[0]!.y_min ?? 0),
      1,
    ) / 5;

    for (const word of sortedByY) {
      const yCenter = ((word.y_min ?? 0) + (word.y_max ?? 0)) / 2;
      const rowIdx = Math.min(
        Math.floor(
          (yCenter - (sortedByY[0]!.y_min ?? 0)) / rowHeight,
        ),
        4,
      );
      if (!rows[rowIdx]) rows[rowIdx] = [];
      rows[rowIdx]!.push(word);
    }

    const grid: GridCell[][] = [];
    for (let row = 0; row < 5; row++) {
      const rowWords = (rows[row] ?? []).sort(
        (a, b) => (a.x_min ?? 0) - (b.x_min ?? 0),
      );

      const rowCells: GridCell[] = [];
      for (let col = 0; col < 5; col++) {
        const isFree = row === 2 && col === 2;
        if (isFree) {
          rowCells.push(createGridCell(row, col, null, true));
          continue;
        }
        const word = rowWords[col];
        if (word && word.num >= 1 && word.num <= 75) {
          const column = getColumnForNumber(word.num) as BingoColumn | null;
          rowCells.push(
            createGridCell(
              row,
              col,
              column ? { value: word.num, column } : null,
              false,
            ),
          );
        } else {
          rowCells.push(createGridCell(row, col, null, false));
        }
      }
      grid.push(rowCells);
    }

    return grid;
  }

  /** Find which grid cell (row,col) contains a given number */
  private findGridPosition(
    grid: GridCell[][],
    num: number,
  ): { row: number; col: number } | null {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < (grid[row]?.length ?? 0); col++) {
        const cell = grid[row]![col]!;
        if (!cell.isFree && cell.number?.value === num) {
          return { row, col };
        }
      }
    }
    return null;
  }
}
