export const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const ratio = (a: number, b: number) => b > 0 ? a / b : 0;
export const clampRatio = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));
export const memoryUsageRatio = (used: number, max: number) => max > 0 ? clampRatio(used / max) : 0;

export function parseSize(value: unknown) {
  if (!value) return 0;
  const match = String(value).trim().match(/^([\d.]+)\s*([KMGTPE]?)(?:i?B)?$/i);
  if (!match) return 0;
  const powers: Record<string, number> = { "": 0, K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 };
  return Number(match[1]) * 1024 ** powers[match[2].toUpperCase()];
}
