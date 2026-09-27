<script setup lang="ts">
import { toastItems } from "../../composables/useToast";
</script>

<template>
  <div class="toast-root" aria-live="polite" aria-atomic="true">
    <div v-for="item in toastItems" :key="item.id" class="toast" :class="item.type">{{ item.message }}</div>
  </div>
</template>
