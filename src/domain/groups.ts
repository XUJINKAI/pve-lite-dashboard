import { defaultGuestCompare } from "./resources";
import { permissionValue, type PermissionMap } from "./permissions";
import type { Guest, Group, Pool } from "../core/types";

interface GroupPresentation {
  unassignedPosition: "first" | "last";
  unassignedTitle: string;
  templatesTitle: string;
}

export function groupGuests(guests: Guest[], pools: Pool[], permissions: PermissionMap, presentation: GroupPresentation): Group[] {
  const groups = new Map<string, Group>();
  for (const pool of pools) {
    const id = pool.poolid || pool.pool || pool.id;
    if (id) groups.set(String(id), { id: String(id), title: String(id), description: pool.comment || "", readable: true, guests: [] });
  }
  for (const path of Object.keys(permissions)) {
    const match = path.match(/^\/pool\/([^/]+)$/);
    if (match && !groups.has(match[1])) groups.set(match[1], { id: match[1], title: match[1], description: "", readable: false, guests: [] });
  }
  const hiddenPowerPools = [...groups.values()].filter((group) => group.readable === false && permissionValue(permissions[`/pool/${group.id}`]?.["VM.PowerMgmt"]));
  for (const guest of guests) {
    if (guest.template) {
      const templateGroup = groups.get("__templates") || { id: "__templates", title: presentation.templatesTitle, description: "", readable: true, guests: [] };
      templateGroup.guests.push(guest); groups.set("__templates", templateGroup); continue;
    }
    let id = guest.pool;
    const directPower = permissions[`/vms/${guest.vmid}`]?.["VM.PowerMgmt"];
    if (!id && hiddenPowerPools.length === 1 && directPower !== undefined) id = hiddenPowerPools[0].id;
    id ||= "__unassigned";
    if (!groups.has(id)) groups.set(id, { id, title: id === "__unassigned" ? presentation.unassignedTitle : id, description: "", readable: true, guests: [] });
    groups.get(id)!.guests.push(guest);
  }
  const unassignedFirst = presentation.unassignedPosition !== "last";
  return [...groups.values()].map((group) => ({ ...group, guests: [...group.guests].sort(defaultGuestCompare) })).sort((a, b) => {
    if (a.id === "__templates") return 1;
    if (b.id === "__templates") return -1;
    if (a.id === "__unassigned") return unassignedFirst ? -1 : 1;
    if (b.id === "__unassigned") return unassignedFirst ? 1 : -1;
    return a.title.localeCompare(b.title, "zh-CN", { numeric: true });
  });
}
