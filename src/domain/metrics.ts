import type { ResourceBar } from "../core/config";
import { clampRatio } from "../core/numbers";

export function heatClass(fraction: number, resource = "generic", settings: ResourceBar = {}) {
  const value = clampRatio(fraction);
  const thresholds = settings.color || {};
  const warning = Number.isFinite(Number(thresholds.warning)) ? Number(thresholds.warning) : resource === "memory" ? .75 : .8;
  const critical = Number.isFinite(Number(thresholds.critical)) ? Number(thresholds.critical) : resource === "memory" ? .9 : .95;
  return value >= critical ? "critical" : value >= warning ? "warning" : "normal";
}
