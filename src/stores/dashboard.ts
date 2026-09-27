import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { config } from "../core/config";
import { preferences } from "../core/preferences";
import type { BackupTask, Guest, GuestDetails, NodeStatus, Pool, PowerAction, RawRecord, RawResource } from "../core/types";
import { t } from "../core/i18n";
import { requestConfirmation, showIpDialog } from "../composables/useDialogs";
import { showToast } from "../composables/useToast";
import { createDataService } from "../services/data-source";
import { createDashboardApi, type ReadResult } from "../services/dashboard-api";
import { exportGuestConfigs } from "../services/config-export";
import { createGuestCache } from "../services/guest-cache";
import { createSnapshotCache } from "../services/snapshot-cache";
import { TaskTimeoutError, waitForPowerTask } from "../services/power-tasks";
import { extractGuestIPs } from "../domain/guest-data";
import { guestVisible, normalizeGuest } from "../domain/resources";
import { hasPowerPermission as guestHasPowerPermission } from "../domain/permissions";

const dataService = createDataService();
const api = createDashboardApi(dataService.request);

function guestFingerprint(guest: Guest) {
  return `${guest.id}:${guest.node || ""}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

interface ReadSnapshot<T> {
  data: T | null;
  error: string | null;
  updatedAt: number | null;
}

type HardwareSnapshot = Map<string, {
  status: ReadSnapshot<NodeStatus>;
  disks: ReadSnapshot<RawRecord[]>;
  networks: ReadSnapshot<RawRecord[]>;
}>;
type BackupSnapshot = Map<string, ReadSnapshot<BackupTask[]>>;

function retainRead<T>(result: ReadResult<T>, previous?: ReadSnapshot<T>): ReadSnapshot<T> {
  return result.ok
    ? { data: result.data, error: null, updatedAt: Date.now() / 1000 }
    : { data: previous?.data ?? null, error: errorMessage(result.error), updatedAt: previous?.updatedAt ?? null };
}

function errorsFor<T>(snapshots: Map<string, ReadSnapshot<T>>): Map<string, ReadSnapshot<T>> {
  return new Map([...snapshots].filter(([, snapshot]) => snapshot.error !== null));
}

function resourceNodes(resources: RawResource[]) {
  return [...new Set(resources.filter((item) => item.type === "node").map((item) => item.node).filter((node): node is string => Boolean(node)))].sort();
}

export const useDashboardStore = defineStore("dashboard", () => {
  const resources = ref<RawResource[]>([]);
  const pools = ref<Pool[]>([]);
  const permissions = ref<Record<string, RawRecord>>({});
  const resourcesError = ref<string | null>(null);
  const poolsError = ref<string | null>(null);
  const permissionsError = ref<string | null>(null);
  const pendingActions = ref(new Map<string, PowerAction>());
  const detailCache = createGuestCache<GuestDetails>({
    fingerprint: guestFingerprint,
    load: api.guestConfig,
    errorValue: (error) => ({ _error: errorMessage(error) }),
  });
  const networkCache = createGuestCache<RawRecord | RawRecord[]>({
    fingerprint: (guest) => `${guestFingerprint(guest)}:${guest.status}`,
    load: api.guestNetwork,
    errorValue: (error) => ({ _error: errorMessage(error) }),
  });
  const filesystemCache = createGuestCache<RawRecord[]>({
    fingerprint: (guest) => `${guestFingerprint(guest)}:${guest.status}`,
    load: api.guestFilesystems,
    errorValue: () => [],
  });
  const guestFilesystems = filesystemCache.values;
  const guestDetails = detailCache.values;
  const guestDetailRequests = detailCache.loading;
  const guestNetworks = networkCache.values;
  const guestNetworkRequests = networkCache.loading;
  const backupCache = createSnapshotCache<BackupSnapshot>(async (previous) => {
    const nodes = resourceNodes(resources.value);
    const results = await Promise.allSettled(nodes.map(api.backups));
    return new Map(nodes.map((node, index) => {
      const result = results[index];
      const read: ReadResult<BackupTask[]> = result.status === "fulfilled"
        ? { ok: true, data: result.value }
        : { ok: false, error: result.reason };
      return [node, retainRead(read, previous?.get(node))];
    }));
  });
  const hardwareCache = createSnapshotCache<HardwareSnapshot>(async (previous) => {
    const results = await Promise.all(resourceNodes(resources.value).map(api.nodeDetails));
    return new Map(results.map((result) => {
      const prior = previous?.get(result.node);
      return [result.node, {
        status: retainRead(result.status, prior?.status),
        disks: retainRead(result.disks, prior?.disks),
        networks: retainRead(result.networks, prior?.networks),
      }];
    }));
  });
  const backups = computed(() => {
    const snapshot = backupCache.data.value;
    if (snapshot === null) return null;
    const rows = [...snapshot.values()];
    if (rows.length && rows.every((entry) => entry.data === null)) return null;
    return rows.flatMap((entry) => entry.data ?? [])
      .sort((a, b) => Number(b.endtime || b.starttime || 0) - Number(a.endtime || a.starttime || 0));
  });
  const backupErrors = computed(() => errorsFor(backupCache.data.value ?? new Map()));
  const backupsLoading = backupCache.loading;
  const hardwareRows = computed(() => [...(hardwareCache.data.value ?? [])]);
  const nodeStatus = computed(() => new Map(hardwareRows.value
    .filter(([, snapshot]) => snapshot.status.data !== null)
    .map(([node, snapshot]) => [node, snapshot.status.data as NodeStatus])));
  const nodeStatusErrors = computed(() => errorsFor(new Map(hardwareRows.value
    .map(([node, snapshot]) => [node, snapshot.status]))));
  const physicalDisks = computed<RawRecord[] | null>(() => {
    const snapshot = hardwareCache.data.value;
    if (snapshot === null) return null;
    const rows = hardwareRows.value;
    if (rows.length && rows.every(([, entry]) => entry.disks.data === null)) return null;
    return rows.flatMap(([node, entry]) => (entry.disks.data ?? []).map((item) => ({ ...item, node })));
  });
  const diskErrors = computed(() => errorsFor(new Map(hardwareRows.value
    .map(([node, snapshot]) => [node, snapshot.disks]))));
  const networks = computed<RawRecord[] | null>(() => {
    const snapshot = hardwareCache.data.value;
    if (snapshot === null) return null;
    const rows = hardwareRows.value;
    if (rows.length && rows.every(([, entry]) => entry.networks.data === null)) return null;
    return rows.flatMap(([node, entry]) => (entry.networks.data ?? []).map((item) => ({ ...item, node })));
  });
  const networkErrors = computed(() => errorsFor(new Map(hardwareRows.value
    .map(([node, snapshot]) => [node, snapshot.networks]))));
  const hardwareLoading = hardwareCache.loading;
  const expandedGuests = ref(preferences.getSet("expandedGuests"));
  const expandedNodes = ref(preferences.getSet("expandedNodes"));
  const expandedStorages = ref(preferences.getSet("expandedStorages"));
  const infrastructureOpen = ref(preferences.get("infrastructureOpen", true));
  const collapsedBlocks = ref(preferences.getSet("collapsedBlocks"));
  const virtualOpen = ref(preferences.get("virtualOpen", true));
  const collapsedPools = ref(preferences.getSet("collapsedPools"));
  const connected = ref(false);
  const refreshing = ref(false);
  const lastUpdated = ref<Date | null>(null);
  const isMock = dataService.isMock;
  let activeRefresh: Promise<void> | null = null;
  let lastAuxiliaryRefresh = 0;

  function replaceSet(target: typeof expandedGuests, value: Set<string>, key: "expandedGuests" | "expandedNodes" | "expandedStorages" | "collapsedBlocks" | "collapsedPools") {
    target.value = new Set(value);
    preferences.setSet(key, value);
  }

  function toggleSet(target: typeof expandedGuests, key: "expandedGuests" | "expandedNodes" | "expandedStorages" | "collapsedBlocks" | "collapsedPools", id: string) {
    const next = new Set(target.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    replaceSet(target, next, key);
    return next.has(id);
  }

  function toggleGuest(guest: Guest) {
    if (toggleSet(expandedGuests, "expandedGuests", guest.id)) {
      void filesystemCache.ensure(guest, true);
      void loadGuestDetails(guest);
      void loadGuestNetwork(guest);
    }
  }

  function toggleNode(name: string) { toggleSet(expandedNodes, "expandedNodes", name); }
  function toggleStorage(id: string) { toggleSet(expandedStorages, "expandedStorages", id); }
  function toggleBlock(key: string) { toggleSet(collapsedBlocks, "collapsedBlocks", key); }
  function togglePool(id: string) { toggleSet(collapsedPools, "collapsedPools", id); }
  function toggleInfrastructure() {
    infrastructureOpen.value = !infrastructureOpen.value;
    preferences.set("infrastructureOpen", infrastructureOpen.value);
  }
  function toggleVirtual() {
    virtualOpen.value = !virtualOpen.value;
    preferences.set("virtualOpen", virtualOpen.value);
  }

  async function refreshAll(options: { manual?: boolean; force?: boolean } = {}) {
    if (activeRefresh) {
      await activeRefresh;
      if (options.manual || options.force) return refreshAll(options);
      return;
    }
    const refresh = async () => {
      refreshing.value = true;
      try {
        const [resourcesResult, poolsResult] = await Promise.allSettled([api.resources(), api.pools()]);
        if (resourcesResult.status === "rejected") throw resourcesResult.reason;
        const previousNodes = resourceNodes(resources.value).join("\0");
        resources.value = resourcesResult.value;
        const nodesChanged = resourceNodes(resources.value).join("\0") !== previousNodes;
        resourcesError.value = null;
        if (poolsResult.status === "fulfilled") {
          pools.value = poolsResult.value;
          poolsError.value = null;
        } else {
          const message = errorMessage(poolsResult.reason);
          if (poolsError.value !== message) showToast(t("poolError", { message }), "warning");
          poolsError.value = message;
        }
        const guests = resources.value.filter((item) => item.type === "qemu" || item.type === "lxc").map(normalizeGuest)
          .filter((guest) => guestVisible(guest, config));
        void detailCache.reconcile(guests, options.manual);
        void networkCache.reconcile(guests, options.manual);
        void filesystemCache.reconcile(guests);
        for (const guest of guests) {
          if (config.metrics.disk && expandedGuests.value.has(guest.id)) void filesystemCache.ensure(guest, true);
          if (expandedGuests.value.has(guest.id)
            || (config.metrics.network && (guest.template || guest.status !== "running"))) {
            void detailCache.ensure(guest, options.manual || options.force);
          }
        }
        connected.value = true;
        lastUpdated.value = new Date();
        const physical = config.resources.physical;
        const refreshAuxiliary = options.manual || nodesChanged || Date.now() - lastAuxiliaryRefresh >= 60_000;
        if (refreshAuxiliary) lastAuxiliaryRefresh = Date.now();
        if (physical.show && physical.backups && (refreshAuxiliary || backups.value === null)) void loadBackups();
        if (physical.show && (physical.node || physical.disks || physical.network)
          && (refreshAuxiliary || physicalDisks.value === null || networks.value === null)) void loadPhysicalDetails();
        if (options.manual && poolsResult.status === "fulfilled") showToast(t("refreshed"), "success");
      } catch (error) {
        connected.value = false;
        resourcesError.value = errorMessage(error);
        showToast(t("connectError", { message: errorMessage(error) }), "error");
      } finally {
        refreshing.value = false;
      }
    };
    activeRefresh = refresh();
    try { await activeRefresh; }
    finally { activeRefresh = null; }
  }

  async function refreshPermissions() {
    try {
      permissions.value = await api.permissions();
      permissionsError.value = null;
    } catch (error) {
      permissions.value = {};
      permissionsError.value = errorMessage(error);
      showToast(t("permissionError", { message: errorMessage(error) }), "warning");
    }
  }

  function exportVmConfigs(onProgress: (done: number, total: number) => void) { return exportGuestConfigs(api, onProgress); }

  function loadPhysicalDetails() { return hardwareCache.refresh(resourceNodes(resources.value).join("\0")); }
  function loadBackups() { return backupCache.refresh(resourceNodes(resources.value).join("\0")); }

  function loadGuestDetails(guest: Guest, force = false) { return detailCache.ensure(guest, force); }
  function loadGuestNetwork(guest: Guest) { return networkCache.ensure(guest); }

  function hasPowerPermission(guest: Guest) {
    return guestHasPowerPermission(guest, permissions.value);
  }

  async function performAction(guest: Guest, action: PowerAction) {
    if (pendingActions.value.has(guest.id)) return;
    if (!hasPowerPermission(guest)) { showToast(t("powerDenied"), "warning"); return; }
    if (config.app.controls.confirm?.[action]) {
      const confirmed = await requestConfirmation({ title: t(action), message: t("confirmAction", { name: guest.name, vmid: guest.vmid, action: t(action) }) });
      if (!confirmed || pendingActions.value.has(guest.id)) return;
    }
    pendingActions.value = new Map(pendingActions.value).set(guest.id, action);
    try {
      const task = await api.powerAction(guest, action);
      await waitForPowerTask(api, guest, task);
      showToast(t("completed", { name: guest.name, action: t(action) }), "success");
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      const message = error instanceof TaskTimeoutError ? t("taskTimeout") : errorMessage(error);
      showToast(`${guest.name}：${message}${status && !message.includes(String(status)) ? ` (${status})` : ""}`, "error");
      if (status === 403) await refreshPermissions();
    } finally {
      const next = new Map(pendingActions.value);
      next.delete(guest.id);
      pendingActions.value = next;
      await refreshAll({ force: true });
    }
  }

  function showGuestIPs(guest: Guest) {
    const ips = extractGuestIPs(guestNetworks.value.get(guest.id), guestDetails.value.get(guest.id));
    showIpDialog({ title: `${t("ipAddress")} · ${guest.name}`, ips });
  }

  return {
    resources, pools, permissions, resourcesError, poolsError, permissionsError,
    pendingActions, guestFilesystems, guestDetails, guestDetailRequests, guestNetworks, guestNetworkRequests,
    backups, backupErrors, backupsLoading, nodeStatus, nodeStatusErrors, physicalDisks, diskErrors, networks, networkErrors, hardwareLoading,
    expandedGuests, expandedNodes, expandedStorages, infrastructureOpen, collapsedBlocks, virtualOpen, collapsedPools,
    connected, refreshing, lastUpdated, isMock,
    toggleGuest, toggleNode, toggleStorage, toggleBlock, toggleInfrastructure, toggleVirtual, togglePool,
    refreshAll, refreshPermissions, exportVmConfigs, loadPhysicalDetails, loadBackups, loadGuestDetails, loadGuestNetwork,
    hasPowerPermission, performAction, showGuestIPs,
  };
});
