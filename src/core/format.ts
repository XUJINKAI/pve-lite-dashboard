import { locale, t } from "./i18n";
export { num, ratio, clampRatio, memoryUsageRatio, parseSize } from "./numbers";

export function formatPercent(value: unknown) {
  const percent = Math.max(0, Number(value) || 0) * 100;
  if (percent === 0) return "0%";
  const digits = percent < 1 ? 2 : percent < 10 ? 1 : 0;
  return `${Number(percent.toFixed(digits))}%`;
}

export function formatBytes(bytes: unknown) {
  const value = Number(bytes) || 0;
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** index;
  const digits = scaled >= 100 || index === 0 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[index]}`;
}

export function formatDuration(seconds: unknown) {
  let value = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(value / 86400); value %= 86400;
  const hours = Math.floor(value / 3600); value %= 3600;
  const minutes = Math.floor(value / 60);
  if (days) return t("days", { d: days, h: hours });
  if (hours) return t("hours", { h: hours, m: minutes });
  if (minutes) return t("minutes", { m: minutes });
  return t("seconds", { s: value });
}

export function formatDateTime(seconds: unknown) {
  return seconds ? new Date(Number(seconds) * 1000).toLocaleString(locale.value, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}
