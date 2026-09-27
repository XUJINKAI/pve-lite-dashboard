import { describe, expect, it } from "vitest";
import { guestVisible, normalizeGuest } from "../../src/domain/resources";
import type { DashboardConfig } from "../../src/core/config";

const visibilityConfig = {
  resources: {
    virtual: { show: true, qemu: true, lxc: true, templates: true, stopped: true, excludeVmids: [] as (number | [number, number])[] },
  },
};

describe("resource domain rules", () => {
  it("normalizes a suspended lock before interpreting the reported status", () => {
    const guest = normalizeGuest({
      type: "qemu",
      vmid: 201,
      name: "paused-vm",
      status: "stopped",
      lock: "suspended",
    });

    expect(guest.status).toBe("suspended");
  });

  it("applies master, type, template, stopped, and VMID exclusion switches", () => {
    const config = {
      ...visibilityConfig,
      resources: {
        ...visibilityConfig.resources,
        virtual: { ...visibilityConfig.resources.virtual, excludeVmids: [[100, 200] as [number, number], 250] },
      },
    };

    const typedConfig = config as unknown as DashboardConfig;
    expect(guestVisible(normalizeGuest({ type: "qemu", vmid: 101 }), typedConfig)).toBe(false);
    expect(guestVisible(normalizeGuest({ type: "qemu", vmid: 150 }), typedConfig)).toBe(false);
    expect(guestVisible(normalizeGuest({ type: "qemu", vmid: 201 }), typedConfig)).toBe(true);
    expect(guestVisible(normalizeGuest({ type: "qemu", vmid: 250 }), typedConfig)).toBe(false);
    typedConfig.resources.virtual.qemu = false;
    expect(guestVisible(normalizeGuest({ type: "qemu", vmid: 201 }), typedConfig)).toBe(false);
    typedConfig.resources.virtual.qemu = true;
    typedConfig.resources.virtual.templates = false;
    expect(guestVisible(normalizeGuest({ type: "qemu", vmid: 201, template: 1 }), typedConfig)).toBe(false);
    typedConfig.resources.virtual.stopped = false;
    expect(guestVisible(normalizeGuest({ type: "lxc", vmid: 202, status: "stopped" }), typedConfig)).toBe(false);
    typedConfig.resources.virtual.show = false;
    expect(guestVisible(normalizeGuest({ type: "lxc", vmid: 202, status: "running" }), typedConfig)).toBe(false);
  });
});
