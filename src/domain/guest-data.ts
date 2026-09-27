import { parseSize } from "../core/numbers";
import type { RawRecord } from "../core/types";

export function extractDisks(configData: RawRecord | null | undefined) {
  if (!configData || configData._error) return [];
  const diskKey = /^(ide|sata|scsi|virtio|rootfs|mp)\d*$/;
  return Object.entries(configData).filter(([key, value]) => diskKey.test(key) && typeof value === "string" && !value.includes("media=cdrom"))
    .map(([name, value]) => ({ name, size: parseSize(String(value).match(/(?:^|,)size=([^,]+)/)?.[1]) })).filter((disk) => disk.size > 0);
}

export function extractGuestIPs(networkData: RawRecord | RawRecord[] | null | undefined, configData: RawRecord | null | undefined) {
  const addresses: string[] = [];
  const interfaces = Array.isArray(networkData) ? networkData : Array.isArray(networkData?.result) ? networkData.result : [];
  for (const iface of interfaces) {
    const agentAddresses = Array.isArray(iface["ip-addresses"]) ? iface["ip-addresses"].map((item: RawRecord) => item["ip-address"] || item.address) : [];
    const containerAddresses = [iface.inet, iface.inet6].flatMap((value) => Array.isArray(value) ? value : [value]).map((value) => String(value || "").split("/")[0]);
    addresses.push(...agentAddresses.filter(Boolean).map(String), ...containerAddresses);
  }
  const usable = (values: string[]) => [...new Set(values.map((value) => String(value).trim()).filter((value) => value && value !== "127.0.0.1" && value !== "::1" && !value.startsWith("fe80:")))];
  const liveAddresses = usable(addresses);
  if (liveAddresses.length) return liveAddresses;
  if (configData) {
    for (const [key, value] of Object.entries(configData)) {
      if (!/^(?:net\d+|ipconfig\d+)$/.test(key) || typeof value !== "string") continue;
      addresses.push(...[...value.matchAll(/(?:^|,)ip6?=([^,]+)/g)].map((match) => match[1].split("/")[0]).filter((value) => !["dhcp", "auto", "manual"].includes(value)));
    }
  }
  return usable(addresses);
}

export function formatFilesystemUsage(filesystems: RawRecord[] | undefined) {
  const valid = (filesystems || []).filter((fs) => typeof fs["used-bytes"] === "number" && Number.isFinite(fs["used-bytes"]) && fs["used-bytes"] >= 0
    && typeof fs["total-bytes"] === "number" && Number.isFinite(fs["total-bytes"]) && fs["total-bytes"] > 0);
  const root = valid.find((fs) => fs.mountpoint === "/");
  const rows = root ? [root] : valid.filter((fs) => fs.mountpoint !== "/boot/efi");
  return rows.map((fs) => `${rows.length > 1 ? `${fs.mountpoint} ` : ""}${(Number(fs["used-bytes"]) / 1024 ** 3).toFixed(2)} / ${(Number(fs["total-bytes"]) / 1024 ** 3).toFixed(2)} GB`).join(" · ") || "—";
}

export function formatGuestConfig(data: RawRecord) {
  return Object.entries(data).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join("\n");
}
