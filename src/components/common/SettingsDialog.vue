<script setup lang="ts">
import { nextTick, ref, toRaw, watch } from "vue";
import { config, configIssue, parseConfigJson, resetConfig, saveConfig, type DashboardConfig, type VmidRule } from "../../core/config";
import { t } from "../../core/i18n";
import { preferences } from "../../core/preferences";
import type { PowerAction } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import { settingsDialogOpen } from "../../composables/useDialogs";

const dialog = ref<HTMLDialogElement | null>(null);
const draft = ref<DashboardConfig>(structuredClone(config));
const error = ref("");
const store = useDashboardStore();
const exporting = ref(false);
const exportProgress = ref({ done: 0, total: 0 });
const exportMessage = ref("");
const exportError = ref("");
async function downloadVmConfigs() {
  if (exporting.value) return;
  exporting.value = true;
  exportProgress.value = { done: 0, total: 0 };
  exportMessage.value = "";
  exportError.value = "";
  try {
    const result = await store.exportVmConfigs((done, total) => { exportProgress.value = { done, total }; });
    if (!result.total) { exportMessage.value = t("settingsVmExportEmpty"); return; }
    const url = URL.createObjectURL(new Blob(["\uFEFF", result.text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    exportMessage.value = t(result.failed ? "settingsVmExportPartial" : "settingsVmExportDone", { total: result.total, failed: result.failed });
  } catch (cause) {
    exportError.value = t("readFailed", { message: cause instanceof Error ? cause.message : String(cause) });
  } finally { exporting.value = false; }
}
type SettingsTab = "general" | "resources" | "display" | "importExport";
const tabs: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "settingsGeneral" },
  { id: "resources", label: "settingsResources" },
  { id: "display", label: "settingsDisplay" },
  { id: "importExport", label: "settingsImportExport" },
];
const activeTab = ref<SettingsTab>("general");
const configText = ref("");
const actions: PowerAction[] = ["start", "shutdown", "stop", "reboot", "suspend", "resume"];
const metricKeys = ["status", "cpu", "memory", "disk", "uptime", "load", "network", "vmid", "type", "node"];
const vmidExclusions = ref(formatRules(config.resources.virtual.excludeVmids));
const cpuWarning = ref(.7);
const cpuCritical = ref(.9);
const memoryWarning = ref(.75);
const memoryCritical = ref(.9);
function formatRules(rules: VmidRule[]) {
  return rules.map((rule) => Array.isArray(rule) ? `${rule[0]}-${rule[1]}` : String(rule)).join("\n");
}

function parseRules(text: string): VmidRule[] | null {
  const rules: VmidRule[] = [];
  for (const line of text.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean)) {
    const range = line.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]); const end = Number(range[2]);
      if (!Number.isSafeInteger(start) || start <= 0 || !Number.isSafeInteger(end) || end < start) return null;
      rules.push([start, end]);
    } else if (/^\d+$/.test(line) && Number.isSafeInteger(Number(line)) && Number(line) > 0) rules.push(Number(line));
    else return null;
  }
  return rules;
}

function metricLabel(key: string) {
  if (key === "vmid") return "VMID";
  if (key === "type") return t("settingsType");
  return t(key === "status" ? "statusLabel" : key === "network" ? "network" : key);
}

watch(settingsDialogOpen, async (open) => {
  if (!open) {
    if (dialog.value?.open) dialog.value.close();
    return;
  }
  draft.value = structuredClone(config);
  activeTab.value = "general";
  configText.value = JSON.stringify(config, null, 2);
  vmidExclusions.value = formatRules(config.resources.virtual.excludeVmids);
  cpuWarning.value = config.resourceBars.cpu.color?.warning ?? .7;
  cpuCritical.value = config.resourceBars.cpu.color?.critical ?? .9;
  memoryWarning.value = config.resourceBars.memory.color?.warning ?? .75;
  memoryCritical.value = config.resourceBars.memory.color?.critical ?? .9;
  error.value = "";
  await nextTick();
  dialog.value?.showModal();
});

function close() { settingsDialogOpen.value = false; }

function onTabKeydown(event: KeyboardEvent, index: number) {
  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
    : direction ? (index + direction + tabs.length) % tabs.length : -1;
  if (nextIndex < 0) return;
  event.preventDefault();
  activeTab.value = tabs[nextIndex].id;
  const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>("[role=tab]");
  buttons?.[nextIndex]?.focus();
}

function refreshConfigText() { configText.value = JSON.stringify(config, null, 2); error.value = ""; }

function reloadWithConfig(next: DashboardConfig) {
  if (next.app.language !== config.app.language) preferences.set("language", null);
  const url = new URL(window.location.href);
  if (next.app.dataSource !== config.app.dataSource) {
    url.searchParams.delete("data");
    url.searchParams.delete("mock");
  }
  window.location.replace(url.toString());
}

