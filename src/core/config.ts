import type { PowerAction } from "./types";
import { preferences } from "./preferences";

export type VmidRule = number | [number, number];
export type ResourceBar = {
  color?: { warning?: number; critical?: number };
};
type StateDisplay = { showCpu?: boolean; showMemory?: boolean; memoryColor?: string };

export interface DashboardConfig {
  app: {
    title: string;
    subtitle: string;
    language: string;
    dataSource: "auto" | "live" | "mock";
    apiBase: string;
    refreshInterval: number;
    hiddenRefreshInterval: number;
    permissionsRefreshInterval: number;
    showLastUpdated: boolean;
    controls: Record<PowerAction, boolean> & { show: boolean; confirm: Record<PowerAction, boolean> };
  };
  metrics: Record<string, boolean>;
  resourceBars: Record<string, ResourceBar>;
  vmStateDisplay: Record<string, StateDisplay>;
  resources: {
    pool: { unassignedPosition: "first" | "last" };
    physical: { show: boolean; node: boolean; storage: boolean; disks: boolean; network: boolean; backups: boolean };
    virtual: { show: boolean; qemu: boolean; lxc: boolean; templates: boolean; stopped: boolean; excludeVmids: VmidRule[] };
  };
}

export const DEFAULT_CONFIG: DashboardConfig = {
  app: {
    title: "PVE", subtitle: "Proxmox VE", language: "auto", dataSource: "auto",
    apiBase: "/api/api2/json", refreshInterval: 5, hiddenRefreshInterval: 60,
    permissionsRefreshInterval: 300, showLastUpdated: true,
    controls: {
      show: true, start: true, shutdown: true, stop: true, reboot: true, suspend: true, resume: true,
      confirm: { start: false, shutdown: true, stop: true, reboot: true, suspend: true, resume: true },
    },
  },
  metrics: { status: true, cpu: true, memory: true, disk: true, uptime: true, load: true, network: true, vmid: true, type: true, node: true },
  resourceBars: {
    cpu: { color: { warning: 0.7, critical: 0.9 } },
    memory: { color: { warning: 0.75, critical: 0.90 } },
  },
  vmStateDisplay: {
    running: { showCpu: true, showMemory: true },
    suspended: { showCpu: false, showMemory: true, memoryColor: "paused" },
    stopped: { showCpu: false, showMemory: false },
    template: { showCpu: false, showMemory: false },
  },
  resources: {
    pool: { unassignedPosition: "first" },
    physical: { show: true, node: true, storage: true, disks: true, network: true, backups: true },
    virtual: { show: true, qemu: true, lxc: true, templates: true, stopped: true, excludeVmids: [] },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVmidRule(value: unknown): value is VmidRule {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    || Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isSafeInteger(item) && item > 0) && value[0] <= value[1];
}

function mergeKnown<T>(defaults: T, overrides: unknown, path = ""): T {
  if (Array.isArray(defaults)) {
    if (!Array.isArray(overrides)) return structuredClone(defaults);
    if (path === "resources.virtual.excludeVmids") return overrides.filter(isVmidRule) as T;
    return structuredClone(defaults);
  }
  if (isRecord(defaults)) {
    const source = isRecord(overrides) ? overrides : {};
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
      [key, mergeKnown(value, source[key], path ? `${path}.${key}` : key)])) as T;
  }
  return typeof overrides === typeof defaults && (typeof overrides !== "number" || Number.isFinite(overrides))
    ? overrides as T : defaults;
}

