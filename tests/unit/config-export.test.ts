import { expect, it } from "vitest";
import { exportGuestConfigs } from "../../src/services/config-export";

it("limits concurrent configuration reads and preserves every guest after individual failures", async () => {
  let active = 0;
  let peak = 0;
  const progress: number[] = [];
  const result = await exportGuestConfigs({
    resources: async () => Array.from({ length: 9 }, (_, i) => ({ type: "qemu", vmid: 909 - i, node: "sample-node", name: `sample-${i}` })),
    guestConfig: async (guest) => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      if (guest.vmid === 904) throw new Error("sample denial");
      return { net0: "virtio=02:00:00:00:00:01,bridge=vmbr0" };
    },
  }, (done) => progress.push(done));
  expect(peak).toBe(4);
  expect(progress).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(result).toMatchObject({ total: 9, failed: 1 });
  expect(result.text.match(/===== QEMU \d+/g)).toEqual(Array.from({ length: 9 }, (_, i) => `===== QEMU ${901 + i}`));
  expect(result.text).toContain("[ERROR] sample denial");
});
