import { computed, type Ref } from "vue";
import { config } from "../core/config";
import { locale, t } from "../core/i18n";
import { groupGuests } from "../domain/groups";
import { guestVisible, normalizeGuest, normalizeNode, normalizeStorage, resourceVisible } from "../domain/resources";
import type { useDashboardStore } from "../stores/dashboard";

export function useDashboardView(store: ReturnType<typeof useDashboardStore>, nowTick: Ref<number>) {
  const nodes = computed(() => store.resources
    .filter((item) => item.type === "node")
    .map(normalizeNode)
    .filter((item) => resourceVisible(item, "node", config)));
  const storages = computed(() => store.resources
    .filter((item) => item.type === "storage")
    .map(normalizeStorage)
    .filter((item) => resourceVisible(item, "storage", config))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true })));
  const guests = computed(() => store.resources
    .filter((item) => item.type === "qemu" || item.type === "lxc")
    .map(normalizeGuest)
    .filter((guest) => guestVisible(guest, config)));
  const groups = computed(() => {
    void locale.value;
    return groupGuests(guests.value, store.pools, store.permissions, {
      unassignedPosition: config.resources.pool?.unassignedPosition || "first",
      unassignedTitle: t("unassigned"),
      templatesTitle: t("templates"),
    });
  });
  const runningGuests = computed(() => guests.value.filter((guest) => guest.status === "running").length);
  const lastUpdated = computed(() => {
    if (!config.app.showLastUpdated || !store.lastUpdated) return "";
    const seconds = Math.max(0, Math.floor((nowTick.value - store.lastUpdated.getTime()) / 1000));
    if (seconds < 3) return t("justNow");
    if (seconds < 60) return t("secondsAgo", { n: seconds });
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? t("minutesAgo", { n: minutes }) : t("hoursAgo", { n: Math.floor(minutes / 60) });
  });

  return { nodes, storages, guests, groups, runningGuests, lastUpdated };
}