function importConfigText() {
  const result = parseConfigJson(configText.value);
  if (!result.value) { error.value = t(result.issue || "settingsConfigFormatError"); return; }
  if (!saveConfig(result.value)) { error.value = t("settingsStorageError"); return; }
  reloadWithConfig(result.value);
}

function apply() {
  const next = structuredClone(toRaw(draft.value));
  const exclusions = parseRules(vmidExclusions.value);
  if (!exclusions) { error.value = t("settingsVmidRuleError"); return; }
  next.resources.virtual.excludeVmids = exclusions;
  next.resourceBars.cpu.color = { warning: cpuWarning.value, critical: cpuCritical.value };
  next.resourceBars.memory.color = { warning: memoryWarning.value, critical: memoryCritical.value };
  const issue = configIssue(next);
  if (issue) { error.value = t(issue); return; }
  if (!saveConfig(next)) { error.value = t("settingsStorageError"); return; }
  reloadWithConfig(next);
}

function restoreDefaults() {
  if (!resetConfig()) { error.value = t("settingsStorageError"); return; }
  preferences.set("language", null);
  window.location.reload();
}
</script>

<template>
  <dialog ref="dialog" class="settings-dialog" :aria-label="t('settings')" @cancel.prevent="close" @click.self="close">
    <form class="settings-panel" @submit.prevent="apply">
      <header class="settings-header"><div><h2>{{ t("settings") }}</h2><p>{{ t("settingsIntro") }}</p></div><button class="icon-button" type="button" :aria-label="t('close')" @click="close">×</button></header>
      <div class="settings-body">
        <nav class="settings-tabs" role="tablist" :aria-label="t('settings')"><button v-for="(tab, index) in tabs" :id="`settings-tab-${tab.id}`" :key="tab.id" class="settings-tab" type="button" role="tab" :aria-selected="activeTab === tab.id" :aria-controls="`settings-panel-${tab.id}`" :tabindex="activeTab === tab.id ? 0 : -1" @click="activeTab = tab.id" @keydown="onTabKeydown($event, index)">{{ t(tab.label) }}</button></nav>
        <div id="settings-panel-general" v-show="activeTab === 'general'" role="tabpanel" aria-labelledby="settings-tab-general">
          <section class="settings-section"><h3>{{ t("settingsGeneral") }}</h3><div class="settings-grid">
            <label class="settings-field"><span>{{ t("settingsTitle") }}</span><input v-model.trim="draft.app.title" type="text" maxlength="80" /></label>
            <label class="settings-field"><span>{{ t("settingsSubtitle") }}</span><input v-model.trim="draft.app.subtitle" type="text" maxlength="120" /></label>
            <label class="settings-field"><span>{{ t("settingsLanguage") }}</span><select v-model="draft.app.language"><option value="auto">{{ t("settingsAuto") }}</option><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
            <label class="settings-field"><span>{{ t("settingsDataSource") }}</span><select v-model="draft.app.dataSource"><option value="auto">{{ t("settingsAuto") }}</option><option value="live">{{ t("settingsLive") }}</option><option value="mock">{{ t("settingsDemo") }}</option></select></label>
            <label class="settings-field full"><span>{{ t("settingsApiBase") }}</span><input v-model.trim="draft.app.apiBase" type="text" spellcheck="false" /></label>
          </div></section>
          <section class="settings-section"><h3>{{ t("settingsControls") }}</h3><label class="settings-check"><input v-model="draft.app.controls.show" type="checkbox" />{{ t("settingsShowControls") }}</label><div class="settings-actions"><div v-for="action in actions" :key="action" class="settings-action"><strong>{{ t(action) }}</strong><label class="settings-check"><input v-model="draft.app.controls[action]" type="checkbox" />{{ t("settingsEnabled") }}</label><label class="settings-check"><input v-model="draft.app.controls.confirm[action]" type="checkbox" />{{ t("settingsConfirm") }}</label></div></div></section>
        </div>
        <div id="settings-panel-resources" v-show="activeTab === 'resources'" role="tabpanel" aria-labelledby="settings-tab-resources">
          <section class="settings-section"><h3>{{ t("settingsRefreshSection") }}</h3>
          <div class="settings-grid">
            <label class="settings-field"><span>{{ t("settingsRefresh") }}</span><input v-model.number="draft.app.refreshInterval" type="number" min="0" max="86400" /></label>
            <label class="settings-field"><span>{{ t("settingsHiddenRefresh") }}</span><input v-model.number="draft.app.hiddenRefreshInterval" type="number" min="0" max="86400" /></label>
            <label class="settings-field"><span>{{ t("settingsPermissionsRefresh") }}</span><input v-model.number="draft.app.permissionsRefreshInterval" type="number" min="30" max="86400" /></label>
          </div><p class="settings-help">{{ t("settingsRefreshHelp") }}</p>
        </section>
          <section class="settings-section"><h3>{{ t("settingsPhysical") }}</h3>
            <label class="settings-check"><input v-model="draft.resources.physical.show" type="checkbox" />{{ t("settingsShowPhysical") }}</label>
            <div class="settings-checks settings-subchecks" :class="{ 'settings-disabled': !draft.resources.physical.show }">
              <label class="settings-check"><input v-model="draft.resources.physical.node" type="checkbox" :disabled="!draft.resources.physical.show" />{{ t("nodes") }}</label>
              <label class="settings-check"><input v-model="draft.resources.physical.storage" type="checkbox" :disabled="!draft.resources.physical.show" />{{ t("storage") }}</label>
              <label class="settings-check"><input v-model="draft.resources.physical.disks" type="checkbox" :disabled="!draft.resources.physical.show" />{{ t("physicalDisks") }}</label>
              <label class="settings-check"><input v-model="draft.resources.physical.network" type="checkbox" :disabled="!draft.resources.physical.show" />{{ t("network") }}</label>
              <label class="settings-check"><input v-model="draft.resources.physical.backups" type="checkbox" :disabled="!draft.resources.physical.show" />{{ t("backups") }}</label>
            </div>
          </section>
          <section class="settings-section"><h3>{{ t("settingsVirtual") }}</h3>
            <label class="settings-check"><input v-model="draft.resources.virtual.show" type="checkbox" />{{ t("settingsShowVirtual") }}</label>
            <div class="settings-checks settings-subchecks" :class="{ 'settings-disabled': !draft.resources.virtual.show }">
              <label class="settings-check"><input v-model="draft.resources.virtual.qemu" type="checkbox" :disabled="!draft.resources.virtual.show" />QEMU VM</label>
              <label class="settings-check"><input v-model="draft.resources.virtual.lxc" type="checkbox" :disabled="!draft.resources.virtual.show" />LXC</label>
              <label class="settings-check"><input v-model="draft.resources.virtual.templates" type="checkbox" :disabled="!draft.resources.virtual.show" />{{ t("templates") }}</label>
              <label class="settings-check"><input v-model="draft.resources.virtual.stopped" type="checkbox" :disabled="!draft.resources.virtual.show" />{{ t("settingsStoppedGuests") }}</label>
            </div>
            <label class="settings-field settings-vmid-field"><span>{{ t("settingsVmidExclude") }}</span><textarea v-model="vmidExclusions" rows="3" spellcheck="false" :disabled="!draft.resources.virtual.show" /></label>
            <p class="settings-help">{{ t("settingsVmidHelp") }}</p>
          </section>
        </div>
        <div id="settings-panel-display" v-show="activeTab === 'display'" role="tabpanel" aria-labelledby="settings-tab-display">
          <section class="settings-section"><h3>{{ t("settingsGuestList") }}</h3>
          <label class="settings-field"><span>{{ t("settingsPoolPosition") }}</span><select v-model="draft.resources.pool.unassignedPosition"><option value="first">{{ t("settingsFirst") }}</option><option value="last">{{ t("settingsLast") }}</option></select></label>
        </section>
          <section class="settings-section"><h3>{{ t("settingsUpdated") }}</h3><label class="settings-check"><input v-model="draft.app.showLastUpdated" type="checkbox" />{{ t("settingsShowUpdated") }}</label></section>
          <section class="settings-section"><h3>{{ t("settingsMetrics") }}</h3><div class="settings-checks"><label v-for="key in metricKeys" :key="key" class="settings-check"><input v-model="draft.metrics[key]" type="checkbox" />{{ metricLabel(key) }}</label></div></section>
          <section class="settings-section"><h3>{{ t("settingsBars") }}</h3><div class="settings-grid"><label class="settings-field"><span>{{ t("cpu") }} · {{ t("settingsWarning") }}</span><input v-model.number="cpuWarning" type="number" min="0" max="1" step="0.01" /></label><label class="settings-field"><span>{{ t("cpu") }} · {{ t("settingsCritical") }}</span><input v-model.number="cpuCritical" type="number" min="0" max="1" step="0.01" /></label><label class="settings-field"><span>{{ t("memory") }} · {{ t("settingsWarning") }}</span><input v-model.number="memoryWarning" type="number" min="0" max="1" step="0.01" /></label><label class="settings-field"><span>{{ t("memory") }} · {{ t("settingsCritical") }}</span><input v-model.number="memoryCritical" type="number" min="0" max="1" step="0.01" /></label></div></section>
        </div>
        <div id="settings-panel-importExport" v-show="activeTab === 'importExport'" role="tabpanel" aria-labelledby="settings-tab-importExport">
          <section class="settings-section"><h3>{{ t("settingsVmExport") }}</h3>
            <p class="settings-help">{{ t("settingsVmExportHelp") }}</p>
            <button class="btn secondary" type="button" :disabled="exporting" @click="downloadVmConfigs">{{ t('settingsVmExportButton') }}</button>
            <p v-if="exporting" class="settings-help" role="status">{{ t('settingsVmExportProgress', exportProgress) }}</p>
            <p v-else-if="exportMessage" class="settings-help" role="status">{{ exportMessage }}</p>
            <p v-if="exportError" class="settings-error" role="alert">{{ exportError }}</p>
          </section>
          <section class="settings-section"><h3>{{ t("settingsBrowserConfig") }}</h3><p class="settings-help">{{ t("settingsConfigHelp") }}</p><label class="settings-field"><span>{{ t("settingsConfigJson") }}</span><textarea v-model="configText" class="settings-config-text" rows="8" spellcheck="false" /></label><div class="settings-import-actions"><button class="btn secondary" type="button" @click="refreshConfigText">{{ t("settingsReloadConfig") }}</button><button class="btn action-primary" type="button" @click="importConfigText">{{ t("settingsImportConfig") }}</button></div></section>
        </div>
      </div>
      <footer class="settings-footer"><p v-if="error" class="settings-error" role="alert">{{ error }}</p><button v-if="activeTab !== 'importExport'" class="btn secondary" type="button" @click="restoreDefaults">{{ t("settingsReset") }}</button><span class="settings-spacer" /><button class="btn secondary" type="button" @click="close">{{ t("cancel") }}</button><button v-if="activeTab !== 'importExport'" class="btn action-primary" type="submit">{{ t("settingsSave") }}</button></footer>
    </form>
  </dialog>
