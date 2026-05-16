import { Injectable } from '@angular/core';
import type { GridCell } from '../domain/grid-cell.vo';
import { createGridCell } from '../domain/grid-cell.vo';
import { getColumnForNumber } from '../domain/bingo-column.type';
import type { BingoColumn } from '../domain/bingo-column.type';

export interface OcrResult {
  cells: GridCell[][];
  confidence: number;
  lowConfidenceCells: Array<{ row: number; col: number; confidence: number }>;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  /**
   * Process a bingo card image and extract the 5×5 grid numbers.
   * Returns the extracted grid with confidence scores.
   *
   * NOTE: Tesseract.js integration is wrapped here but the actual OCR
   * processing is asynchronous and requires the tesseract.js library.
   * The current implementation is a scaffold that parses the expected
   * text format from OCR output.
   */
  async processImage(_file: File): Promise<OcrResult> {
    // This is a placeholder. In production, this would:
    // 1. Load Tesseract.js worker
    // 2. Recognize text from the image
    // 3. Parse the recognized text into a 5×5 grid
    // 4. Validate numbers against column ranges
    // 5. Return extracted cells with confidence scores

    // For now, return an empty result with an error suggestion
    // This will be implemented when Tesseract.js is fully integrated
    throw new Error(
      'OCR processing requires Tesseract.js. ' +
      'Use manual entry to add cards, or integrate Tesseract.js by importing ' +
      'and configuring it in this service.'
    );
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
