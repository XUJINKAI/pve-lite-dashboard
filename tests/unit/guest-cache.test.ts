import { describe, expect, it, vi } from "vitest";
import { createGuestCache } from "../../src/services/guest-cache";
import { normalizeGuest } from "../../src/domain/resources";

const guest = (node: string, status = "running") => normalizeGuest({ type: "qemu", vmid: 101, node, status });

describe("guest cache", () => {
  it("reuses data for one node and reloads it after migration", async () => {
    const load = vi.fn(async (item) => item.node);
    const cache = createGuestCache({ fingerprint: (item) => `${item.id}:${item.node}`, load, errorValue: () => "error" });

    await cache.ensure(guest("pve1"));
    await cache.ensure(guest("pve1"));
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.values.value.get("qemu:101")).toBe("pve1");

    await cache.reconcile([guest("pve2")]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.values.value.get("qemu:101")).toBe("pve2");

    await cache.reconcile([]);
    expect(cache.values.value.has("qemu:101")).toBe(false);
  });

  it("discards a response from an old node", async () => {
    let finishOld!: (value: string) => void;
    const load = vi.fn((item) => item.node === "pve1"
      ? new Promise<string>((resolve) => { finishOld = resolve; })
      : Promise.resolve("pve2"));
    const cache = createGuestCache({ fingerprint: (item) => `${item.id}:${item.node}`, load, errorValue: () => "error" });

    const oldRequest = cache.ensure(guest("pve1"));
    await cache.reconcile([guest("pve2")]);
    finishOld("pve1");
    await oldRequest;
    expect(cache.values.value.get("qemu:101")).toBe("pve2");
  });

  it("retries a failed read after the retry interval", async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("online");
      const cache = createGuestCache({ fingerprint: (item) => item.id, load, errorValue: () => "error", retryAfterMs: 30_000 });
      await cache.ensure(guest("pve1"));
      expect(cache.values.value.get("qemu:101")).toBe("error");
      await cache.reconcile([guest("pve1")]);
      expect(load).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      await cache.reconcile([guest("pve1")]);
      expect(cache.values.value.get("qemu:101")).toBe("online");
    } finally {
      vi.useRealTimers();
    }
  });
});
