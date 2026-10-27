/*
 * A tiny versioned localStorage store that works with useSyncExternalStore.
 * Missing, malformed or wrong-version data falls back to `fallback`; storage errors never throw.
 */

export interface PersistedStore<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
  getServer: () => T;
  /** Message from the most recent failed write (e.g. quota exceeded), or null if the last write succeeded. */
  getWriteError: () => string | null;
}

export function createPersistedStore<T>(key: string, version: number, fallback: T, parse: (data: unknown) => T | null): PersistedStore<T> {
  let cache = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();
  let writeError: string | null = null;

  const load = () => {
    loaded = true;
    cache = fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const envelope = JSON.parse(raw) as { version?: number; data?: unknown } | null;
      if (envelope && envelope.version === version) cache = parse(envelope.data) ?? fallback;
    } catch {
      cache = fallback;
    }
  };

  return {
    get: () => {
      if (typeof window === "undefined") return fallback;
      if (!loaded) load();
      return cache;
    },
    set: (next) => {
      cache = next;
      loaded = true;
      try {
        window.localStorage.setItem(key, JSON.stringify({ version, data: next }));
        writeError = null;
      } catch (error) {
        // Private mode or a full quota: the value still lives in memory for this session, but is NOT saved.
        writeError = error instanceof Error ? error.message : String(error);
      }
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        loaded = false;
        listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getServer: () => fallback,
    getWriteError: () => writeError,
  };
}
