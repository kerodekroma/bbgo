import { Injectable } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import type { GridCell } from '../domain/grid-cell.vo';
import { createGridCell } from '../domain/grid-cell.vo';
import { getColumnForNumber } from '../domain/bingo-column.type';
import type { BingoColumn } from '../domain/bingo-column.type';
import { createWorker, PSM, type Worker } from 'tesseract.js';

export interface OcrResult {
  cells: GridCell[][];
  confidence: number;
  lowConfidenceCells: Array<{ row: number; col: number; confidence: number }>;
}

// PSM.SINGLE_BLOCK = assume a single uniform block of text — best for clean grids

/**
 * Preprocess a bingo card image before OCR to dramatically improve
 * accuracy on mobile photos with varied lighting.
 *
 * Steps:
 *  1. Resize to max 1200px wide (faster OCR, enough resolution)
 *  2. Grayscale + increased contrast
 *  3. Return as JPEG blob
 */
function preprocessImage(file: File): Promise<Blob> {
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
        // Weighted grayscale conversion (luminosity)
        const gray = Math.round(
          data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114,
        );
        // Increase contrast: push values away from midpoint 128
        const contrast = 1.5; // 1.0 = no change
        const adjusted = Math.round(128 + (gray - 128) * contrast);
        const clamped = Math.max(0, Math.min(255, adjusted));
        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        0.9,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

@Injectable({ providedIn: 'root' })
export class OcrService implements OnDestroy {
  private workerPromise: Promise<Worker> | null = null;

  /**
   * Process a bingo card image and extract the 5×5 grid numbers.
   *
   * Improvements over basic Tesseract.js usage:
   *  - Image preprocessing (grayscale + contrast + resize) before OCR
   *  - Worker reused across calls (no create/terminate per image)
   *  - PSM set to single-uniform-block (not default auto-page-seg)
   *  - Character whitelist restricts to digits only
   *  - Spatial word-position parsing for robust grid extraction
   *
   * Returns the extracted cells with per-cell confidence scores.
   * Low-confidence cells (< 60%) are flagged for user review.
   */
  async processImage(file: File): Promise<OcrResult> {
    // 1. Preprocess image
    const processedBlob = await preprocessImage(file);

    // 2. Get or create reusable worker
    const worker = await this.getWorker();

    // 3. Set optimal params for number recognition
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      tessedit_char_whitelist: '0123456789',
    });

    // 4. Recognize with spatial word data
    const { data } = await worker.recognize(processedBlob);
    const words = data.words ?? [];

    // 5. Parse spatially — use word bounding boxes to build the 5×5 grid
    const cells = this.parseWordsToGrid(words);
    const avgConfidence = words.length > 0
      ? Math.round(words.reduce((sum, w) => sum + (w.confidence ?? 0), 0) / words.length)
      : 0;

    // 6. Flag low-confidence cells
    const lowConfidenceCells: Array<{ row: number; col: number; confidence: number }> = [];
    for (const word of words) {
      // Only flag grid-valid numbers
      const num = parseInt(word.text, 10);
      if (num >= 1 && num <= 75 && (word.confidence ?? 0) < 60) {
        const pos = this.findGridPosition(cells, num);
        if (pos) {
          lowConfidenceCells.push({ row: pos.row, col: pos.col, confidence: Math.round(word.confidence ?? 0) });
        }
      }
    }

    return {
      cells,
      confidence: avgConfidence,
      lowConfidenceCells,
    };
  }

  /** Cleanup worker on service destroy */
  ngOnDestroy(): void {
    this.terminateWorker();
  }

  // ── Private ──

  /**
   * Get or create a reusable Tesseract worker.
   * Only one worker is kept alive across calls to avoid
   * re-downloading the language model every time.
   */
  private async getWorker(): Promise<Worker> {
    if (this.workerPromise) return this.workerPromise;
    this.workerPromise = createWorker('eng');
    return this.workerPromise;
  }

  private async terminateWorker(): Promise<void> {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }

  /**
   * Build a 5×5 grid using word bounding box coordinates.
   *
   * Tesseract returns each recognized word with its bounding box
   * (block_num, line_num, word_num, x_min, y_min, x_max, y_max).
   * We group words into 5 rows by y-position, then sort each row by
   * x-position into 5 columns.
   */
  private parseWordsToGrid(
    words: Array<{ text: string; confidence?: number; block_num?: number; line_num?: number; word_num?: number; x_min?: number; y_min?: number; x_max?: number; y_max?: number }>,
  ): GridCell[][] {
    // Filter to valid numbers only
    const valid = words
      .map(w => ({ ...w, num: parseInt(w.text, 10) }))
      .filter(w => !isNaN(w.num) && w.num >= 1 && w.num <= 75);

    if (valid.length === 0) {
      // Fallback: no spatial data, return empty grid
      return Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) =>
          createGridCell(row, col, null, row === 2 && col === 2),
        ),
      );
    }

    // Sort by vertical position (top to bottom)
    const sortedByY = [...valid].sort((a, b) => (a.y_min ?? 0) - (b.y_min ?? 0));

    // Partition into 5 rows
    const rows: typeof sortedByY[] = [];
    const rowHeight = Math.max(
      (sortedByY[sortedByY.length - 1]!.y_max ?? 0) - (sortedByY[0]!.y_min ?? 0),
      1,
    ) / 5;

    for (const word of sortedByY) {
      const yCenter = ((word.y_min ?? 0) + (word.y_max ?? 0)) / 2;
      const rowIdx = Math.min(Math.floor((yCenter - (sortedByY[0]!.y_min ?? 0)) / rowHeight), 4);
      if (!rows[rowIdx]) rows[rowIdx] = [];
      rows[rowIdx]!.push(word);
    }

    // Within each row, sort by horizontal position (left to right)
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
