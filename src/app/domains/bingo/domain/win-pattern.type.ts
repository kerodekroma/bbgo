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
  'frame': 'Frame',
  'full-house': 'Full House',
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
    'frame',
  ],
};
