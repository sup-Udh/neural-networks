"use client";

import { useSyncExternalStore } from "react";
import { createPersistedStore } from "./persisted";
import type { PersistedStore } from "./persisted";

export interface Note {
  id: string;
  text: string;
  lessonId: string;
  sectionId: string;
  annotation: string;
  createdAt: number;
}

export const LESSON_ID = "neuron-basics";

const isNote = (v: unknown): v is Note => {
  const n = v as Note;
  return !!n && typeof n.id === "string" && typeof n.text === "string" && typeof n.sectionId === "string" && typeof n.createdAt === "number";
};

export const notesStore = createPersistedStore<Note[]>("neuralarc:v1:notes", 1, [], (data) =>
  Array.isArray(data) ? data.filter(isNote).map((n) => ({ ...n, annotation: typeof n.annotation === "string" ? n.annotation : "", lessonId: n.lessonId ?? LESSON_ID })) : null,
);

export interface Prefs {
  /** Reading scale in percent. */
  readScale: number;
}
export const READ_SCALE = { min: 90, max: 125, step: 5, base: 100 } as const;

export const prefsStore = createPersistedStore<Prefs>("neuralarc:v1:prefs", 1, { readScale: 100 }, (data) => {
  const scale = (data as Prefs | null)?.readScale;
  return typeof scale === "number" && scale >= READ_SCALE.min && scale <= READ_SCALE.max ? { readScale: scale } : null;
});

export interface Progress {
  challengeComplete: boolean;
}
export const progressStore = createPersistedStore<Progress>("neuralarc:v1:progress", 1, { challengeComplete: false }, (data) =>
  typeof (data as Progress | null)?.challengeComplete === "boolean" ? { challengeComplete: (data as Progress).challengeComplete } : null,
);

export interface FocusPrefs {
  /** Enter focus reading automatically after inactivity. Manual focus works either way. */
  auto: boolean;
  delaySec: number;
}
export const focusStore = createPersistedStore<FocusPrefs>("neuralarc:v1:focus", 1, { auto: true, delaySec: 13 }, (data) => {
  const d = data as FocusPrefs | null;
  return d && typeof d.auto === "boolean" && typeof d.delaySec === "number" ? { auto: d.auto, delaySec: Math.min(15, Math.max(12, Math.round(d.delaySec))) } : null;
});

export function usePersisted<T>(store: PersistedStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

/** Adds a note unless the same passage in the same section is already saved. Returns false for a duplicate. */
export function addNote(text: string, sectionId: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  const notes = notesStore.get();
  if (notes.some((n) => n.sectionId === sectionId && n.text === clean)) return false;
  const note: Note = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, text: clean, lessonId: LESSON_ID, sectionId, annotation: "", createdAt: Date.now() };
  notesStore.set([note, ...notes]);
  return true;
}

export const deleteNote = (id: string) => notesStore.set(notesStore.get().filter((n) => n.id !== id));
export const annotateNote = (id: string, annotation: string) =>
  notesStore.set(notesStore.get().map((n) => (n.id === id ? { ...n, annotation } : n)));
