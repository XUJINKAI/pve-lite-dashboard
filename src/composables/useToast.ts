import { ref } from "vue";

export type ToastType = "info" | "success" | "warning" | "error";
export interface ToastItem { id: number; message: string; type: ToastType }

export const toastItems = ref<ToastItem[]>([]);
let nextToastId = 1;

export function showToast(message: string, type: ToastType = "info") {
  const id = nextToastId++;
  toastItems.value.push({ id, message, type });
  window.setTimeout(() => {
    toastItems.value = toastItems.value.filter((item) => item.id !== id);
  }, 3500);
}
