<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../core/i18n";
import { config } from "../../core/config";
import { formatBytes, ratio } from "../../core/format";
import type { StorageResource } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import MetricBar from "../common/MetricBar.vue";
import DetailItem from "../common/DetailItem.vue";

const props = defineProps<{ storage: StorageResource }>();
const store = useDashboardStore();
const key = computed(() => props.storage.id || props.storage.name);
const expanded = computed(() => store.expandedStorages.has(key.value));
</script>

<template>
  <article class="storage-row" :class="{ expanded }"><button class="storage-summary" type="button" :aria-expanded="expanded" @click="store.toggleStorage(key)"><span class="disclosure-icon" aria-hidden="true" /><span class="compact-title"><strong>{{ storage.name }}</strong></span><MetricBar v-if="config.metrics.disk" :label="t('capacity')" :value="`${formatBytes(storage.disk)} / ${formatBytes(storage.maxdisk)}`" :fill-fraction="ratio(storage.disk, storage.maxdisk)" /></button><div v-if="expanded" class="storage-details"><DetailItem :label="t('content')" :value="storage.content || '—'" /><DetailItem v-if="config.metrics.node" :label="t('node')" :value="storage.node || t('cluster')" /><DetailItem v-if="config.metrics.status" :label="t('statusLabel')" :value="storage.status || '—'" /></div></article>
</template>