</template>

<style scoped>
.settings-dialog { width: min(780px, calc(100vw - 24px)); max-height: min(90vh, 900px); padding: 0; border: 1px solid var(--line); border-radius: 14px; color: var(--text); background: var(--panel); box-shadow: 0 24px 80px rgba(0, 0, 0, .24); }
.settings-dialog::backdrop { background: rgba(8, 12, 24, .56); }
.settings-panel { display: flex; max-height: min(90vh, 900px); flex-direction: column; }
.settings-header, .settings-footer { display: flex; align-items: center; gap: 12px; padding: 16px 20px; }
.settings-header { justify-content: space-between; border-bottom: 1px solid var(--line); }
.settings-header h2 { margin: 0; font-size: 18px; }
.settings-header p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.settings-body { overflow-y: auto; padding: 0 20px 18px; }
.settings-tabs { position: sticky; top: 0; z-index: 1; display: flex; gap: 4px; padding: 12px 0 0; border-bottom: 1px solid var(--line); background: var(--panel); }
.settings-tab { flex: 1; min-width: 0; padding: 9px 6px; border: 0; border-bottom: 2px solid transparent; color: var(--muted); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.settings-tab[aria-selected="true"] { border-bottom-color: var(--accent); color: var(--text); font-weight: 700; }
.settings-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.settings-section { padding: 16px 0; border-bottom: 1px solid var(--line); }
.settings-section h3 { margin: 0 0 12px; font-size: 14px; }
.settings-section h4 { margin: 0 0 8px; font-size: 12px; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
.settings-field { display: grid; min-width: 0; gap: 5px; color: var(--muted); font-size: 12px; }
.settings-field.full { grid-column: 1 / -1; }
.settings-field input, .settings-field select, .settings-field textarea { width: 100%; min-width: 0; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; color: var(--text); background: var(--soft); font: inherit; }
.settings-field textarea { resize: vertical; }
.settings-checks { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin: 10px 0; }
.settings-check { display: inline-flex; align-items: center; gap: 6px; color: var(--text); font-size: 12px; cursor: pointer; }
.settings-check input { accent-color: var(--accent); }
.settings-help { margin: 9px 0; color: var(--muted); font-size: 11px; }
.settings-subchecks { margin-left: 20px; }
.settings-disabled { opacity: .5; }
.settings-vmid-field { max-width: 420px; margin: 12px 0 0 20px; }
.settings-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
.settings-action { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }
.settings-action strong { min-width: 58px; font-size: 12px; }
.settings-config-text { height: clamp(80px, calc(90dvh - 480px), 160px); min-height: 80px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; line-height: 1.5; }
.settings-import-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.settings-footer { flex-wrap: wrap; border-top: 1px solid var(--line); }
.settings-error { width: 100%; margin: 0; color: var(--danger); font-size: 12px; }
.settings-spacer { flex: 1; }
@media (max-width: 640px) { .settings-grid, .settings-actions { grid-template-columns: 1fr; } .settings-header, .settings-footer { padding: 12px; } .settings-body { padding: 0 12px 12px; } }
</style>
