import { createPinia, setActivePinia } from "pinia";
import { afterEach, expect, it, vi } from "vitest";
import { useDashboardStore } from "../../src/stores/dashboard";
import { normalizeGuest } from "../../src/domain/resources";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/services/data-source", () => ({ createDataService: () => ({ request, isMock: false }) }));

afterEach(() => { vi.useRealTimers(); request.mockReset(); });

it("refreshes auxiliary snapshots periodically and reads resources once after a power task", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  setActivePinia(createPinia());
  request.mockImplementation(async (path: string) => {
    if (path === "/cluster/resources") return [{ type: "node", node: "demo-node" }];
    if (path.includes("/tasks/")) return { status: "stopped", exitstatus: "OK" };
    if (path.endsWith("/status/start")) return "UPID:demo-node:TEST";
    if (path.endsWith("/status")) return { pveversion: "demo" };
    return [];
  });
  const store = useDashboardStore();
  const reads = (suffix: string) => request.mock.calls.filter(([path]) => String(path).endsWith(suffix)).length;
  await store.refreshAll();
  await Promise.all([store.loadPhysicalDetails(), store.loadBackups()]);
  const initial = reads("/status");
  await vi.advanceTimersByTimeAsync(5_000);
  await store.refreshAll();
  expect(reads("/status")).toBe(initial);
  await vi.advanceTimersByTimeAsync(55_000);
  await store.refreshAll();
  expect(reads("/status")).toBe(initial + 1);

  request.mockClear();
  store.permissions = { "/": { "VM.PowerMgmt": 1 } };
  const action = store.performAction(normalizeGuest({ type: "qemu", vmid: 901, node: "demo-node", status: "stopped" }), "start");
  await vi.advanceTimersByTimeAsync(600);
  await action;
  await vi.advanceTimersByTimeAsync(2000);
  expect(reads("/cluster/resources")).toBe(1);
});
