/*
 * Focus Reading Mode controller. Framework-free so pointer noise never re-renders React:
 * it owns one idle timer and one set of listeners, drives the state machine, and only reports state changes.
 *
 * It never touches window.scrollY. "Moving the passage" is a local transform on the article wrapper, applied
 * once and released on exit, and the passage text itself is the real DOM text (never copied).
 */
import { clamp, growGroup, pickPassage, transition } from "@/lib/reading/focusReading";
import type { FocusEvent, FocusState } from "@/lib/reading/focusReading";

export interface FocusOptions {
  auto: boolean;
  delayMs: number;
  reducedMotion: boolean;
}

const ARTICLE = "[data-docs-content]";
const PASSAGE = `${ARTICLE} .doc-section > p, ${ARTICLE} .doc-section > ul`;
const SKIP = ".doc-eyebrow, .doc-end, [data-no-toolbar]";
const HEADER_H = 56;
const ENTER_MS = 560;
const EXIT_MS = 380;
const REDUCED_ENTER_MS = 200;
const REDUCED_EXIT_MS = 150;
const GRACE_MS = 700; // pointer noise from the click that started a manual focus must not end it
const POINTER_SLOP = 8;
const FONT_SCALE = 1.14;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);

function editableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") return !["range", "checkbox", "radio", "button", "submit"].includes((el as HTMLInputElement).type);
  return false;
}

function selectionActive(): boolean {
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;
}

function union(els: HTMLElement[]) {
  const first = els[0].getBoundingClientRect();
  const last = els[els.length - 1].getBoundingClientRect();
  return { top: first.top, bottom: last.bottom, height: last.bottom - first.top };
}

export interface FocusController {
  start: () => void;
  stop: () => void;
  /** Re-reads the options (auto on/off, delay) and re-arms the idle timer. */
  refresh: () => void;
  enter: (manual: boolean) => boolean;
  exit: () => void;
  toggle: () => void;
}

