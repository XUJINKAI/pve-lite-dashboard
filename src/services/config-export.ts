import { formatGuestConfig } from "../domain/guest-data";
import { normalizeGuest } from "../domain/resources";
import type { DashboardApi } from "./dashboard-api";

export async function exportGuestConfigs(api: Pick<DashboardApi, "resources" | "guestConfig">, onProgress: (done: number, total: number) => void) {
  const guests = (await api.resources()).filter((item) => item.type === "qemu" || item.type === "lxc")
    .map(normalizeGuest).sort((a, b) => a.vmid - b.vmid || a.id.localeCompare(b.id));
  const sections: string[] = [];
  let done = 0;
  let failed = 0;
  onProgress(0, guests.length);
  for (let index = 0; index < guests.length; index += 4) {
    const batch = guests.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async (guest) => {
      try { return formatGuestConfig(await api.guestConfig(guest)); }
      finally { onProgress(++done, guests.length); }
    }));
    results.forEach((result, offset) => {
      const guest = batch[offset];
      const heading = `===== ${guest.type.toUpperCase()} ${guest.vmid} · ${guest.name} · ${guest.node || "—"}${guest.template ? " · template" : ""} =====`;
      if (result.status === "fulfilled") sections.push(`${heading}\n${result.value || "(empty configuration)"}`);
      else {
        failed++;
        sections.push(`${heading}\n[ERROR] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    });
  }
  const exportedAt = new Date().toISOString();
  return {
    total: guests.length,
    failed,
    filename: `pve-vm-configs-${exportedAt.replace(/[:.]/g, "-")}.txt`,
    text: `PVE VM configuration export\nExported at: ${exportedAt}\nTotal: ${guests.length}\nSucceeded: ${guests.length - failed}\nFailed: ${failed}\n\n${sections.join("\n\n")}\n`,
  };
}
