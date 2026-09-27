import type { Guest, RawRecord } from "../core/types";

export type PermissionMap = Record<string, RawRecord>;

export const permissionValue = (value: unknown) => value === 1 || value === true || value === "1";

export function hasPowerPermission(guest: Guest, permissions: PermissionMap) {
  if (guest.pool && permissionValue(permissions[`/pool/${guest.pool}`]?.["VM.PowerMgmt"])) return true;
  const direct = permissions[`/vms/${guest.vmid}`]?.["VM.PowerMgmt"];
  if (direct !== undefined && direct !== null) return permissionValue(direct);
  return permissionValue(permissions["/"]?.["VM.PowerMgmt"]);
}
