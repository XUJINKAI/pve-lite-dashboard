import type { BackupTask, Guest, GuestDetails, NodeStatus, Pool, PowerAction, RawRecord, RawResource } from "../core/types";

type Request = (path: string, options?: RequestInit) => Promise<unknown>;

export class ApiResponseError extends Error {
  constructor(path: string, expected: string) {
    super(`Invalid PVE response from ${path}: expected ${expected}`);
    this.name = "ApiResponseError";
  }
}

export type ReadResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

function isRecord(value: unknown): value is RawRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown, path: string): RawRecord {
  if (!isRecord(value)) throw new ApiResponseError(path, "an object");
  return value;
}

function records(value: unknown, path: string): RawRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new ApiResponseError(path, "an array of objects");
  return value;
}

function settled<T>(result: PromiseSettledResult<T>): ReadResult<T> {
  return result.status === "fulfilled" ? { ok: true, data: result.value } : { ok: false, error: result.reason };
}

function nodePath(node: string) {
  return `/nodes/${encodeURIComponent(node)}`;
}

function guestPath(guest: Guest) {
  return `${nodePath(guest.node || "")}/${guest.type}/${guest.vmid}`;
}

export function createDashboardApi(request: Request) {
  return {
    async resources(): Promise<RawResource[]> {
      const path = "/cluster/resources";
      return records(await request(path), path);
    },
    async pools(): Promise<Pool[]> {
      const path = "/pools";
      return records(await request(path), path);
    },
    async permissions(): Promise<Record<string, RawRecord>> {
      const path = "/access/permissions";
      const data = record(await request(path), path);
      if (!Object.values(data).every(isRecord)) throw new ApiResponseError(path, "a permission map");
      return data as Record<string, RawRecord>;
    },
    async nodeDetails(node: string) {
      const path = nodePath(node);
      const [status, disks, networks] = await Promise.allSettled([
        request(`${path}/status`).then((data) => record(data, `${path}/status`) as NodeStatus),
        request(`${path}/disks/list`).then((data) => records(data, `${path}/disks/list`)),
        request(`${path}/network`).then((data) => records(data, `${path}/network`)),
      ]);
      return {
        node,
        status: settled(status),
        disks: disks.status === "fulfilled" ? { ok: true as const, data: await Promise.all(disks.value.map(async (disk) => {
          try {
            const smartPath = `${path}/disks/smart?disk=${encodeURIComponent(String(disk.devpath))}`;
            return { ...disk, smart: record(await request(smartPath), smartPath) };
          } catch { return disk; }
        })) } : settled<RawRecord[]>(disks),
        networks: settled(networks),
      };
    },
    async backups(node: string): Promise<BackupTask[]> {
      const path = `${nodePath(node)}/tasks?typefilter=vzdump&limit=500`;
      return records(await request(path), path).map((item) => ({ ...item, nodeName: node }));
    },
    async guestConfig(guest: Guest): Promise<GuestDetails> {
      const path = `${guestPath(guest)}/config`;
      return record(await request(path), path);
    },
    async guestFilesystems(guest: Guest): Promise<RawRecord[]> {
      if (guest.type !== "qemu" || guest.status !== "running" || guest.template) return [];
      const path = `${guestPath(guest)}/agent/get-fsinfo`;
      const data = record(await request(path), path);
      return records(data.result, path);
    },
    async guestNetwork(guest: Guest): Promise<RawRecord | RawRecord[]> {
      if (guest.status !== "running" || guest.template) return [];
      const endpoint = guest.type === "qemu" ? "agent/network-get-interfaces" : "interfaces";
      const path = `${guestPath(guest)}/${endpoint}`;
      const data = await request(path);
      return Array.isArray(data) ? records(data, path) : record(data, path);
    },
    async powerAction(guest: Guest, action: PowerAction): Promise<string> {
      const path = `${guestPath(guest)}/status/${action}`;
      const task = await request(path, { method: "POST" });
      if (typeof task !== "string" || !/^UPID:[^:]+:.+/.test(task)) throw new ApiResponseError(path, "a UPID task identifier");
      return task;
    },
    async taskStatus(node: string, upid: string): Promise<RawRecord> {
      const path = `${nodePath(node)}/tasks/${encodeURIComponent(upid)}/status`;
      const status = record(await request(path), path);
      if (typeof status.status !== "string") throw new ApiResponseError(path, "a task status");
      return status;
    },
  };
}

export type DashboardApi = ReturnType<typeof createDashboardApi>;
