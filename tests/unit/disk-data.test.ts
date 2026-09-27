import { describe, expect, it } from "vitest";
import { diskSmartInfo } from "../../src/domain/disk-data";
import { formatFilesystemUsage } from "../../src/domain/guest-data";

describe("disk display data", () => {
  it("extracts NVMe SMART text and SATA attributes with independent missing fields", () => {
    expect(diskSmartInfo({ smart: { text: "Temperature: 38 Celsius\nPower On Hours: 1,234\nData Units Read: 123 [6.3 TB]" } })).toMatchObject({ temperature: "38 °C", hours: "1234", read: "6.3 TB", write: "—" });
    expect(diskSmartInfo({ smart: { attributes: [{ name: "Temperature_Celsius", raw: "32 (Min/Max 20/44)" }, { name: "Power_On_Hours", raw: "456" }] } })).toMatchObject({ temperature: "32 °C", hours: "456", read: "—" });
    expect(diskSmartInfo({})).toMatchObject({ temperature: "—", hours: undefined, health: "—" });
  });

  it("uses valid root filesystem capacity and preserves zero usage", () => {
    expect(formatFilesystemUsage([{ mountpoint: "/boot/efi", "used-bytes": 20, "total-bytes": 100 }, { mountpoint: "/", "used-bytes": 0, "total-bytes": 48 * 1024 ** 3 }])).toBe("0.00 / 48.00 GB");
    expect(formatFilesystemUsage([{ mountpoint: "/", "used-bytes": 1024 }])).toBe("—");
    expect(formatFilesystemUsage([{ mountpoint: "/", "used-bytes": 12, "total-bytes": 0 }])).toBe("—");
    expect(formatFilesystemUsage(undefined)).toBe("—");
  });
});
