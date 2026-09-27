import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../../src/core/config";
import { useDashboardPolling } from "../../src/composables/useDashboardPolling";

afterEach(() => {
  vi.useRealTimers();
});

describe("dashboard polling", () => {
  it("starts, refreshes on schedule, and removes listeners when stopped", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    const refreshResources = vi.fn().mockResolvedValue(undefined);
    const refreshPermissions = vi.fn().mockResolvedValue(undefined);
    const settings = { ...DEFAULT_CONFIG.app, refreshInterval: 1, permissionsRefreshInterval: 30 };
    const polling = useDashboardPolling(settings, { refreshResources, refreshPermissions });

    await polling.start();
    expect(refreshResources).toHaveBeenCalledTimes(1);
    expect(refreshPermissions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refreshResources).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("online"));
    expect(refreshResources).toHaveBeenCalledTimes(3);
    polling.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event("online"));
    expect(refreshResources).toHaveBeenCalledTimes(3);
    expect(refreshPermissions).toHaveBeenCalledTimes(1);
  });
});
