import { describe, expect, it } from "vitest";
import { normalizeGuest } from "../../src/domain/resources";
import { groupGuests } from "../../src/domain/groups";
import { hasPowerPermission } from "../../src/domain/permissions";

describe("pool grouping", () => {
  it("keeps PVE membership separate from display grouping", () => {
    const guest = normalizeGuest({ type: "qemu", vmid: 101, status: "stopped" });
    const permissions = {
      "/pool/hidden": { "VM.PowerMgmt": 1 },
      "/vms/101": { "VM.PowerMgmt": 0 },
    };
    const groups = groupGuests([guest], [], permissions, {
      unassignedPosition: "first",
      unassignedTitle: "Unassigned",
      templatesTitle: "Templates",
    });

    expect(groups.find((group) => group.id === "hidden")?.guests).toContain(guest);
    expect(guest.pool).toBeNull();
    expect(hasPowerPermission(guest, permissions)).toBe(false);
  });
});
