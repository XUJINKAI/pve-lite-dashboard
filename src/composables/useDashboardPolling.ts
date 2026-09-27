import { ref } from "vue";
import type { DashboardConfig } from "../core/config";

interface PollingCallbacks {
  refreshResources: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

export function useDashboardPolling(settings: DashboardConfig["app"], callbacks: PollingCallbacks) {
  const nowTick = ref(Date.now());
  let active = false;
  let resourceTimer: number | undefined;
  let permissionTimer: number | undefined;
  let relativeTimer: number | undefined;

  function scheduleResources() {
    if (resourceTimer !== undefined) window.clearTimeout(resourceTimer);
    const seconds = document.hidden ? settings.hiddenRefreshInterval : settings.refreshInterval;
    const interval = Number(seconds);
    if (!active || !Number.isFinite(interval) || interval <= 0) return;
    resourceTimer = window.setTimeout(async () => {
      await callbacks.refreshResources();
      scheduleResources();
    }, Math.max(1000, interval * 1000));
  }

  function schedulePermissions() {
    if (permissionTimer !== undefined) window.clearTimeout(permissionTimer);
    const interval = Number(settings.permissionsRefreshInterval) || 300;
    if (!active) return;
    permissionTimer = window.setTimeout(async () => {
      await callbacks.refreshPermissions();
      schedulePermissions();
    }, Math.max(30_000, interval * 1000));
  }

  function handleVisibility() {
    scheduleResources();
    if (!document.hidden && Number(settings.refreshInterval) > 0) void callbacks.refreshResources();
  }

  function handleOnline() { void callbacks.refreshResources(); }

  async function start() {
    if (active) return;
    active = true;
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    relativeTimer = window.setInterval(() => { nowTick.value = Date.now(); }, 1000);
    await Promise.allSettled([callbacks.refreshPermissions(), callbacks.refreshResources()]);
    if (active) {
      scheduleResources();
      schedulePermissions();
    }
  }

  function stop() {
    active = false;
    if (resourceTimer !== undefined) window.clearTimeout(resourceTimer);
    if (permissionTimer !== undefined) window.clearTimeout(permissionTimer);
    if (relativeTimer !== undefined) window.clearInterval(relativeTimer);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("online", handleOnline);
  }

  return { nowTick, start, stop };
}
