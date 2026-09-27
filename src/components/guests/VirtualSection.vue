<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../core/i18n";
import { config } from "../../core/config";
import type { Group } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import PoolSection from "./PoolSection.vue";

defineProps<{ groups: Group[]; running: number; total: number; isMock: boolean }>();
const store = useDashboardStore();
const open = computed(() => store.virtualOpen);
</script>

<template>
  <section id="virtual-section" class="area virtual-area" :class="{ hidden: !config.resources.virtual.show || (!groups.some((group) => group.guests.length) && !groups.length) }">
    <div class="area-heading">
      <button id="virtual-title-toggle" class="heading-click-target area-heading-title" type="button" :aria-expanded="open" aria-controls="guest-groups" @click="store.toggleVirtual()"><strong>{{ t('virtual') }}</strong></button>
      <button id="virtual-toggle" class="heading-click-target area-heading-meta" type="button" :aria-expanded="open" aria-controls="guest-groups" @click="store.toggleVirtual()"><span id="virtual-meta">{{ t('guestTotal', { running, total }) }}{{ isMock ? ` · ${t('mock')}` : '' }}</span><span class="disclosure-icon" aria-hidden="true" /></button>
    </div>
    <div id="guest-groups" v-show="open"><PoolSection v-for="group in groups" :key="group.id" :group="group" /></div>
  </section>
</template>