export function createFocusController(getOptions: () => FocusOptions, onState: (state: FocusState) => void): FocusController {
  const root = document.documentElement;
  let state: FocusState = "normal";
  let lastActivity = performance.now();
  let idleTimer = 0;
  let settleTimer = 0;
  let graceUntil = 0;
  let ignoreScrollUntil = 0;
  let held = false;
  let anchor: { x: number; y: number } | null = null;
  let group: HTMLElement[] = [];

  const send = (event: FocusEvent) => {
    const next = transition(state, event);
    if (next === state) return false;
    state = next;
    if (next === "normal") delete root.dataset.frState;
    else root.dataset.frState = next;
    onState(next);
    return true;
  };

  const releaseVars = () => ["--fr-dx", "--fr-dy", "--fr-scale", "--fr-dur"].forEach((v) => root.style.removeProperty(v));

  /** Everything that must stop a quiet moment from counting as "reading". */
  const blocked = () =>
    document.visibilityState !== "visible" ||
    held ||
    editableFocused() ||
    selectionActive() ||
    document.querySelector("[data-fr-block], [data-fr-busy]") !== null;

  /** The passage (or short run of passages) to focus, or null when nothing suitable is on screen. */
  const choosePassage = (): HTMLElement[] | null => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(PASSAGE)).filter((el) => !el.closest(SKIP));
    const usable = { top: HEADER_H + 16, bottom: window.innerHeight - 16 };
    const picked = pickPassage(
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, chars: (el.textContent ?? "").trim().length, inActiveSection: !!el.closest(".doc-section.is-active") };
      }),
      usable,
    );
    if (picked === null) return null;
    // Only neighbouring siblings may join, so the group stays one contiguous stretch of the article.
    const run: HTMLElement[] = [els[picked]];
    for (let n = els[picked].nextElementSibling; n && els.includes(n as HTMLElement); n = n.nextElementSibling) run.push(n as HTMLElement);
    for (let p = els[picked].previousElementSibling; p && els.includes(p as HTMLElement); p = p.previousElementSibling) run.unshift(p as HTMLElement);
    const at = run.indexOf(els[picked]);
    const [from, to] = growGroup(run.map((el) => (el.textContent ?? "").trim().length), at);
    return run.slice(from, to + 1);
  };

  const enter = (manual: boolean): boolean => {
    if (state !== "normal") return false;
    if (!manual && blocked()) return false;
    const article = document.querySelector<HTMLElement>(ARTICLE);
    const picked = article ? choosePassage() : null;
    if (!article || !picked) return false;

    const { reducedMotion } = getOptions();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let scale = 1;
    let dx = 0;
    let dy = 0;
    if (!reducedMotion) {
      const natural = union(picked);
      // Very tall passages keep their size; the layout only gives them more room.
      const tooTall = natural.height > (vh - HEADER_H) * 0.7;
      scale = tooTall ? 1 : FONT_SCALE;
      // Measure the end state without painting it: apply it, read the geometry, put it back and flush styles
      // so the real change below starts its transition from the normal layout.
      root.style.setProperty("--fr-scale", String(scale));
      picked.forEach((el) => el.setAttribute("data-fr-measure", ""));
      const end = union(picked);
      const articleRect = article.getBoundingClientRect();
      picked.forEach((el) => el.removeAttribute("data-fr-measure"));
      void article.offsetHeight;
      if (vw > 760) dy = Math.round(clamp(tooTall ? HEADER_H + 32 - end.top : (HEADER_H + vh) / 2 - (end.top + end.bottom) / 2, -vh * 0.35, vh * 0.35));
      if (vw > 900) dx = Math.round(clamp(vw / 2 - (articleRect.left + articleRect.width / 2), -260, 260));
    }

    const dur = reducedMotion ? REDUCED_ENTER_MS : ENTER_MS;
    root.style.setProperty("--fr-scale", String(scale));
    root.style.setProperty("--fr-dx", `${dx}px`);
    root.style.setProperty("--fr-dy", `${dy}px`);
    root.style.setProperty("--fr-dur", `${dur}ms`);
    group = picked;
    const now = performance.now();
    graceUntil = now + GRACE_MS;
    ignoreScrollUntil = now + 200;
    picked.forEach((el) => el.setAttribute("data-fr-active", ""));
    send("enter");
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => send("settled"), dur);
    return true;
  };

  const armIdle = () => {
    if (idleTimer || !getOptions().auto) return;
    idleTimer = window.setTimeout(check, getOptions().delayMs);
  };

  function check() {
    idleTimer = 0;
    const o = getOptions();
    if (!o.auto || state !== "normal") return;
    const elapsed = performance.now() - lastActivity;
    if (elapsed < o.delayMs - 20) {
      idleTimer = window.setTimeout(check, o.delayMs - elapsed);
      return;
    }
    if (!enter(false)) {
      // Not eligible right now (typing, animation running, panel open...): treat as activity and wait a full interval.
      lastActivity = performance.now();
      armIdle();
    }
  }

  const exit = () => {
    if (state !== "entering" && state !== "focused") return;
    window.clearTimeout(settleTimer);
    group.forEach((el) => el.removeAttribute("data-fr-active"));
    group = [];
    const dur = getOptions().reducedMotion ? REDUCED_EXIT_MS : EXIT_MS;
    root.style.setProperty("--fr-dur", `${dur}ms`);
    send("exit");
    settleTimer = window.setTimeout(() => {
      send("exited");
      releaseVars();
      // A fresh interval starts only now, after the layout has fully settled.
      lastActivity = performance.now();
      armIdle();
    }, dur + 30);
  };

  const onActivity = (event: Event) => {
    const now = performance.now();
    if (event.type === "pointermove") {
      const e = event as PointerEvent;
      if (!anchor) {
        anchor = { x: e.clientX, y: e.clientY };
        return;
      }
      if (Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) < POINTER_SLOP) return;
      anchor = { x: e.clientX, y: e.clientY };
      if (now < graceUntil) return;
    } else if (event.type === "scroll") {
      if (now < ignoreScrollUntil) return;
    } else if (event.type === "keydown") {
      if (MODIFIER_KEYS.has((event as KeyboardEvent).key)) return;
    } else if (event.type === "selectionchange") {
      if (!selectionActive()) return;
    } else if (event.type === "pointerdown") {
      held = true;
    } else if (event.type === "focusin") {
      const t = event.target as HTMLElement | null;
      if (!t || !t.matches("a, button, input, select, textarea, [tabindex], [contenteditable]")) return;
    }
    lastActivity = now;
    if (state === "entering" || state === "focused") exit();
    armIdle();
  };

  const release = () => {
    held = false;
  };

  const toggle = () => {
    if (state === "entering" || state === "focused") exit();
    else enter(true);
  };

  const onKey = (event: KeyboardEvent) => {
    // Alt+Shift+F toggles; modifiers keep it clear of browser and editor shortcuts.
    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === "KeyF") {
      event.preventDefault();
      toggle();
      return;
    }
    onActivity(event);
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") onActivity(new Event("visible"));
  };

  const activityEvents = ["pointermove", "pointerdown", "wheel", "touchstart", "touchmove", "scroll"] as const;

  return {
    start() {
      activityEvents.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
      window.addEventListener("pointerup", release, { passive: true });
      window.addEventListener("pointercancel", release, { passive: true });
      window.addEventListener("keydown", onKey);
      document.addEventListener("selectionchange", onActivity);
      document.addEventListener("focusin", onActivity);
      document.addEventListener("visibilitychange", onVisibility);
      lastActivity = performance.now();
      armIdle();
    },
    stop() {
      activityEvents.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("selectionchange", onActivity);
      document.removeEventListener("focusin", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(idleTimer);
      window.clearTimeout(settleTimer);
      idleTimer = 0;
      group.forEach((el) => el.removeAttribute("data-fr-active"));
      group = [];
      delete root.dataset.frState;
      releaseVars();
      state = "normal";
    },
    refresh() {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      lastActivity = performance.now();
      armIdle();
    },
    enter,
    exit,
    toggle,
  };
}
