import { ref, shallowRef } from "vue";

export function createSnapshotCache<T>(load: (previous: T | null, key: string) => Promise<T>) {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = shallowRef<unknown>(null);
  let activeRequest: Promise<void> | null = null;
  let currentKey: string | null = null;
  let generation = 0;

  function refresh(key = "default") {
    if (currentKey !== key) {
      currentKey = key;
      generation += 1;
      activeRequest = null;
      data.value = null;
      error.value = null;
    }
    if (activeRequest) return activeRequest;
    const requestGeneration = generation;
    loading.value = true;
    activeRequest = load(data.value, key).then((result) => {
      if (requestGeneration !== generation) return;
      data.value = result;
      error.value = null;
    }).catch((reason: unknown) => {
      if (requestGeneration !== generation) return;
      error.value = reason;
    }).finally(() => {
      if (requestGeneration !== generation) return;
      loading.value = false;
      activeRequest = null;
    });
    return activeRequest;
  }

  return { data, loading, error, refresh };
}
