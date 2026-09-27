<script setup lang="ts">
const props = defineProps<{ action: string }>();
const paths: Record<string, string[]> = {
  start: ["M12 2v10", "M6.2 5.3a8 8 0 1 0 11.6 0"],
  resume: ["M12 2v10", "M6.2 5.3a8 8 0 1 0 11.6 0"],
  shutdown: ["M12 2v10", "M6.2 5.3a8 8 0 1 0 11.6 0"],
  stop: ["M6 6h12v12H6z"],
  reboot: ["M20 11a8 8 0 0 0-14.9-3.9L3 10", "M3 5v5h5"],
  suspend: ["M7 5v14", "M17 5v14"],
  menu: ["M7 10l5 5 5-5"],
};
</script>

<template>
  <span class="action-icon" :class="props.action"><svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="path in (paths[props.action] || paths.start)" :key="path" :d="path" /></svg></span>
</template>
