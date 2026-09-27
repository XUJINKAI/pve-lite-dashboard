import { onUpdated } from "vue";

const overflowSelector = [
  ".compact-title strong", ".storage-type", ".metric-value", ".device-row>strong",
  ".device-row>span:not(.badge)", ".identity-copy strong", ".identity-copy small",
  ".detail-item strong", ".pool-description",
].join(",");

export function useOverflowTitles() {
  onUpdated(() => {
    for (const node of document.querySelectorAll<HTMLElement>(overflowSelector)) {
      const value = node.textContent?.trim() || "";
      node.title = value && node.scrollWidth > node.clientWidth ? value : "";
    }
  });
}
