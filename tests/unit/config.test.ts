import { beforeEach, describe, expect, it, vi } from "vitest";

const storageKey = "pve-lite-dashboard.preferences.v1";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("browser configuration", () => {
  it("starts with five-second foreground polling and persists only changed values", async () => {
    const { config, DEFAULT_CONFIG, saveConfig } = await import("../../src/core/config");
    expect(config.app.refreshInterval).toBe(5);
    expect(config.app.hiddenRefreshInterval).toBe(60);
    const draft = structuredClone(config);
    draft.app.title = "Lab";
    draft.app.refreshInterval = 12;
    expect(saveConfig(draft)).toBe(true);
    expect(JSON.parse(localStorage.getItem(storageKey) || "{}").configOverrides).toEqual({ app: { title: "Lab", refreshInterval: 12 } });
    expect(DEFAULT_CONFIG.app.title).toBe("PVE");
  });

  it("restores defaults and writes them back when saved configuration contains invalid fields", async () => {
    localStorage.setItem(storageKey, JSON.stringify({ configOverrides: {
      app: { title: "Local", refreshInterval: -2, dataSource: "unexpected", token: "discard" },
      resources: { types: ["lxc", "unexpected"] },
      extra: "discard",
    } }));
    const { config } = await import("../../src/core/config");
    expect(config.app.title).toBe("PVE");
    expect(config.app.refreshInterval).toBe(5);
    expect(config.app.dataSource).toBe("auto");
    expect(config.resources.virtual.lxc).toBe(true);
    expect("token" in config.app).toBe(false);
    expect("extra" in config).toBe(false);
    expect(JSON.parse(localStorage.getItem(storageKey) || "{}").configOverrides).toEqual({});
  });

  it("loads resource color thresholds from browser preferences", async () => {
    localStorage.setItem(storageKey, JSON.stringify({ configOverrides: {
      resourceBars: { cpu: { color: { warning: 0.6 } } },
    } }));
    const { config } = await import("../../src/core/config");
    expect(config.resourceBars.cpu).toEqual({ color: { warning: 0.6, critical: 0.9 } });
  });

  it("writes default overrides when a resource switch has the wrong type", async () => {
    localStorage.setItem(storageKey, JSON.stringify({ configOverrides: { resources: { physical: { disks: "off" } } } }));
    const { config } = await import("../../src/core/config");
    expect(config.resources.physical.disks).toBe(true);
    expect(JSON.parse(localStorage.getItem(storageKey) || "{}").configOverrides).toEqual({});
  });

  it("rejects invalid form values before storing them", async () => {
    const { config, configIssue, saveConfig } = await import("../../src/core/config");
    const draft = structuredClone(config);
    draft.app.apiBase = "https://example.invalid/api";
    expect(configIssue(draft)).toBe("settingsApiPathError");
    expect(saveConfig(draft)).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});

it.each(["//example.invalid/api", "/\\example.invalid/api", "/api\\path"])("rejects ambiguous API URL %s", async (apiBase) => {
  const { config, saveConfig, configIssue } = await import("../../src/core/config");
  const draft = structuredClone(config);
  draft.app.apiBase = apiBase;
  expect(configIssue(draft)).toBe("settingsApiPathError");
  expect(saveConfig(draft)).toBe(false);
});
