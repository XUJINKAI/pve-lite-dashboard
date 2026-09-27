import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../src/core/config";
import { normalizeGuest } from "../../src/domain/resources";
import { createDashboardApi } from "../../src/services/dashboard-api";
import { createDataService } from "../../src/services/data-source";

// Every response below is invented for this test; it contains no PVE export or production data.
const apiBase = config.app.apiBase;
const dataSource = config.app.dataSource;

function response(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 403 ? "Forbidden" : "OK",
    json: async () => ({ data }),
  } as Response;
}

function liveApi(fetchMock: ReturnType<typeof vi.fn>) {
  config.app.apiBase = "/api/api2/json";
  config.app.dataSource = "live";
  vi.stubGlobal("fetch", fetchMock);
  return createDashboardApi(createDataService().request);
}

afterEach(() => {
  config.app.apiBase = apiBase;
  config.app.dataSource = dataSource;
  vi.unstubAllGlobals();
});

describe("dashboard API adapter with invented PVE responses", () => {
  it("reads resource, pool, and permission envelopes from their endpoints", async () => {
    const resources = [{ type: "qemu", id: "qemu/901", vmid: 901, node: "fictional-node-a", name: "sample-guest" }];
    const pools = [{ poolid: "sample-pool" }];
    const permissions = { "/vms/901": { "VM.PowerMgmt": 1 } };
    const fixtures: Record<string, unknown> = {
      "/cluster/resources": resources,
      "/pools": pools,
      "/access/permissions": permissions,
    };
    const fetchMock = vi.fn(async (...args: [string, RequestInit?]) => response(fixtures[args[0].replace("/api/api2/json", "")]));
    const api = liveApi(fetchMock);

    await expect(api.resources()).resolves.toEqual(resources);
    await expect(api.pools()).resolves.toEqual(pools);
    await expect(api.permissions()).resolves.toEqual(permissions);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/api2/json/cluster/resources",
      "/api/api2/json/pools",
      "/api/api2/json/access/permissions",
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === "GET" && options.cache === "no-store")).toBe(true);
  });

  it("reads node and guest details and labels backup tasks with their node", async () => {
    const fixtures: Record<string, unknown> = {
      "/nodes/fictional-node-a/status": { pveversion: "sample-version" },
      "/nodes/fictional-node-a/disks/list": [{ devpath: "/dev/sample-disk" }],
      "/nodes/fictional-node-a/network": [{ iface: "sample-bridge" }],
      "/nodes/fictional-node-a/tasks?typefilter=vzdump&limit=500": [{ id: "901", status: "OK" }],
      "/nodes/fictional-node-a/qemu/901/config": { cores: 2 },
      "/nodes/fictional-node-a/qemu/901/agent/network-get-interfaces": { result: [] },
      "/nodes/fictional-node-a/lxc/902/interfaces": [{ name: "sample-interface" }],
    };
    const fetchMock = vi.fn(async (url: string) => response(fixtures[url.replace("/api/api2/json", "")]));
    const api = liveApi(fetchMock);
    const vm = normalizeGuest({ type: "qemu", vmid: 901, node: "fictional-node-a", status: "running" });
    const container = normalizeGuest({ type: "lxc", vmid: 902, node: "fictional-node-a", status: "running" });

    await expect(api.nodeDetails("fictional-node-a")).resolves.toEqual({
      node: "fictional-node-a",
      status: { ok: true, data: { pveversion: "sample-version" } },
      disks: { ok: true, data: [{ devpath: "/dev/sample-disk" }] },
      networks: { ok: true, data: [{ iface: "sample-bridge" }] },
    });
    await expect(api.backups("fictional-node-a")).resolves.toEqual([{ id: "901", status: "OK", nodeName: "fictional-node-a" }]);
    await expect(api.guestConfig(vm)).resolves.toEqual({ cores: 2 });
    await expect(api.guestNetwork(vm)).resolves.toEqual({ result: [] });
    await expect(api.guestNetwork(container)).resolves.toEqual([{ name: "sample-interface" }]);
    expect(fetchMock.mock.calls).toHaveLength(8);
  });

  it("submits a power action, reads its task, and preserves HTTP error status", async () => {
    const task = "UPID:fictional-node-a:SAMPLE";
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/status/start")) return response(task);
      if (url.includes("/tasks/")) return response({ status: "stopped", exitstatus: "OK" });
      return {
        ok: false, status: 403, statusText: "Forbidden",
        json: async () => ({ errors: { permission: "sample denial" } }),
      } as Response;
    });
    const api = liveApi(fetchMock);
    const guest = normalizeGuest({ type: "qemu", vmid: 901, node: "fictional-node-a" });

    await expect(api.powerAction(guest, "start")).resolves.toBe(task);
    await expect(api.taskStatus("fictional-node-a", task)).resolves.toEqual({ status: "stopped", exitstatus: "OK" });
    await expect(api.permissions()).rejects.toMatchObject({ status: 403, message: "permission: sample denial" });
    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/api2/json/nodes/fictional-node-a/qemu/901/status/start",
      { method: "POST", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error" },
    ]);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/api2/json/nodes/fictional-node-a/tasks/UPID%3Afictional-node-a%3ASAMPLE/status");
  });

  it("rejects malformed primary and permission data while accepting a valid empty list", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/cluster/resources")) return response({ unexpected: "shape" });
      if (url.endsWith("/access/permissions")) return response({ "/": null });
      return response([]);
    });
    const api = liveApi(fetchMock);

    await expect(api.resources()).rejects.toMatchObject({ name: "ApiResponseError" });
    await expect(api.permissions()).rejects.toMatchObject({ name: "ApiResponseError" });
    await expect(api.pools()).resolves.toEqual([]);
  });

  it("keeps the result of a healthy node endpoint when another fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/status")) return response({ pveversion: "sample-version" });
      if (url.endsWith("/disks/list")) return response({ unexpected: "shape" });
      return response([{ iface: "sample-bridge" }]);
    });
    const api = liveApi(fetchMock);
    const details = await api.nodeDetails("fictional-node-a");

    expect(details.status).toEqual({ ok: true, data: { pveversion: "sample-version" } });
    expect(details.disks).toMatchObject({ ok: false, error: { name: "ApiResponseError" } });
    expect(details.networks).toEqual({ ok: true, data: [{ iface: "sample-bridge" }] });
  });

  it("rejects an unexpected power response and an incomplete task status", async () => {
    const fetchMock = vi.fn(async (url: string) => response(url.endsWith("/status/start") ? { accepted: true } : {}));
    const api = liveApi(fetchMock);
    const guest = normalizeGuest({ type: "qemu", vmid: 901, node: "fictional-node-a" });

    await expect(api.powerAction(guest, "start")).rejects.toMatchObject({ name: "ApiResponseError" });
    await expect(api.taskStatus("fictional-node-a", "UPID:fictional-node-a:SAMPLE")).rejects.toMatchObject({ name: "ApiResponseError" });
  });
});

it("uses configured demo mode for unrecognized query values", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { search: "?data=unexpected", hostname: "example.invalid" });
  config.app.dataSource = "mock";
  expect(createDataService().isMock).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("uses configuration fallback for stopped and template guest networks", async () => {
  const request = vi.fn();
  const api = createDashboardApi(request);
  for (const fields of [{ status: "stopped" }, { status: "paused" }, { status: "running", template: 1 }]) {
    await expect(api.guestNetwork(normalizeGuest({ type: "qemu", vmid: 901, node: "demo-node", ...fields }))).resolves.toEqual([]);
  }
  expect(request).not.toHaveBeenCalled();
});
