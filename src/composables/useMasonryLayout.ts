import { onBeforeUnmount, onMounted, ref } from "vue";

export function useMasonryLayout() {
  const container = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  let frame = 0;
  const observed = new Set<Element>();

  function layout() {
    frame = 0;
    const root = container.value;
    if (!root) return;
    const blocks = [...root.children].filter((item): item is HTMLElement => item instanceof HTMLElement);
    const count = window.innerWidth <= 900 ? 1 : window.innerWidth <= 1100 ? 2 : 3;
    const gap = 10;
    const width = (root.clientWidth - gap * (count - 1)) / count;
    if (width <= 0) return;
    for (const block of blocks) block.style.width = `${width}px`;
    const heights = Array<number>(count).fill(0);
    for (const block of blocks) {
      const column = heights.indexOf(Math.min(...heights));
      const top = heights[column];
      block.style.left = `${column * (width + gap)}px`;
      block.style.top = `${top}px`;
      heights[column] += block.getBoundingClientRect().height + gap;
    }
    root.style.height = `${Math.max(0, ...heights) - (blocks.length ? gap : 0)}px`;
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(layout);
  }

  function observeBlocks() {
    const root = container.value;
    if (!root || !resizeObserver) return;
    const current = new Set(root.children);
    for (const block of observed) {
      if (current.has(block)) continue;
      resizeObserver.unobserve(block);
      observed.delete(block);
    }
    for (const block of current) {
      if (observed.has(block)) continue;
      resizeObserver.observe(block);
      observed.add(block);
    }
    schedule();
  }

  onMounted(() => {
    if (!container.value) return;
    resizeObserver = new ResizeObserver(schedule);
    mutationObserver = new MutationObserver(observeBlocks);
    mutationObserver.observe(container.value, { childList: true });
    observeBlocks();
    window.addEventListener("resize", schedule);
  });
  onBeforeUnmount(() => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
  });
  return container;
}
