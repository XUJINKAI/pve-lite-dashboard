<script setup lang="ts">
import { computed, ref } from "vue";
import type { RawRecord } from "../../core/types";
import { formatBytes } from "../../core/format";
import { t } from "../../core/i18n";
import { diskSmartInfo } from "../../domain/disk-data";
import DetailItem from "../common/DetailItem.vue";

const props = defineProps<{ disk: RawRecord }>();
const expanded = ref(false);
const smart = computed(() => diskSmartInfo(props.disk));
const life = computed(() => typeof props.disk.wearout === "number" && props.disk.wearout >= 0 ? t("life", { value: props.disk.wearout }) : "—");
</script>

<template>
  <article class="disk-card">
    <button class="disk-summary" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="disclosure-icon" aria-hidden="true" />
      <strong :title="String(disk.model || disk.devpath || '')">{{ disk.model || disk.devpath || t('disk') }}</strong>
      <span class="disk-size">{{ disk.size ? formatBytes(disk.size) : '—' }}</span>
      <span class="disk-life">{{ life }}</span>
      <span class="disk-temperature">{{ smart.temperature }}</span>
    </button>
    <div v-if="expanded" class="disk-details">
      <div class="detail-info">
        <DetailItem :label="t('node')" :value="String(disk.node || '—')" />
        <DetailItem :label="t('type')" :value="String(disk.type || '—')" />
        <DetailItem :label="t('powerOnHours')" :value="smart.hours === undefined ? '—' : t('hoursValue', { n: Number(smart.hours).toLocaleString() })" />
        <DetailItem :label="t('diskIO')" :value="t('diskIOValue', { read: smart.read, write: smart.write })" />
        <DetailItem :label="t('smartInfo')" :value="smart.health" />
      </div>
    </div>
  </article>
</template>
