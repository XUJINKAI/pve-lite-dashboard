import { afterEach, expect, it, vi } from "vitest";
import { createMockBackend } from "../../src/services/mock-data";
import { createDashboardApi } from "../../src/services/dashboard-api";
import { normalizeGuest } from "../../src/domain/resources";
import { extractDisks, extractGuestIPs } from "../../src/domain/guest-data";

afterEach(() => vi.useRealTimers());

it("keeps demo resources, configurations and network addresses consistent", async () => {
  vi.useFakeTimers();
  const api = createDashboardApi(createMockBackend());
  const task = (async () => {
    const guests = (await api.resources()).filter((item) => ["qemu", "lxc"].includes(item.type || "")).map(normalizeGuest);
    expect(guests).toHaveLength(8);
    const addresses = new Set<string>();
    for (const guest of guests) {
      const config = await api.guestConfig(guest);
      expect(config.cores).toBe(guest.maxcpu);
      expect(Number(config.memory) * 1024 ** 2).toBe(guest.maxmem);
      expect(extractDisks(config).reduce((sum, disk) => sum + disk.size, 0)).toBe(guest.maxdisk);
      for (const ip of extractGuestIPs(await api.guestNetwork(guest), config)) {
        expect(addresses.has(ip)).toBe(false);
        addresses.add(ip);
        if (!ip.includes(":")) expect(ip.split(".").every((octet) => Number(octet) <= 255)).toBe(true);
      }
    }
    const guest = guests.find((item) => item.vmid === 302)!;
    await api.powerAction(guest, "stop");
    expect((await api.resources()).find((item) => item.vmid === 302)).toMatchObject({ status: "stopped", mem: 0, uptime: 0 });
    await api.powerAction(guest, "start");
    expect((await api.resources()).find((item) => item.vmid === 302)).toMatchObject({ status: "running", uptime: 1 });
  })();
  await vi.runAllTimersAsync();
  await task;
});
