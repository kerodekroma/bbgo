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

/** Cancelled error sentinel — thrown when OCR is aborted by the user */
export class OcrCancelledError extends Error {
  constructor() {
    super('OCR cancelled');
    this.name = 'OcrCancelledError';
  }
}

@Injectable({ providedIn: 'root' })
export class OcrService implements OnDestroy {
  /** Tracks the current OCR job for cancellation */
  private currentJob: { workerPromise: Promise<Worker>; worker: Worker | null; aborted: boolean } | null = null;

  /**
   * Process a bingo card image and extract the 5×5 grid numbers.
   *
   * Features:
   *  - Image preprocessing (grayscale + contrast + resize)
   *  - Progress reporting via callback (0–100)
   *  - Cancellable via cancelProcessing()
   *  - PSM set to single-uniform-block for grids
   *  - Character whitelist restricts to digits only
   *  - Spatial word-position parsing for robust grid extraction
   *
   * @param file The image file to process
   * @param onProgress Optional callback receiving estimated progress (0–100)
   * @throws OcrCancelledError if cancelProcessing() is called during execution
   */
  async processImage(file: File, onProgress?: (progress: number) => void): Promise<OcrResult> {
    // ── Track current job for cancellation ──
    const abort = { aborted: false };
    this.currentJob = { workerPromise: null as never, worker: null, aborted: false };

    const checkAborted = () => {
      if (abort.aborted || this.currentJob?.aborted) throw new OcrCancelledError();
    };

    try {
      // ── 1. Preprocess image (0 → 25%) ──
      onProgress?.(5);
      const processedBlob = await preprocessImage(file);
      checkAborted();
      onProgress?.(25);

      // ── 2. Create worker with progress logger (25 → 90%) ──
      const worker = await createWorker('eng', undefined, {
        logger: (msg: LoggerMessage) => {
          if (msg.status === 'recognizing text') {
            onProgress?.(25 + Math.round(msg.progress * 65));
          }
        },
      });
      this.currentJob.worker = worker;
      this.currentJob.workerPromise = Promise.resolve(worker);
      checkAborted();

      // ── 3. Set optimal params for number-only recognition ──
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: '0123456789',
      });

      // ── 4. Recognize ──
      const { data } = await worker.recognize(processedBlob);
      checkAborted();
      onProgress?.(92);

      const words = data.words ?? [];

      // ── 5. Parse spatially — use word bounding boxes to build the 5×5 grid ──
      const cells = this.parseWordsToGrid(words);
      onProgress?.(96);

      const avgConfidence = words.length > 0
        ? Math.round(words.reduce((sum, w) => sum + (w.confidence ?? 0), 0) / words.length)
        : 0;

      // ── 6. Flag low-confidence cells ──
      const lowConfidenceCells: Array<{ row: number; col: number; confidence: number }> = [];
      for (const word of words) {
        const num = parseInt(word.text, 10);
        if (num >= 1 && num <= 75 && (word.confidence ?? 0) < 60) {
          const pos = this.findGridPosition(cells, num);
          if (pos) {
            lowConfidenceCells.push({ row: pos.row, col: pos.col, confidence: Math.round(word.confidence ?? 0) });
          }
        }
      }

      onProgress?.(100);
      return { cells, confidence: avgConfidence, lowConfidenceCells };
    } finally {
      // ── Cleanup: terminate the per-call worker ──
      if (this.currentJob?.worker) {
        try { await this.currentJob.worker.terminate(); } catch { /* ignore */ }
      }
      this.currentJob = null;
    }
  }

  /**
   * Cancel the current OCR processing (if any).
   * The in-flight processImage() promise will reject with OcrCancelledError.
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

  /** Cleanup worker on service destroy */
  ngOnDestroy(): void {
    this.cancelProcessing();
  }

  // ── Private ──

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
