<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../core/i18n";

const props = defineProps<{ status: string }>();
const labels: Record<string, string> = {
  running: "statusRunning", stopped: "statusStopped", suspended: "statusSuspended", template: "statusTemplate", online: "statusOnline", offline: "statusOffline", unknown: "statusUnknown",
};
const label = computed(() => t(labels[props.status] || "statusUnknown"));
</script>

<template>
  <span class="badge" :class="status"><span class="status-icon" :class="status" />{{ label }}</span>
</template>
