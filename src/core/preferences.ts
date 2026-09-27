const STORAGE_KEY = "pve-lite-dashboard.preferences.v1";

interface PreferenceValues {
  language: string | null;
  configOverrides: Record<string, unknown>;
  infrastructureOpen: boolean;
  virtualOpen: boolean;
  collapsedBlocks: string[];
  collapsedPools: string[];
  expandedNodes: string[];
  expandedStorages: string[];
  expandedGuests: string[];
}

type SetPreferenceKey = "collapsedBlocks" | "collapsedPools" | "expandedNodes" | "expandedStorages" | "expandedGuests";

const defaults: PreferenceValues = {
  language: null,
  configOverrides: {},
  infrastructureOpen: true,
  virtualOpen: true,
  collapsedBlocks: [],
  collapsedPools: [],
  expandedNodes: [],
  expandedStorages: [],
  expandedGuests: [],
};

function readStorage(): PreferenceValues {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<PreferenceValues> | null;
    const legacyLanguage = localStorage.getItem("pve-dashboard-language");
    return {
      ...defaults,
      ...(saved && typeof saved === "object" ? saved : {}),
      language: saved?.language || legacyLanguage || null,
    };
  } catch {
    return { ...defaults };
  }
}

let values = readStorage();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    localStorage.removeItem("pve-dashboard-language");
    return true;
  } catch {
    // 浏览器隐私设置可能禁用 localStorage，此时保持内存状态。
    return false;
  }
}

export const preferences = {
  get<K extends keyof PreferenceValues>(key: K, fallback?: PreferenceValues[K]): PreferenceValues[K] {
    return values[key] ?? fallback ?? defaults[key];
  },
  set<K extends keyof PreferenceValues>(key: K, value: PreferenceValues[K]) {
    values = { ...values, [key]: value };
    return persist();
  },
  getSet(key: SetPreferenceKey) {
    const value = values[key];
    return new Set(Array.isArray(value) ? value : []);
  },
  setSet(key: SetPreferenceKey, value: Set<string>) {
    return this.set(key, [...value]);
  },
  reset() {
    values = { ...defaults };
    persist();
  },
};
