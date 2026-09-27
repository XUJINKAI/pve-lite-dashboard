import { ref } from "vue";
import type { ConfirmRequest, Guest, IpDialogState } from "../core/types";

export const confirmRequest = ref<ConfirmRequest | null>(null);
export const guestConfigDialog = ref<Guest | null>(null);
export const ipDialog = ref<IpDialogState | null>(null);
export const permissionsDialogOpen = ref(false);
export const settingsDialogOpen = ref(false);
let confirmResolver: ((value: boolean) => void) | null = null;

export function requestConfirmation(request: ConfirmRequest) {
  return new Promise<boolean>((resolve) => {
    confirmResolver = resolve;
    confirmRequest.value = request;
  });
}

export function resolveConfirmation(value: boolean) {
  confirmRequest.value = null;
  confirmResolver?.(value);
  confirmResolver = null;
}

export function showIpDialog(value: IpDialogState) { ipDialog.value = value; }
export function closeIpDialog() { ipDialog.value = null; }
