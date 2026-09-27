export type GuestStatus = "running" | "stopped" | "suspended" | "unknown";

export type RawRecord = Record<string, unknown>;

export interface RawResource extends RawRecord {
  type?: string;
  id?: string;
  node?: string;
  vmid?: number | string;
  name?: string;
  status?: string;
  lock?: string;
  pool?: string;
  storage?: string;
  content?: string;
  loadavg?: string | string[];
  load?: string | string[];
}

export interface NodeStatus extends RawRecord {
  cpuinfo?: { model?: string; sockets?: number; cores?: number; cpus?: number };
  pveversion?: string;
  "current-kernel"?: { release?: string };
  rootfs?: { used?: number; total?: number };
  swap?: { used?: number; total?: number };
  loadavg?: string[];
  ksm?: { shared?: number };
}

export interface Pool extends RawRecord {
  poolid?: string;
  pool?: string;
  id?: string;
  comment?: string;
}

export interface NodeResource {
  name: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  load: string | string[] | null;
}

export interface StorageResource {
  id?: string;
  node?: string;
  name: string;
  status: string;
  disk: number;
  maxdisk: number;
  content: string;
}

export interface Guest {
  id: string;
  vmid: number;
  name: string;
  type: "qemu" | "lxc" | string;
  node?: string;
  pool: string | null;
  status: GuestStatus;
  cpu: number;
  maxcpu: number;
  mem: number;
  memhost: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  diskread: number;
  diskwrite: number;
  netin: number;
  netout: number;
  uptime: number;
  template: boolean;
}

export interface Group {
  id: string;
  title: string;
  description: string;
  readable: boolean;
  guests: Guest[];
}

export interface BackupTask extends RawRecord {
  id?: string | number;
  status?: string;
  starttime?: number;
  endtime?: number;
  nodeName?: string;
}

export interface GuestDetails extends RawRecord {
  _error?: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
}

export interface IpDialogState {
  title: string;
  ips: string[];
}

export type PowerAction = "start" | "shutdown" | "stop" | "reboot" | "suspend" | "resume";