function choose<T extends string>(value: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

function inRange(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeConfig(value: unknown): DashboardConfig {
  const result = mergeKnown(DEFAULT_CONFIG, value);
  const app = result.app;
  app.language = choose(app.language, ["auto", "zh-CN", "en"], DEFAULT_CONFIG.app.language);
  app.dataSource = choose(app.dataSource, ["auto", "live", "mock"], DEFAULT_CONFIG.app.dataSource);
  app.apiBase = /^\/(?!\/)[^\\\s?#]*$/.test(app.apiBase) ? app.apiBase : DEFAULT_CONFIG.app.apiBase;
  app.refreshInterval = inRange(app.refreshInterval, 0, 86_400, DEFAULT_CONFIG.app.refreshInterval);
  app.hiddenRefreshInterval = inRange(app.hiddenRefreshInterval, 0, 86_400, DEFAULT_CONFIG.app.hiddenRefreshInterval);
  app.permissionsRefreshInterval = inRange(app.permissionsRefreshInterval, 30, 86_400, DEFAULT_CONFIG.app.permissionsRefreshInterval);
  result.resources.pool.unassignedPosition = choose(result.resources.pool.unassignedPosition, ["first", "last"], "first");
  for (const kind of ["cpu", "memory"] as const) {
    const bar = result.resourceBars[kind];
    const base = DEFAULT_CONFIG.resourceBars[kind];
    if (bar.color && base.color) {
      bar.color.warning = inRange(bar.color.warning ?? NaN, 0, 1, base.color.warning ?? 0);
      bar.color.critical = inRange(bar.color.critical ?? NaN, bar.color.warning, 1, base.color.critical ?? 1);
    }
  }
  return result;
}

function differences(defaults: unknown, value: unknown): unknown {
  if (Array.isArray(defaults)) return JSON.stringify(defaults) === JSON.stringify(value) ? undefined : value;
  if (isRecord(defaults) && isRecord(value)) {
    const entries = Object.entries(defaults)
      .map(([key, item]) => [key, differences(item, value[key])] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return Object.is(defaults, value) ? undefined : value;
}

export function configIssue(value: DashboardConfig): string | null {
  const app = value.app;
  if (!/^\/(?!\/)[^\\\s?#]*$/.test(app.apiBase)) return "settingsApiPathError";
  if (![app.refreshInterval, app.hiddenRefreshInterval].every((number) => Number.isFinite(number) && number >= 0 && number <= 86_400)
    || !Number.isFinite(app.permissionsRefreshInterval) || app.permissionsRefreshInterval < 30 || app.permissionsRefreshInterval > 86_400) return "settingsIntervalError";
  if (value.resources.virtual.excludeVmids.some((rule) => !isVmidRule(rule))) return "settingsVmidRuleError";
  for (const kind of ["cpu", "memory"] as const) {
    const colors = value.resourceBars[kind].color;
    if (!colors || !Number.isFinite(colors.warning) || !Number.isFinite(colors.critical)
      || (colors.warning ?? -1) < 0 || (colors.critical ?? 2) > 1 || (colors.warning ?? 1) >= (colors.critical ?? 0)) return "settingsThresholdError";
  }
  return null;
}

function validStructure(defaults: unknown, value: unknown, path = "", requireFull = false): boolean {
  if (Array.isArray(defaults)) return Array.isArray(value) && (path !== "resources.virtual.excludeVmids" || value.every(isVmidRule));
  if (isRecord(defaults)) {
    if (!isRecord(value) || Object.keys(value).some((key) => !Object.hasOwn(defaults, key))) return false;
    return Object.entries(value).every(([key, item]) => validStructure(defaults[key], item, path ? `${path}.${key}` : key, requireFull))
      && (!requireFull || Object.keys(defaults).every((key) => Object.hasOwn(value, key)));
  }
  return typeof value === typeof defaults && (typeof value !== "number" || Number.isFinite(value));
}

function validOptions(value: DashboardConfig): boolean {
  return ["auto", "zh-CN", "en"].includes(value.app.language)
    && ["auto", "live", "mock"].includes(value.app.dataSource)
    && ["first", "last"].includes(value.resources.pool.unassignedPosition);
}

export function parseConfigJson(text: string): { value?: DashboardConfig; issue?: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || !["app", "metrics", "resourceBars", "vmStateDisplay", "resources"].every((key) => isRecord(parsed[key]))) {
      return { issue: "settingsConfigFormatError" };
    }
    if (!validStructure(DEFAULT_CONFIG, parsed, "", true)) return { issue: "settingsConfigFormatError" };
    const value = parsed as unknown as DashboardConfig;
    if (!validOptions(value)) return { issue: "settingsConfigFormatError" };
    const issue = configIssue(value);
    return issue ? { issue } : { value: normalizeConfig(value) };
  } catch {
    return { issue: "settingsConfigFormatError" };
  }
}

function loadConfig(): DashboardConfig {
  const overrides = preferences.get("configOverrides");
  const candidate = mergeKnown(DEFAULT_CONFIG, overrides);
  if (validStructure(DEFAULT_CONFIG, overrides) && validOptions(candidate) && !configIssue(candidate)) return candidate;
  preferences.set("configOverrides", {});
  return structuredClone(DEFAULT_CONFIG);
}

export const config = loadConfig();

export function saveConfig(value: DashboardConfig): boolean {
  if (configIssue(value)) return false;
  const next = normalizeConfig(value);
  return preferences.set("configOverrides", (differences(DEFAULT_CONFIG, next) ?? {}) as Record<string, unknown>);
}

export function resetConfig(): boolean {
  return preferences.set("configOverrides", {});
}
