<script setup lang="ts">
defineProps<{ label: string; value: string }>();
</script>

<template><span class="detail-item"><small>{{ label }}</small><strong>{{ value }}</strong></span></template>
