import { describe, expect, it, vi } from "vitest";
import { createSnapshotCache } from "../../src/services/snapshot-cache";

describe("snapshot cache", () => {
  it("coalesces reads for one key and keeps the newest node set", async () => {
    let finishOld!: (value: string) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce("new nodes");
    const cache = createSnapshotCache(load);

    const first = cache.refresh("pve1");
    expect(cache.refresh("pve1")).toBe(first);
    await cache.refresh("pve1|pve2");
    finishOld("old nodes");
    await first;

    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.data.value).toBe("new nodes");
    expect(cache.loading.value).toBe(false);
  });

  it("passes the previous snapshot to a refresh and preserves it on failure", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce("sample snapshot")
      .mockRejectedValueOnce(new Error("sample outage"))
      .mockImplementationOnce(async (previous: string | null) => `${previous} recovered`);
    const cache = createSnapshotCache<string>(load);

    await cache.refresh("fictional-node-a");
    await cache.refresh("fictional-node-a");
    expect(cache.data.value).toBe("sample snapshot");
    expect(cache.error.value).toEqual(new Error("sample outage"));

    await cache.refresh("fictional-node-a");
    expect(load).toHaveBeenLastCalledWith("sample snapshot", "fictional-node-a");
    expect(cache.data.value).toBe("sample snapshot recovered");
    expect(cache.error.value).toBeNull();
  });
});
