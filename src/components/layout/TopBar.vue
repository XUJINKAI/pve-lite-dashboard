<script setup lang="ts">
import { computed } from "vue";
import { config } from "../../core/config";
import { locale, t, toggleLanguage } from "../../core/i18n";

defineProps<{ title: string; isMock: boolean; connected: boolean; refreshing: boolean; lastUpdated: string }>();
const emit = defineEmits<{ refresh: []; permissions: []; settings: [] }>();
const languageButton = computed(() => locale.value === "zh-CN" ? "EN" : "中");
const brandMarkUrl = new URL("../../assets/brand-mark.svg", import.meta.url).href;
function switchLanguage() { toggleLanguage(); }
</script>

<template>
  <header class="topbar">
    <div class="brand"><img class="brand-mark" :src="brandMarkUrl" alt="" aria-hidden="true" /><div><h1 id="app-title">{{ title }}</h1><p id="app-subtitle" class="subtitle" :class="{ hidden: !config.app.subtitle }">{{ config.app.subtitle }}</p></div></div>
    <div class="header-tools">
      <div class="connection" role="status"><span id="connection-dot" class="status-dot" :class="connected ? 'running' : 'offline'" /><span id="connection-text">{{ connected ? t("connected") : t("disconnected") }}{{ isMock ? ' (demo)' : '' }}</span><span id="last-updated">{{ lastUpdated }}</span></div>
      <button id="refresh-button" class="icon-button" type="button" :class="{ 'is-loading': refreshing }" :title="t('refresh')" :aria-label="t('refresh')" @click="emit('refresh')"><svg class="refresh-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg></button>
      <button id="language-button" class="icon-button language-button" type="button" aria-label="Language" title="Language" @click="switchLanguage">{{ languageButton }}</button>
      <button id="permissions-button" class="icon-button" type="button" :title="t('permissions')" :aria-label="t('permissions')" @click="emit('permissions')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z" /><path d="m8 12 3 3 5-6" /></svg></button>
      <button id="settings-button" class="icon-button" type="button" :title="t('settings')" :aria-label="t('settings')" @click="emit('settings')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 3-2 1.2-2.9-.9-2 3.4 2.3 2v2.6l-2.3 2 2 3.4 2.9-.9 2 1.2.6 3h4l.6-3 2-1.2 2.9.9 2-3.4-2.3-2v-2.6l2.3-2-2-3.4-2.9.9-2-1.2-.6-3z" transform="translate(1 -1)" /><circle cx="12" cy="12" r="3" /></svg></button>
    </div>
  </header>
</template>
