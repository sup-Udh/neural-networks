"use client";

import { useSyncExternalStore } from "react";
import type { CompanionId } from "./companionTypes";

const KEY = "neuralarc:companion";
const EVENT = "neuralarc:companion-change";

export function readCompanion(): CompanionId | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "rune" || value === "sol" ? value : null;
  } catch {
    return null;
  }
}

export function saveCompanion(id: CompanionId) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage unavailable: the selection simply will not persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** `undefined` on the server and before hydration, `null` when nothing is saved. */
export function useSavedCompanion(): CompanionId | null | undefined {
  return useSyncExternalStore(subscribe, readCompanion, () => undefined);
}
