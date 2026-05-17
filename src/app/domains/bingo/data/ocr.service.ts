import { Injectable } from '@angular/core';
import type { GridCell } from '../domain/grid-cell.vo';
import { createGridCell } from '../domain/grid-cell.vo';
import { getColumnForNumber } from '../domain/bingo-column.type';
import type { BingoColumn } from '../domain/bingo-column.type';
import { createWorker } from 'tesseract.js';

export interface OcrResult {
  cells: GridCell[][];
  confidence: number;
  lowConfidenceCells: Array<{ row: number; col: number; confidence: number }>;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  /**
   * Process a bingo card image and extract the 5×5 grid numbers.
   * Uses Tesseract.js to recognize text from the image, then parses
   * the recognized text into a structured 5×5 grid.
   *
   * Returns the extracted cells with per-cell confidence scores.
   * Low-confidence cells (< 60%) are flagged for user review.
   */
  async processImage(file: File): Promise<OcrResult> {
    const worker = await createWorker('eng');

    try {
      const { data } = await worker.recognize(file);
      const cells = this.parseOcrText(data.text);

      const words = data.words ?? [];
      const avgConfidence = words.length > 0
        ? Math.round(words.reduce((sum, w) => sum + (w.confidence ?? 0), 0) / words.length)
        : 0;

      // Map recognized words back to grid cells by reading order
      // to flag low-confidence cells for user review
      const lowConfidenceCells: Array<{ row: number; col: number; confidence: number }> = [];
      const lines = data.text.trim().split('\n').filter(l => l.trim());
      let wordIdx = 0;

      for (let row = 0; row < Math.min(lines.length, 5); row++) {
        const numbers = lines[row]!
          .trim()
          .split(/[\s,]+/)
          .map(s => parseInt(s, 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= 75);

        for (let col = 0; col < Math.min(numbers.length, 5); col++) {
          if (row === 2 && col === 2) continue; // FREE cell — skip
          const word = words[wordIdx];
          if (word && (word.confidence ?? 0) < 60) {
            lowConfidenceCells.push({ row, col, confidence: Math.round(word.confidence ?? 0) });
          }
          wordIdx++;
        }
      }

      return {
        cells,
        confidence: avgConfidence,
        lowConfidenceCells,
      };
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Parse raw OCR text into a 5×5 grid of numbers.
   * Expects text in a format where numbers are arranged in rows.
   */
  parseOcrText(text: string): GridCell[][] {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const grid: GridCell[][] = [];

    for (let row = 0; row < Math.min(lines.length, 5); row++) {
      const numbers = lines[row]!
        .trim()
        .split(/[\s,]+/)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 75);

      const rowCells: GridCell[] = [];
      for (let col = 0; col < Math.min(numbers.length, 5); col++) {
        const value = numbers[col]!;
        const isFree = row === 2 && col === 2;
        const column = getColumnForNumber(value) as BingoColumn | null;

        rowCells.push(
          createGridCell(
            row,
            col,
            column ? { value, column } : null,
            isFree,
          ),
        );
      }
      grid.push(rowCells);
    }

    return grid;
  }
}
