<script setup lang="ts">
import { computed } from "vue";
import { config } from "../../core/config";
import { t } from "../../core/i18n";
import type { Guest, PowerAction } from "../../core/types";
import { useDashboardStore } from "../../stores/dashboard";
import ActionIcon from "./ActionIcon.vue";

const props = defineProps<{ guest: Guest }>();
const store = useDashboardStore();
const pending = computed(() => store.pendingActions.get(props.guest.id));
const primaryAction = computed<PowerAction>(() => props.guest.status === "suspended" ? "resume" : "start");
const powerEnabled = computed(() => props.guest.status === "running" || props.guest.status === "suspended");
const menuActions: PowerAction[] = ["shutdown", "stop", "reboot", "suspend"];
const visible = computed(() => !props.guest.template && config.app.controls.show && store.hasPowerPermission(props.guest));
function run(action: PowerAction) { void store.performAction(props.guest, action); }
</script>

<template>
  <div v-if="visible" class="actions">
    <button v-if="config.app.controls[primaryAction]" class="btn action action-primary" type="button" :disabled="Boolean(pending) || (guest.status !== 'stopped' && guest.status !== 'suspended')" :aria-label="`${t(primaryAction)} ${guest.name}`" @click="run(primaryAction)">
      <ActionIcon :action="primaryAction" />{{ pending === primaryAction ? `${t(primaryAction)}…` : t(primaryAction) }}
    </button>
    <details class="action-menu">
      <summary class="btn action-menu-toggle" :class="{ disabled: !powerEnabled }" :aria-label="`${t('powerActions')} ${guest.name}`"><ActionIcon action="menu" />{{ t("powerActions") }}</summary>
      <div class="action-menu-list">
        <button v-for="action in menuActions" :key="action" class="action-menu-item" :class="{ 'danger-ghost': action === 'shutdown' || action === 'stop' }" type="button" :disabled="Boolean(pending) || !powerEnabled || !config.app.controls[action]" @click="run(action)">
          <ActionIcon :action="action" />{{ pending === action ? `${t(action)}…` : t(action) }}
        </button>
      </div>
    </details>
  </div>
</template>
