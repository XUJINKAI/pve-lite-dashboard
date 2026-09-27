<script setup lang="ts">
import { computed } from "vue";
import { config } from "../../core/config";
import { t } from "../../core/i18n";
import { formatDateTime } from "../../core/format";
import { useMasonryLayout } from "../../composables/useMasonryLayout";
import type { NodeResource, RawRecord, StorageResource } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import DiskCard from "./DiskCard.vue";
import NodeCard from "./NodeCard.vue";
import StorageRow from "./StorageRow.vue";
import StatusBadge from "../common/StatusBadge.vue";
import DetailItem from "../common/DetailItem.vue";

const props = defineProps<{ nodes: NodeResource[]; storages: StorageResource[] }>();
const store = useDashboardStore();
const masonry = useMasonryLayout();
const physical = config.resources.physical;
const hasBlocks = computed(() => physical.show && (props.nodes.length > 0 || props.storages.length > 0 || physical.disks || physical.network || physical.backups));
function blockEnabled(block: string) { return block === "networks" ? physical.network : block === "disks" ? physical.disks : physical.backups; }
const detailBlocks = ["disks", "networks", "backups"].filter(blockEnabled);
const open = computed(() => store.infrastructureOpen);
const isCollapsed = (key: string) => store.collapsedBlocks.has(key);
const diskList = computed(() => [...(store.physicalDisks || [])].sort((a, b) => String(a.devpath).localeCompare(String(b.devpath), "zh-CN", { numeric: true })));
const networkList = computed(() => [...(store.networks || [])].filter((item) => item.iface).sort((a, b) => String(a.iface).localeCompare(String(b.iface), "zh-CN", { numeric: true })));
function networkUp(network: RawRecord) { return Number(network.active) === 1; }
const networkMeta = computed(() => `${networkList.value.filter(networkUp).length}/${networkList.value.length}`);
const latestBackup = computed(() => store.backups?.find((task) => task.status === "OK" && (task.endtime || task.starttime)));
function displayValue(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? value : '—'; }
function issueText(issues: Map<string, { error: string | null; updatedAt: number | null }>) {
  return [...issues].map(([node, issue]) => `${node}: ${issue.error}${issue.updatedAt ? ` · ${t("lastSuccessfulRead", { time: formatDateTime(issue.updatedAt) })}` : ""}`).join("; ");
}
</script>

<template>
  <section id="infrastructure-section" class="area" :class="{ hidden: !hasBlocks }">
    <div class="area-heading">
      <button id="infrastructure-title-toggle" class="heading-click-target area-heading-title" type="button" :aria-expanded="open" aria-controls="infrastructure-content" @click="store.toggleInfrastructure()"><strong>{{ t("infrastructure") }}</strong></button>
      <button id="infrastructure-toggle" class="heading-click-target area-heading-meta" type="button" :aria-expanded="open" aria-controls="infrastructure-content" @click="store.toggleInfrastructure()"><span>{{ t("nodeStorage", { nodes: nodes.length, storages: storages.length }) }}</span><span class="disclosure-icon" aria-hidden="true" /></button>
    </div>
    <div id="infrastructure-content" ref="masonry" class="area-content" :class="{ collapsed: !open }">
      <div v-if="physical.node && nodes.length" class="resource-block"><button class="block-title" type="button" :aria-expanded="!isCollapsed('nodes')" @click="store.toggleBlock('nodes')"><span class="block-title-heading"><h2>{{ t("nodes") }}</h2></span><span class="block-title-meta"><span class="count-pill">{{ nodes.length }}</span><span class="disclosure-icon" aria-hidden="true" /></span></button><div class="node-grid collapsible" :class="{ collapsed: isCollapsed('nodes') }"><NodeCard v-for="node in nodes" :key="node.name" :node="node" /></div></div>
      <div v-if="physical.storage && storages.length" class="resource-block"><button class="block-title" type="button" :aria-expanded="!isCollapsed('storages')" @click="store.toggleBlock('storages')"><span class="block-title-heading"><h2>{{ t("storage") }}</h2></span><span class="block-title-meta"><span class="count-pill">{{ storages.length }}</span><span class="disclosure-icon" aria-hidden="true" /></span></button><div class="storage-list collapsible" :class="{ collapsed: isCollapsed('storages') }"><StorageRow v-for="storage in storages" :key="storage.id || storage.name" :storage="storage" /></div></div>
      <div v-for="block in detailBlocks" :key="block" class="resource-block">
        <button class="block-title" type="button" :aria-expanded="!isCollapsed(block)" @click="store.toggleBlock(block)">
          <span class="block-title-heading"><h2>{{ block === 'disks' ? t('physicalDisks') : block === 'networks' ? t('network') : t('backups') }}</h2></span>
          <span class="block-title-meta"><span v-if="block === 'backups'" class="block-meta-date">{{ store.backups === null ? t(store.backupErrors.size ? 'readFailedShort' : 'loading') : latestBackup ? formatDateTime(latestBackup.endtime || latestBackup.starttime) : '—' }}</span><span v-else class="count-pill">{{ block === 'disks' ? (store.physicalDisks === null ? t(store.diskErrors.size ? 'readFailedShort' : 'loading') : diskList.length) : (store.networks === null ? t(store.networkErrors.size ? 'readFailedShort' : 'loading') : networkMeta) }}</span><span class="disclosure-icon" aria-hidden="true" /></span>
        </button>
        <div v-if="block === 'disks'" class="device-list collapsible" :class="{ collapsed: isCollapsed(block) }">
          <div v-if="store.diskErrors.size" class="empty-inline" role="status">{{ t("readFailed", { message: issueText(store.diskErrors) }) }}</div>
          <div v-if="store.physicalDisks === null && (!store.diskErrors.size || store.hardwareLoading)" class="loading-line">{{ t("loadingDisks") }}</div>
          <DiskCard v-for="disk in diskList" :key="`${disk.node}-${disk.devpath}`" :disk="disk" />
        </div>
        <div v-else-if="block === 'networks'" class="device-list collapsible" :class="{ collapsed: isCollapsed(block) }">
          <div v-if="store.networkErrors.size" class="empty-inline" role="status">{{ t("readFailed", { message: issueText(store.networkErrors) }) }}</div>
          <div v-if="store.networks === null && (!store.networkErrors.size || store.hardwareLoading)" class="loading-line">{{ t("loadingNetwork") }}</div>
          <article v-for="network in networkList" :key="`${network.node}-${network.iface}`" class="device-row network-row"><strong>{{ network.iface }}</strong><StatusBadge :status="networkUp(network) ? 'online' : 'offline'" /><span class="network-type">{{ network.type || '—' }}</span><span class="network-address">{{ network.cidr || network.address || '—' }}</span><span class="network-context">{{ network.bridge_ports ? t('bridge', { value: displayValue(network.bridge_ports) }) : network.comments || network.node }}</span></article>
        </div>
        <div v-else class="backup-panel collapsible" :class="{ collapsed: isCollapsed(block) }">
          <div v-if="store.backupErrors.size" class="empty-inline" role="status">{{ t("readFailed", { message: issueText(store.backupErrors) }) }}</div>
          <div v-if="store.backupsLoading || (store.backups === null && !store.backupErrors.size)" class="loading-line">{{ t("loadingBackups") }}</div>
          <div v-else-if="store.backups !== null" class="backup-summary"><DetailItem :label="t('latestBackupTime')" :value="latestBackup ? formatDateTime(latestBackup.endtime || latestBackup.starttime) : t('noRecord')" /></div>
        </div>
      </div>
    </div>
  </section>
</template>
