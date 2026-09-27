import { describe, expect, it } from "vitest";
import { extractGuestIPs } from "../../src/domain/guest-data";

describe("guest IP extraction", () => {
  it("uses configured addresses when runtime interfaces have no usable IP", () => {
    const runtime = { result: [{ "ip-addresses": [{ "ip-address": "fe80::1" }, { "ip-address": "127.0.0.1" }] }] };
    expect(extractGuestIPs(runtime, { ipconfig0: "ip=10.20.0.5/24,ip6=auto" })).toEqual(["10.20.0.5"]);
    expect(extractGuestIPs({ _error: "offline" }, { net0: "name=eth0,bridge=vmbr0,ip=10.30.0.6/24,ip6=manual" })).toEqual(["10.30.0.6"]);
  });

  it("prefers usable runtime addresses", () => {
    expect(extractGuestIPs({ result: [{ "ip-addresses": [{ "ip-address": "10.40.0.7" }] }] }, { ipconfig0: "ip=10.40.0.8/24" })).toEqual(["10.40.0.7"]);
  });
});
