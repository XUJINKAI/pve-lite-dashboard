<script setup lang="ts">
import { computed } from "vue";
import { guestConfigDialog } from "../../composables/useDialogs";
import { config } from "../../core/config";
import { t } from "../../core/i18n";
import { formatBytes, formatDuration } from "../../core/format";
import { extractDisks, formatFilesystemUsage } from "../../domain/guest-data";
import type { Guest } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import DetailItem from "../common/DetailItem.vue";
import PowerActions from "../common/PowerActions.vue";

const props = defineProps<{ guest: Guest }>();
const store = useDashboardStore();
const details = computed(() => store.guestDetails.get(props.guest.id));
const filesystemUsage = computed(() => formatFilesystemUsage(store.guestFilesystems.get(props.guest.id)));
const diskConfig = computed(() => extractDisks(details.value));
const diskValue = computed(() => filesystemUsage.value !== "—" ? filesystemUsage.value
  : diskConfig.value.length ? diskConfig.value.map((disk) => `${disk.name} ${formatBytes(disk.size)}`).join(" · ") : "—");
const diskLabel = computed(() => t(filesystemUsage.value !== "—" ? "filesystemUsage" : "diskCapacity"));
</script>

<template>
  <div class="guest-details">
    <div class="detail-info">
      <DetailItem v-if="config.metrics.type" :label="t('type')" :value="guest.type.toUpperCase()" />
      <DetailItem v-if="config.metrics.node" :label="t('node')" :value="guest.node || '—'" />
      <DetailItem v-if="config.metrics.uptime" :label="t('uptime')" :value="guest.status === 'running' && !guest.template ? formatDuration(guest.uptime) : '—'" />
      <DetailItem v-if="config.metrics.disk" :label="diskLabel" :value="diskValue" />
      <DetailItem v-if="config.metrics.disk" :label="t('diskIO')" :value="t('diskIOValue', { read: formatBytes(guest.diskread), write: formatBytes(guest.diskwrite) })" />
      <DetailItem v-if="config.metrics.network" :label="t('networkTraffic')" :value="`↓ ${formatBytes(guest.netin)} · ↑ ${formatBytes(guest.netout)}`" />
      <DetailItem v-if="config.metrics.memory" :label="t('hostMemory')" :value="guest.memhost ? formatBytes(guest.memhost) : '—'" />
      <button class="config-link" type="button" @click="guestConfigDialog = guest">{{ t('allConfig') }}</button>
    </div>
    <PowerActions :guest="guest" />
    <div v-if="config.app.controls.show && !store.hasPowerPermission(guest)" class="permission-note">{{ t("noPower") }}</div>
  </div>
</template>
