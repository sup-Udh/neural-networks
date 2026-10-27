import type { Decision } from "./controller";
import type { EpisodeMetrics } from "./episode";

/*
 * High-frequency controller output lives here, outside React state and the persisted workspace. The controller
 * reports ~10 times per second; only components that subscribe re-render, not the whole page.
 */
export interface Live {
  decision: Decision | null;
  metrics: EpisodeMetrics | null;
}

let state: Live = { decision: null, metrics: null };
const listeners = new Set<() => void>();

export const liveStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  set(next: Live) {
    state = next;
    listeners.forEach((l) => l());
  },
  clear() {
    this.set({ decision: null, metrics: null });
  },
};
