<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import GuestConfigDialog from "./GuestConfigDialog.vue";
import { closeIpDialog, confirmRequest, ipDialog, permissionsDialogOpen, resolveConfirmation } from "../../composables/useDialogs";
import { permissionValue } from "../../domain/permissions";
import type { PermissionMap } from "../../domain/permissions";
import { t } from "../../core/i18n";

const props = defineProps<{ permissions: PermissionMap }>();
const permissionsDialog = ref<HTMLDialogElement | null>(null);
const confirmDialog = ref<HTMLDialogElement | null>(null);
const ipDialogElement = ref<HTMLDialogElement | null>(null);
const permissionRows = computed(() => {
  const entries = Object.entries(props.permissions).filter(([path, privileges]) => path === "/" || path === "/pool" || path.startsWith("/pool/") || path === "/vms" || path.startsWith("/vms/") || path === "/storage" || Object.keys(privileges || {}).some((name) => name.includes("Audit") || name === "VM.PowerMgmt"));
  const records = entries.map(([path, privileges]) => {
    const granted = new Set(Object.entries(privileges || {}).filter(([, value]) => permissionValue(value)).map(([name]) => name));
    if (path.startsWith("/pool/") && Object.prototype.hasOwnProperty.call(privileges || {}, "VM.PowerMgmt") && !granted.has("VM.PowerMgmt")) granted.add(t("poolPropagation"));
    return { path, granted };
  }).filter((record) => record.granted.size).sort((a, b) => a.path.localeCompare(b.path, "zh-CN", { numeric: true }));
  const stats = new Map<string, { count: number; first: number }>(); let first = 0;
  for (const record of records) for (const permission of record.granted) { if (!stats.has(permission)) stats.set(permission, { count: 0, first: first++ }); stats.get(permission)!.count += 1; }
  const columns = [...stats.keys()].sort((a, b) => stats.get(b)!.count - stats.get(a)!.count || stats.get(a)!.first - stats.get(b)!.first || a.localeCompare(b, "zh-CN", { numeric: true }));
  return { records, columns };
});

watch(permissionsDialogOpen, async (open) => { await nextTick(); if (open) permissionsDialog.value?.showModal(); else permissionsDialog.value?.close(); });
watch(confirmRequest, async (request) => { await nextTick(); if (request) confirmDialog.value?.showModal(); else if (confirmDialog.value?.open) confirmDialog.value.close("cancel"); });
watch(ipDialog, async (dialog) => { await nextTick(); if (dialog) ipDialogElement.value?.showModal(); else if (ipDialogElement.value?.open) ipDialogElement.value.close(); });
function closePermissions() { permissionsDialogOpen.value = false; }
function closeConfirm(value: boolean) { resolveConfirmation(value); }
function closeIp() { closeIpDialog(); }
</script>

<template>
  <GuestConfigDialog />
  <dialog id="permissions-dialog" ref="permissionsDialog" @click.self="closePermissions"><form method="dialog" class="dialog-card permission-dialog-card permission-matrix-dialog" @submit="closePermissions"><div class="dialog-icon shield" aria-hidden="true">🛡️</div><h3>{{ t("permissions") }}</h3><div class="permissions-content"><div v-if="!permissionRows.records.length" class="empty-inline">{{ t("permissionEmpty") }}</div><div v-else class="permission-table-wrap"><table class="permission-table"><thead><tr><th class="permission-path">{{ t("path") }}</th><th v-for="column in permissionRows.columns" :key="column" class="permission-name">{{ column }}</th></tr></thead><tbody><tr v-for="record in permissionRows.records" :key="record.path"><th class="permission-path">{{ record.path }}</th><td v-for="column in permissionRows.columns" :key="column" :class="{ 'permission-granted': record.granted.has(column) }">{{ record.granted.has(column) ? '✓' : '' }}</td></tr></tbody></table></div></div><div class="dialog-actions"><button value="close" class="btn secondary" type="submit">{{ t("close") }}</button></div></form></dialog>
  <dialog ref="ipDialogElement" @click.self="closeIp"><form method="dialog" class="dialog-card permission-dialog-card" @submit="closeIp"><div class="dialog-icon shield" aria-hidden="true">⌁</div><h3>{{ ipDialog?.title }}</h3><div class="permissions-content ip-list"><div v-for="ip in ipDialog?.ips" :key="ip" class="ip-row">{{ ip }}</div></div><div class="dialog-actions"><button value="close" class="btn secondary" type="submit">{{ t("close") }}</button></div></form></dialog>
  <dialog ref="confirmDialog" @click.self="closeConfirm(false)"><form method="dialog" class="dialog-card" @submit.prevent><div class="dialog-icon" aria-hidden="true">!</div><h3>{{ confirmRequest?.title }}</h3><p>{{ confirmRequest?.message }}</p><div class="dialog-actions"><button class="btn secondary" type="button" @click="closeConfirm(false)">{{ t("cancel") }}</button><button class="btn danger" type="button" @click="closeConfirm(true)">{{ t("confirm") }}</button></div></form></dialog>
</template>
