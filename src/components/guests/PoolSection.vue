<script setup lang="ts">
import { computed, useId } from "vue";
import { t } from "../../core/i18n";
import type { Group } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import GuestCard from "./GuestCard.vue";

const props = defineProps<{ group: Group }>();
const store = useDashboardStore();
const open = computed(() => !store.collapsedPools.has(props.group.id));
const contentId = useId();
</script>

<template>
  <section class="pool-section">
    <button class="pool-heading" type="button" :aria-expanded="open" :aria-controls="contentId" @click="store.togglePool(group.id)">
      <span class="pool-title"><h2>{{ group.title }}</h2><span class="count-pill">{{ group.guests.length }}</span></span>
      <span class="pool-heading-meta"><span v-if="group.description" class="pool-description">{{ group.description }}</span><span class="disclosure-icon" aria-hidden="true" /></span>
    </button>
    <div :id="contentId" v-show="open">
      <div v-if="!group.guests.length" class="empty-inline" :class="{ 'permission-warning': group.readable === false }">{{ group.readable === false ? t('poolAuditWarning') : t('emptyPool') }}</div>
      <div v-else class="guest-list"><GuestCard v-for="guest in group.guests" :key="guest.id" :guest="guest" /></div>
    </div>
  </section>
</template>
