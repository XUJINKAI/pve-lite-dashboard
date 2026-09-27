import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeGuest } from "../../src/domain/resources";
import { waitForPowerTask } from "../../src/services/power-tasks";
import type { DashboardApi } from "../../src/services/dashboard-api";

afterEach(() => vi.useRealTimers());

describe("power task polling", () => {
  it("waits for the PVE task result", async () => {
    vi.useFakeTimers();
    const taskStatus = vi.fn()
      .mockResolvedValueOnce({ status: "running" })
      .mockResolvedValueOnce({ status: "stopped", exitstatus: "OK" });
    const api = { taskStatus } as unknown as DashboardApi;
    const guest = normalizeGuest({ type: "qemu", vmid: 101, node: "pve1", status: "running" });

    const task = waitForPowerTask(api, guest, "UPID:pve1:task");
    await vi.advanceTimersByTimeAsync(1200);
    await expect(task).resolves.toEqual({ status: "stopped", exitstatus: "OK" });
    expect(taskStatus).toHaveBeenCalledTimes(2);
    expect(taskStatus).toHaveBeenCalledWith("pve1", "UPID:pve1:task");
  });

  it("does not report success without a successful exit status", async () => {
    vi.useFakeTimers();
    const api = { taskStatus: vi.fn().mockResolvedValue({ status: "stopped" }) } as unknown as DashboardApi;
    const guest = normalizeGuest({ type: "qemu", vmid: 901, node: "fictional-node-a" });

    const task = waitForPowerTask(api, guest, "UPID:fictional-node-a:SAMPLE");
    const failure = expect(task).rejects.toThrow("Missing task exit status");
    await vi.advanceTimersByTimeAsync(600);
    await failure;
  });
});
