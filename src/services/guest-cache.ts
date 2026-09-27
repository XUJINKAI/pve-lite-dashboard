import { shallowRef } from "vue";
import type { Guest } from "../core/types";

interface CacheOptions<T> {
  fingerprint: (guest: Guest) => string;
  load: (guest: Guest) => Promise<T>;
  errorValue: (error: unknown) => T;
  retryAfterMs?: number;
}

interface CacheEntry {
  fingerprint: string;
  generation: number;
  failedAt: number | null;
}

export function createGuestCache<T>(options: CacheOptions<T>) {
  const values = shallowRef(new Map<string, T>());
  const loading = shallowRef(new Set<string>());
  const entries = new Map<string, CacheEntry>();
  const requests = new Map<string, Promise<void>>();
  const retryAfterMs = options.retryAfterMs ?? 30_000;

  function invalidate(id: string) {
    const entry = entries.get(id);
    if (entry) entry.generation += 1;
    entries.delete(id);
    if (values.value.has(id)) {
      const next = new Map(values.value);
      next.delete(id);
      values.value = next;
    }
    if (loading.value.has(id)) {
      const next = new Set(loading.value);
      next.delete(id);
      loading.value = next;
    }
    requests.delete(id);
  }

  function ensure(guest: Guest, force = false): Promise<void> {
    const id = guest.id;
    const fingerprint = options.fingerprint(guest);
    if (entries.get(id)?.fingerprint !== fingerprint) invalidate(id);
    let entry = entries.get(id);
    if (!entry) {
      entry = { fingerprint, generation: 0, failedAt: null };
      entries.set(id, entry);
    }
    const inFlight = requests.get(id);
    if (inFlight) return inFlight;
    if (!force && values.value.has(id) && (entry.failedAt === null || Date.now() - entry.failedAt < retryAfterMs)) return Promise.resolve();

    const generation = entry.generation;
    const nextLoading = new Set(loading.value);
    nextLoading.add(id);
    loading.value = nextLoading;
    const promise = options.load(guest).then((data) => {
      if (entries.get(id) !== entry || entry.generation !== generation) return;
      entry.failedAt = null;
      values.value = new Map(values.value).set(id, data);
    }).catch((error: unknown) => {
      if (entries.get(id) !== entry || entry.generation !== generation) return;
      entry.failedAt = Date.now();
      values.value = new Map(values.value).set(id, options.errorValue(error));
    }).finally(() => {
      if (entries.get(id) !== entry || entry.generation !== generation) return;
      const next = new Set(loading.value);
      next.delete(id);
      loading.value = next;
      requests.delete(id);
    });
    requests.set(id, promise);
    return promise;
  }

  function reconcile(guests: Guest[], force = false) {
    const current = new Map(guests.map((guest) => [guest.id, guest]));
    const reload: Promise<void>[] = [];
    for (const [id, entry] of entries) {
      const guest = current.get(id);
      if (!guest) {
        invalidate(id);
      } else if (force || entry.fingerprint !== options.fingerprint(guest) || entry.failedAt !== null) {
        reload.push(ensure(guest, force));
      }
    }
    return Promise.all(reload);
  }

  return { values, loading, ensure, reconcile, invalidate };
}
