<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../core/i18n";
import { config } from "../../core/config";
import { formatBytes, formatDateTime, formatDuration, formatPercent, ratio } from "../../core/format";
import type { NodeResource } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import StatusBadge from "../common/StatusBadge.vue";
import MetricBar from "../common/MetricBar.vue";
import DetailItem from "../common/DetailItem.vue";

const props = defineProps<{ node: NodeResource }>();
const store = useDashboardStore();
const expanded = computed(() => store.expandedNodes.has(props.node.name));
const details = computed(() => store.nodeStatus.get(props.node.name));
const detailIssue = computed(() => store.nodeStatusErrors.get(props.node.name));
</script>

<template>
  <article class="compact-card node-card" :class="{ expanded }">
    <button class="compact-head node-toggle" type="button" :aria-expanded="expanded" @click="store.toggleNode(node.name)"><span class="disclosure-icon" aria-hidden="true" /><span class="compact-title"><strong>{{ node.name }}</strong><span v-if="config.metrics.uptime" class="node-uptime">{{ t("runningFor", { value: formatDuration(node.uptime) }) }}</span></span><StatusBadge v-if="config.metrics.status" :status="node.status" /></button>
    <div v-if="config.metrics.cpu || config.metrics.memory" class="compact-metrics"><MetricBar v-if="config.metrics.cpu" :label="t('cpu')" :value="`${formatPercent(node.cpu)} · ${t('cores', { n: node.maxcpu || '—' })}`" :fill-fraction="node.cpu" resource="cpu" /><MetricBar v-if="config.metrics.memory" :label="t('memory')" :value="`${formatBytes(node.mem)} / ${formatBytes(node.maxmem)}`" :fill-fraction="ratio(node.mem, node.maxmem)" resource="memory" /></div>
    <div v-if="config.metrics.load && node.load" class="meta-line"><span>{{ t("load") }} {{ Array.isArray(node.load) ? node.load.join(' · ') : node.load }}</span></div>
    <div v-if="expanded" class="node-details">
      <span v-if="detailIssue" class="loading-line" role="status">{{ t("readFailed", { message: detailIssue.error || '' }) }}<template v-if="detailIssue.updatedAt"> · {{ t("lastSuccessfulRead", { time: formatDateTime(detailIssue.updatedAt) }) }}</template></span>
      <span v-if="!details && !detailIssue" class="loading-line">{{ t("loadingNode") }}</span>
      <template v-if="details"><DetailItem v-if="config.metrics.cpu" :label="t('processor')" :value="details.cpuinfo?.model || '—'" /><DetailItem v-if="config.metrics.cpu" :label="t('topology')" :value="t('topologyValue', { sockets: details.cpuinfo?.sockets || '—', cores: details.cpuinfo?.cores || '—', threads: details.cpuinfo?.cpus || '—' })" /><DetailItem label="PVE" :value="details.pveversion || '—'" /><DetailItem :label="t('kernel')" :value="details['current-kernel']?.release || '—'" /><DetailItem v-if="config.metrics.disk" :label="t('systemDisk')" :value="details.rootfs?.total ? `${formatBytes(details.rootfs.used)} / ${formatBytes(details.rootfs.total)}` : '—'" /><DetailItem v-if="config.metrics.memory" :label="t('swap')" :value="details.swap?.total ? `${formatBytes(details.swap.used)} / ${formatBytes(details.swap.total)}` : '—'" /><DetailItem v-if="config.metrics.load" :label="t('load')" :value="Array.isArray(details.loadavg) ? details.loadavg.join(' · ') : '—'" /><DetailItem v-if="config.metrics.memory" :label="t('ksm')" :value="details.ksm?.shared ? formatBytes(details.ksm.shared) : '—'" /></template>
    </div>
  </article>
</template>
