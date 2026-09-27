<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { config } from "./core/config";
import { initI18n, t, locale } from "./core/i18n";
import { useDashboardStore } from "./stores/dashboard";
import { permissionsDialogOpen, settingsDialogOpen } from "./composables/useDialogs";
import { useDashboardPolling } from "./composables/useDashboardPolling";
import { useDashboardView } from "./composables/useDashboardView";
import { useOverflowTitles } from "./composables/useOverflowTitles";
import TopBar from "./components/layout/TopBar.vue";
import InfrastructureSection from "./components/infrastructure/InfrastructureSection.vue";
import VirtualSection from "./components/guests/VirtualSection.vue";
import Dialogs from "./components/common/Dialogs.vue";
import SettingsDialog from "./components/common/SettingsDialog.vue";
import ToastContainer from "./components/common/ToastContainer.vue";

const store = useDashboardStore();
const polling = useDashboardPolling(config.app, {
  refreshResources: store.refreshAll,
  refreshPermissions: store.refreshPermissions,
});
const { nodes, storages, guests, groups, runningGuests, lastUpdated } = useDashboardView(store, polling.nowTick);
const pageTitle = `${config.app.title || "PVE"}${store.isMock ? " (demo)" : ""}`;
useOverflowTitles();

onMounted(() => {
  initI18n(config.app.language);
  document.title = pageTitle;
  void polling.start();
});
onBeforeUnmount(polling.stop);
</script>

<template>
  <div class="shell" :key="locale">
    <TopBar :title="pageTitle" :is-mock="store.isMock" :connected="store.connected" :refreshing="store.refreshing" :last-updated="lastUpdated" @refresh="store.refreshAll({ manual: true })" @permissions="permissionsDialogOpen = true" @settings="settingsDialogOpen = true" />
    <main id="app">
      <InfrastructureSection :nodes="nodes" :storages="storages" />
      <VirtualSection :groups="groups" :running="runningGuests" :total="guests.length" :is-mock="store.isMock" />
      <section id="empty-state" class="empty" :class="{ hidden: !config.resources.virtual.show || guests.length > 0 || !store.connected }"><div class="empty-icon" aria-hidden="true">◇</div><h2>{{ t("noGuests") }}</h2><p>{{ t("emptyHelp") }}</p></section>
    </main>
  </div>
  <ToastContainer />
  <Dialogs :permissions="store.permissions" />
  <SettingsDialog />
</template>
