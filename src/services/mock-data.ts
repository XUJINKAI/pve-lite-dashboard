import type { RawRecord } from "../core/types";

const GB = 1024 ** 3;
const now = () => Math.floor(Date.now() / 1000);

export function createMockBackend() {
  const resources: RawRecord[] = [
    { type: "node", id: "node/demo-pve", node: "demo-pve", status: "online", cpu: .28, maxcpu: 16, mem: 38 * GB, maxmem: 64 * GB, disk: 42 * GB, maxdisk: 120 * GB, uptime: 1843200 },
    { type: "storage", id: "storage/demo-pve/local", node: "demo-pve", storage: "local", status: "available", plugintype: "dir", shared: 0, content: "iso,backup,snippets", disk: 42 * GB, maxdisk: 120 * GB },
    { type: "storage", id: "storage/demo-pve/vm-data", node: "demo-pve", storage: "vm-data", status: "available", plugintype: "lvmthin", shared: 0, content: "images,rootdir", disk: 840 * GB, maxdisk: 2 * 1024 * GB },
    { type: "qemu", id: "qemu/101", vmid: 101, name: "gateway", node: "demo-pve", pool: "infrastructure", status: "running", cpu: .13, maxcpu: 2, mem: 1.3 * GB, memhost: 1.5 * GB, maxmem: 2 * GB, maxdisk: 32 * GB, diskread: 16 * GB, diskwrite: 7 * GB, netin: 28 * GB, netout: 21 * GB, uptime: 950400 },
    { type: "qemu", id: "qemu/110", vmid: 110, name: "docker-core", node: "demo-pve", pool: "infrastructure", status: "running", cpu: .46, maxcpu: 4, mem: 5.1 * GB, memhost: 4.7 * GB, maxmem: 8 * GB, maxdisk: 96 * GB, diskread: 310 * GB, diskwrite: 126 * GB, netin: 490 * GB, netout: 112 * GB, uptime: 2102400 },
    { type: "qemu", id: "qemu/201", vmid: 201, name: "dev-linux", node: "demo-pve", pool: "development", status: "running", cpu: .84, maxcpu: 8, mem: 11.4 * GB, memhost: 12.1 * GB, maxmem: 16 * GB, maxdisk: 128 * GB, diskread: 88 * GB, diskwrite: 54 * GB, netin: 62 * GB, netout: 19 * GB, uptime: 518400 },
    { type: "qemu", id: "qemu/202", vmid: 202, name: "windows-lab", node: "demo-pve", pool: "development", status: "paused", cpu: .03, maxcpu: 4, mem: 6.2 * GB, memhost: 7 * GB, maxmem: 8 * GB, maxdisk: 128 * GB, diskread: 41 * GB, diskwrite: 22 * GB, netin: 9 * GB, netout: 4 * GB, uptime: 172800 },
    { type: "lxc", id: "lxc/301", vmid: 301, name: "monitoring", node: "demo-pve", pool: "services", status: "stopped", cpu: 0, maxcpu: 2, mem: 0, memhost: 0, maxmem: 4 * GB, maxdisk: 24 * GB, diskread: 5 * GB, diskwrite: 3 * GB, netin: 2 * GB, netout: 1 * GB, uptime: 0 },
    { type: "lxc", id: "lxc/302", vmid: 302, name: "dns-cache", node: "demo-pve", pool: "services", status: "running", cpu: .04, maxcpu: 1, mem: .18 * GB, maxmem: .5 * GB, maxdisk: 8 * GB, uptime: 864000 },
    { type: "qemu", id: "qemu/203", vmid: 203, name: "build-runner", node: "demo-pve", pool: "development", status: "stopped", cpu: 0, maxcpu: 4, mem: 0, maxmem: 8 * GB, maxdisk: 80 * GB, uptime: 0 },
    { type: "qemu", id: "qemu/900", vmid: 900, name: "debian-cloud-template", node: "demo-pve", template: 1, status: "stopped", cpu: 0, maxcpu: 2, mem: 0, maxmem: 2 * GB, maxdisk: 16 * GB, uptime: 0 },
  ];
  const pools = [{ poolid: "infrastructure", comment: "Core services" }, { poolid: "development", comment: "Development workloads" }, { poolid: "services", comment: "Auxiliary services" }, { poolid: "staging", comment: "Ready for new workloads" }];
  const permissions = { "/": { "Sys.Audit": 1, "VM.Audit": 1, "Datastore.Audit": 1 }, "/pool/infrastructure": { "Pool.Audit": 1, "VM.PowerMgmt": 1 }, "/pool/development": { "Pool.Audit": 1, "VM.PowerMgmt": 1 }, "/pool/services": { "Pool.Audit": 1, "VM.PowerMgmt": 1 } };
  const nodeStatus = { pveversion: "pve-manager/9.2.2/demo", "current-kernel": { release: "6.14.8-pve" }, cpuinfo: { model: "AMD Ryzen 9 5950X", sockets: 1, cores: 16, cpus: 32 }, rootfs: { used: 42 * GB, total: 120 * GB }, swap: { used: 1.2 * GB, total: 8 * GB }, loadavg: ["1.21", "1.08", "0.96"], ksm: { shared: 3.4 * GB } };
  const disks = [{ devpath: "/dev/nvme0n1", model: "Samsung SSD 980 PRO", type: "nvme", size: 2 * 1024 * GB, health: "PASSED", wearout: 94 }, { devpath: "/dev/sda", model: "Demo SATA SSD", type: "sata", size: 480 * GB, health: "PASSED", wearout: 78 }];
  const networks = [{ iface: "vmbr0", type: "bridge", active: 1, cidr: "10.10.0.10/24", bridge_ports: "eno1" }, { iface: "vmbr1", type: "bridge", active: 1, comments: "Isolated lab network", bridge_ports: "" }, { iface: "eno1", type: "eth", active: 1 }];
  const backups = [101, 110, 201, 202, 301, 302, 203].map((id, index) => ({ id: String(id), type: "vzdump", status: index === 4 ? "WARNINGS" : "OK", starttime: now() - (index + 1) * 86400, endtime: now() - (index + 1) * 86400 + 90 }));

  return async function mockRequest(path: string, options: RequestInit = {}) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const guestMatch = path.match(/^\/nodes\/demo-pve\/(qemu|lxc)\/(\d+)\/(.+)$/);
    const guest = guestMatch && resources.find((item) => item.type === guestMatch[1] && String(item.vmid) === guestMatch[2]);
    if (guestMatch && !guest) throw new Error("Demo guest not found");
    if (options.method === "POST") {
      const action = guestMatch?.[3].match(/^status\/(start|shutdown|stop|reboot|suspend|resume)$/)?.[1];
      if (!guest || !action || guest.template) throw new Error("Unsupported demo power action");
      guest.status = { start: "running", shutdown: "stopped", stop: "stopped", reboot: "running", suspend: "paused", resume: "running" }[action];
      guest.cpu = 0;
      if (guest.status === "stopped") { guest.mem = 0; guest.memhost = 0; guest.uptime = 0; }
      else if (action === "start") { guest.mem = Number(guest.maxmem) * .2; guest.memhost = guest.mem; guest.uptime = 1; }
      else if (action === "reboot") guest.uptime = 1;
      return `UPID:demo-pve:MOCK:${Date.now()}`;
    }
    if (path === "/cluster/resources") return resources.map((item) => ({ ...item }));
    if (path === "/pools") return pools;
    if (path === "/access/permissions") return permissions;
    if (path.includes("/tasks/UPID%3A") && path.endsWith("/status")) return { status: "stopped", exitstatus: "OK" };
    if (path.endsWith("/status")) return nodeStatus;
    if (path.includes("/disks/smart?")) {
      if (decodeURIComponent(path).endsWith("/dev/sda")) return { health: "PASSED", attributes: [
        { id: 194, name: "Temperature_Celsius", raw: "33" },
        { id: 9, name: "Power_On_Hours", raw: "7200" },
      ] };
      return { health: "PASSED", type: "text", text: "Temperature: 41 Celsius\nPower On Hours: 3,523\nData Units Read: 27,829,180 [14.2 TB]\nData Units Written: 44,357,027 [22.7 TB]\nMedia and Data Integrity Errors: 0" };
    }
    if (path.endsWith("/agent/get-fsinfo")) {
      if (!guest || guest.status !== "running") throw new Error("Demo guest agent unavailable");
      const total = Number(guest.maxdisk) * .9;
      return { result: [{ mountpoint: "/", "used-bytes": total * .42, "total-bytes": total }] };
    }
    if (path.endsWith("/disks/list")) return disks;
    if (path.endsWith("/network")) return networks;
    if (path.includes("/agent/network-get-interfaces")) {
      if (!guest || guest.status !== "running") throw new Error("Demo guest agent unavailable");
      const addresses = [{ "ip-address": `10.10.0.${guest.vmid}`, "ip-address-type": "ipv4" }, { "ip-address": "fe80::1", "ip-address-type": "ipv6" }];
      if (guest.vmid === 201) addresses.push({ "ip-address": "10.20.0.201", "ip-address-type": "ipv4" }, { "ip-address": "2001:db8::201", "ip-address-type": "ipv6" });
      return { result: [{ name: "eth0", "ip-addresses": addresses }] };
    }
    if (path.endsWith("/interfaces")) {
      if (!guest || guest.status !== "running") throw new Error("Demo container stopped");
      return [{ name: "eth0", inet: `10.10.1.${Number(guest.vmid) - 300}/24` }];
    }
    if (path.includes("/tasks?")) return backups;
    if (path.endsWith("/config") && guest) {
      const common = { cores: guest.maxcpu, memory: Number(guest.maxmem) / 1024 ** 2, onboot: guest.template ? 0 : 1, description: "Fictional demo workload", ...(guest.template ? { template: 1 } : {}) };
      const size = Number(guest.maxdisk) / GB;
      return guest.type === "lxc"
        ? { ...common, hostname: guest.name, ostype: "debian", unprivileged: 1, rootfs: `vm-data:subvol-${guest.vmid}-disk-0,size=${size}G`, net0: `name=eth0,bridge=vmbr0,ip=10.10.1.${Number(guest.vmid) - 300}/24,gw=10.10.1.254` }
        : { ...common, name: guest.name, agent: 1, ostype: guest.vmid === 202 ? "win11" : "l26", scsi0: `vm-data:vm-${guest.vmid}-disk-0,size=${size}G`, net0: "virtio,bridge=vmbr0", ipconfig0: guest.template ? "ip=dhcp" : `ip=10.10.0.${guest.vmid}/24,gw=10.10.0.254` };
    }
    throw new Error(`Unsupported demo endpoint: ${path}`);
  };
}
