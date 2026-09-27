import type { RawRecord } from "../core/types";

export function diskSmartInfo(disk: RawRecord) {
  const smart = disk.smart && typeof disk.smart === "object" ? disk.smart as RawRecord : {};
  const text = typeof smart.text === "string" ? smart.text.trim() : "";
  const attributes = Array.isArray(smart.attributes) ? smart.attributes as RawRecord[] : [];
  const field = (label: string) => text.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim();
  const attribute = (pattern: RegExp) => attributes.find((item) => pattern.test(String(item.name)))?.raw;
  const temperature = field("Temperature")?.match(/^-?\d+(?:\.\d+)?/)?.[0]
    ?? String(attribute(/^(Temperature_Celsius|Airflow_Temperature_Cel)$/) ?? "").match(/^-?\d+/)?.[0];
  const hours = field("Power On Hours")?.replaceAll(",", "").match(/^\d+/)?.[0]
    ?? String(attribute(/^Power_On_Hours$/) ?? "").match(/^\d+/)?.[0];
  const health = typeof smart.health === "string" ? smart.health : typeof disk.health === "string" ? disk.health : "—";
  return {
    temperature: temperature === undefined ? "—" : `${temperature} °C`,
    hours,
    read: field("Data Units Read")?.match(/\[([^\]]+)\]/)?.[1] ?? "—",
    write: field("Data Units Written")?.match(/\[([^\]]+)\]/)?.[1] ?? "—",
    health,
  };
}
