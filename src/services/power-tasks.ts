import type { Guest } from "../core/types";
import type { DashboardApi } from "./dashboard-api";

export class TaskTimeoutError extends Error {}

export async function waitForPowerTask(api: DashboardApi, guest: Guest, task: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    const status = await api.taskStatus(guest.node || "", task);
    if (status?.status !== "stopped") continue;
    if (status.exitstatus !== "OK") throw new Error(String(status.exitstatus || "Missing task exit status"));
    return status;
  }
  throw new TaskTimeoutError();
}
