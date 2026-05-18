import type { GridCell } from './grid-cell.vo';

/** All supported bingo win pattern types */
export type WinPatternKind =
  | 'single-line'
  | 'multi-line'
  | 'four-corners'
  | 'postage-stamp'
  | 'letter-x'
  | 'letter-l'
  | 'letter-t'
  | 'letter-i'
  | 'frame'
  | 'full-house';

/** A detected winning pattern on a bingo card */
export interface WinPattern {
  kind: WinPatternKind;
  cells: readonly GridCell[];
  description: string;
}

/** All pattern kinds with human-readable labels */
export const PATTERN_LABELS: Record<WinPatternKind, string> = {
  'single-line': 'Single Line',
  'multi-line': 'Multiple Lines',
  'four-corners': 'Four Corners',
  'postage-stamp': 'Postage Stamp',
  'letter-x': 'Letter X',
  'letter-l': 'Letter L',
  'letter-t': 'Letter T',
  'letter-i': 'Letter I',
  'frame': 'Frame',
  'full-house': 'Full House',
};

/**
 * Which cells (0–24, row-major 5×5 grid) each pattern covers.
 * Used for the mini 5×5 visual icon in the pattern picker.
 *
 * Grid layout:
 *   0  1  2  3  4
 *   5  6  7  8  9
 *  10 11 12 13 14
 *  15 16 17 18 19
 *  20 21 22 23 24
 */
export const PATTERN_VISUAL_CELLS: Record<WinPatternKind, readonly number[]> = {
  'single-line': [0, 1, 2, 3, 4],
  'multi-line': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  'four-corners': [0, 4, 20, 24],
  'postage-stamp': [0, 1, 5, 6],
  'letter-x': [0, 4, 6, 8, 12, 16, 18, 20, 24],
  'letter-l': [0, 1, 2, 3, 4, 9, 14, 19, 24],
  'letter-t': [0, 1, 2, 3, 4, 7, 12, 17, 22],
  'letter-i': [0, 1, 2, 3, 4, 7, 12, 17, 20, 21, 22, 23, 24],
  'frame': [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24],
  'full-house': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
};

/** Short descriptions explaining what each pattern requires */
export const PATTERN_DESCRIPTIONS: Record<WinPatternKind, string> = {
  'single-line': 'Any complete row, column, or diagonal',
  'multi-line': 'Two or more complete lines at once',
  'four-corners': 'All 4 corner cells',
  'postage-stamp': 'A full 2×2 block in any corner',
  'letter-x': 'Both diagonals forming an X',
  'letter-l': 'Any full row + any full column',
  'letter-t': 'Any full row + the center column',
  'letter-i': 'Top row + center column + bottom row (I shape)',
  'frame': 'All 16 outer border cells',
  'full-house': 'All 25 cells marked',
};

/** How many cells each pattern requires to complete */
export const PATTERN_CELL_COUNTS: Record<WinPatternKind, number> = {
  'single-line': 5,
  'multi-line': 10,
  'four-corners': 4,
  'postage-stamp': 4,
  'letter-x': 9,
  'letter-l': 9,
  'letter-t': 9,
  'letter-i': 13,
  'frame': 16,
  'full-house': 25,
};

/** Pattern settings — which patterns are actively checked */
export interface PatternSettings {
  enabled: WinPatternKind[];
}

/** Default: all patterns enabled except multi-line (inferred from 2+ lines) and full-house (special) */
export const DEFAULT_PATTERN_SETTINGS: PatternSettings = {
  enabled: [
    'single-line',
    'four-corners',
    'postage-stamp',
    'letter-x',
    'letter-l',
    'letter-t',
    'letter-i',
    'frame',
  ],
};
