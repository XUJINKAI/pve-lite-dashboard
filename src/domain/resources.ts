import { num } from "../core/numbers";
import type { DashboardConfig } from "../core/config";
import type { Guest, NodeResource, RawResource, StorageResource } from "../core/types";

export function normalizeNode(raw: RawResource): NodeResource {
  return { name: raw.node || raw.name || "unknown", status: raw.status || "unknown", cpu: num(raw.cpu), maxcpu: num(raw.maxcpu), mem: num(raw.mem), maxmem: num(raw.maxmem), disk: num(raw.disk), maxdisk: num(raw.maxdisk), uptime: num(raw.uptime), load: raw.loadavg || raw.load || null };
}

export function normalizeStorage(raw: RawResource): StorageResource {
  const name = raw.storage || String(raw.id || "").replace(/^storage\//, "");
  return { id: raw.id, node: raw.node, name: name || raw.name || "unknown", status: raw.status || "unknown", disk: num(raw.disk), maxdisk: num(raw.maxdisk), content: raw.content || "" };
}

export function normalizeGuest(raw: RawResource): Guest {
  const status = (raw.lock === "suspended" || raw.status === "paused" ? "suspended" : (raw.status || "unknown")) as Guest["status"];
  return { id: `${raw.type}:${raw.vmid}`, vmid: Number(raw.vmid), name: raw.name || `${raw.type}-${raw.vmid}`, type: raw.type || "unknown", node: raw.node, pool: raw.pool || null, status, cpu: num(raw.cpu), maxcpu: num(raw.maxcpu), mem: num(raw.mem), memhost: num(raw.memhost), maxmem: num(raw.maxmem), disk: num(raw.disk), maxdisk: num(raw.maxdisk), diskread: num(raw.diskread), diskwrite: num(raw.diskwrite), netin: num(raw.netin), netout: num(raw.netout), uptime: num(raw.uptime), template: Boolean(Number(raw.template)) };
}

export function guestVisible(guest: Guest, config: DashboardConfig) {
  const options = config.resources.virtual;
  if (!options.show || (guest.type === "qemu" ? !options.qemu : !options.lxc)) return false;
  if ((guest.template && !options.templates) || (guest.status === "stopped" && !options.stopped)) return false;
  return !rulesMatch(guest.vmid, options.excludeVmids);
}

export function resourceVisible(_resource: NodeResource | StorageResource, kind: "node" | "storage", config: DashboardConfig) {
  return config.resources.physical.show && config.resources.physical[kind];
}

function rulesMatch(value: number, rules: DashboardConfig["resources"]["virtual"]["excludeVmids"]) {
  return rules.some((rule) => Array.isArray(rule) ? value >= rule[0] && value <= rule[1] : value === rule);
}

export const defaultGuestCompare = (a: Guest, b: Guest) => a.vmid - b.vmid;
