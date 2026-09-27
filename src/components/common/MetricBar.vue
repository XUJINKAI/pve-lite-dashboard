<script setup lang="ts">
import { computed } from "vue";
import { clampRatio } from "../../core/format";
import { config } from "../../core/config";
import { heatClass } from "../../domain/metrics";

const props = withDefaults(defineProps<{
  label: string;
  mobileLabel?: string;
  value: string;
  fillFraction: number;
  resource?: string;
  stateClass?: string;
  compact?: boolean;
}>(), { resource: "generic", stateClass: "", compact: false });
const barClass = computed(() => `${heatClass(props.fillFraction, props.resource, config.resourceBars?.[props.resource])}${props.stateClass ? ` ${props.stateClass}` : ""}`);
</script>

<template>
  <div :class="compact ? 'mini-metric guest-resource' : 'metric'">
    <div :class="compact ? 'mini-head' : 'metric-head'">
      <span class="metric-label"><span :class="{ 'desktop-metric-label': mobileLabel }">{{ label }}</span><span v-if="mobileLabel" class="mobile-metric-label">{{ mobileLabel }}</span></span><strong :class="compact ? '' : 'metric-value'">{{ value }}</strong>
    </div>
    <div class="progress">
      <span class="progress-bar" :class="barClass" :style="{ '--value': `${clampRatio(fillFraction) * 100}%` }" />
    </div>
  </div>
</template>
