<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { guestConfigDialog } from "../../composables/useDialogs";
import { formatGuestConfig } from "../../domain/guest-data";
import { t } from "../../core/i18n";
import { useDashboardStore } from "../../stores/dashboard";

const store = useDashboardStore();
const dialogElement = ref<HTMLDialogElement | null>(null);
const details = computed(() => guestConfigDialog.value ? store.guestDetails.get(guestConfigDialog.value.id) : undefined);
const loading = computed(() => guestConfigDialog.value && store.guestDetailRequests.has(guestConfigDialog.value.id));
const text = computed(() => formatGuestConfig(details.value || {}));
function close() { guestConfigDialog.value = null; }
function refresh() { if (guestConfigDialog.value) void store.loadGuestDetails(guestConfigDialog.value, true); }
watch(guestConfigDialog, async (guest) => {
  if (guest) void store.loadGuestDetails(guest);
  await nextTick();
  if (guestConfigDialog.value) dialogElement.value?.showModal();
  else dialogElement.value?.close();
});
</script>

<template>
  <dialog id="guest-config-dialog" ref="dialogElement" aria-labelledby="guest-config-title" @click.self="close" @cancel="close" @close="close">
    <form method="dialog" class="dialog-card config-dialog-card" @submit="close">
      <h3 id="guest-config-title">{{ t('allConfig') }} · {{ guestConfigDialog?.name }} #{{ guestConfigDialog?.vmid }}</h3>
      <div v-if="loading || !details" class="empty-inline" role="status">{{ t('reading') }}</div>
      <div v-else-if="details._error" class="empty-inline" role="status">{{ t('readFailed', { message: String(details._error) }) }}</div>
      <pre v-else class="config-text">{{ text || '—' }}</pre>
      <div class="dialog-actions">
        <button class="btn secondary" type="button" :disabled="Boolean(loading)" @click="refresh">{{ t('refresh') }}</button>
        <button class="btn secondary" type="submit">{{ t('close') }}</button>
      </div>
    </form>
  </dialog>
</template>
