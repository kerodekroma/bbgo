/** Check if a number is within a given range (inclusive) */
export function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

/** Check if a value exists in an array */
export function isDuplicate<T>(arr: T[], value: T): boolean {
  return arr.includes(value);
}

/** Generate a short human-readable card code */
export function generateCardCode(): string {
  const prefix = 'BING';
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
