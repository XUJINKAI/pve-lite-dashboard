import { config } from "../core/config";
import { createMockBackend } from "./mock-data";

export function createDataService() {
  const query = new URLSearchParams(location.search);
  const requested = query.get("data");
  const requestedMode = requested === "mock" || requested === "live" ? requested : query.has("mock") ? "mock" : null;
  const configuredMode = config.app.dataSource || "auto";
  const isGitHubPages = location.hostname.endsWith(".github.io");
  const mode = requestedMode || (configuredMode === "auto" ? (isGitHubPages ? "mock" : "live") : configuredMode);
  const mockRequest = mode === "mock" ? createMockBackend() : null;

  async function request(path: string, options: RequestInit = {}) {
    if (mockRequest) return mockRequest(path, options);
    const response = await fetch(`${config.app.apiBase}${path}`, { method: options.method || "GET", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error" });
    let payload: { data?: unknown; errors?: unknown; message?: unknown } | null = null;
    try {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === "object") payload = parsed;
    } catch { /* HTTP errors may have no JSON body. */ }
    if (!response.ok) {
      const errors = payload?.errors;
      const errorMessage = typeof errors === "string" ? errors : errors && typeof errors === "object" ? Object.entries(errors).map(([key, value]) => `${key}: ${value}`).join("; ") : null;
      const error = new Error(String(errorMessage || payload?.message || (typeof payload?.data === "string" ? payload.data : null) || `${response.status} ${response.statusText}`));
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return payload?.data;
  }

  return { request, mode, isMock: mode === "mock" };
}
