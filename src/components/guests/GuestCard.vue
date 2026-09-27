<script setup lang="ts">
import { computed, onMounted } from "vue";
import { config } from "../../core/config";
import { t } from "../../core/i18n";
import { formatBytes, formatPercent, memoryUsageRatio } from "../../core/format";
import { extractGuestIPs } from "../../domain/guest-data";
import type { Guest } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import StatusBadge from "../common/StatusBadge.vue";
import MetricBar from "../common/MetricBar.vue";
import GuestDetails from "./GuestDetails.vue";

const props = defineProps<{ guest: Guest }>();
const store = useDashboardStore();
const expanded = computed(() => store.expandedGuests.has(props.guest.id));
const displayStatus = computed(() => props.guest.template ? "template" : props.guest.status);
const stateDisplay = computed(() => config.vmStateDisplay?.[displayStatus.value] || config.vmStateDisplay?.stopped || { showCpu: false, showMemory: false });
const showCpu = computed(() => config.metrics.cpu && stateDisplay.value.showCpu !== false);
const showMemory = computed(() => config.metrics.memory && stateDisplay.value.showMemory !== false);
const ips = computed(() => extractGuestIPs(store.guestNetworks.get(props.guest.id), store.guestDetails.get(props.guest.id)));
const ipValue = computed(() => ips.value.length ? ips.value
  : store.guestNetworkRequests.has(props.guest.id) || store.guestDetailRequests.has(props.guest.id) ? t("reading") : ips.value);
const ipSummary = computed(() => ips.value.slice(0, 2).join(", "));

onMounted(() => { if (config.metrics.network) void store.loadGuestNetwork(props.guest); });
function toggle() { store.toggleGuest(props.guest); }
function showIps() { store.showGuestIPs(props.guest); }
</script>

<template>
  <article class="guest-card" :class="{ expanded }">
    <button class="guest-summary" type="button" :aria-expanded="expanded" @click="toggle">
      <span class="disclosure-icon" aria-hidden="true" />
      <span class="guest-primary"><span class="guest-vmid"><strong v-if="config.metrics.vmid">#{{ guest.vmid }}</strong></span><span class="guest-identity"><span class="identity-copy"><strong :title="guest.name">{{ guest.name }}</strong></span></span></span>
      <span class="guest-secondary"><StatusBadge v-if="config.metrics.status" :status="displayStatus" /><span v-else class="guest-status-placeholder" /><span class="guest-ip-cell detail-item guest-ip"><template v-if="config.metrics.network"><small>{{ t('ipAddress') }}</small><strong class="ip-value"><span v-if="typeof ipValue === 'string'">{{ ipValue }}</span><span v-else-if="!ipValue.length">—</span><span v-else class="ip-stack" role="button" tabindex="0" aria-haspopup="dialog" :aria-label="`${t('ipAddress')} · ${guest.name}`" @click.stop="showIps" @keydown.enter.stop.prevent="showIps" @keydown.space.stop.prevent="showIps" @keyup.space.stop.prevent><span class="ip-addresses desktop-ip-addresses" :title="ips.join(', ')">{{ ipSummary }}</span><span class="ip-addresses mobile-ip-addresses" :title="ips.join(', ')">{{ ips[0] }}</span><span v-if="ips.length > 1" class="ip-more" :class="{ 'mobile-only': ips.length === 2 }" aria-hidden="true"> ...</span></span></strong></template></span></span>
      <span class="guest-metrics"><MetricBar v-if="showCpu" class="guest-cpu" :label="`${t('cpu')} · ${t('cores', { n: guest.maxcpu || '—' })}`" :value="formatPercent(guest.cpu)" :fill-fraction="guest.cpu" resource="cpu" compact /><span v-else class="guest-resource-placeholder guest-resource guest-cpu" /><MetricBar v-if="showMemory" class="guest-memory" :label="t('memory')" :value="guest.maxmem ? `${formatBytes(guest.mem)} / ${formatBytes(guest.maxmem)}` : '—'" :fill-fraction="memoryUsageRatio(guest.mem, guest.maxmem)" resource="memory" :state-class="stateDisplay.memoryColor === 'paused' ? 'paused' : ''" compact /><span v-else class="guest-resource-placeholder guest-resource guest-memory" /></span>
    </button>
    <GuestDetails v-if="expanded" :guest="guest" />
  </article>
</template>
