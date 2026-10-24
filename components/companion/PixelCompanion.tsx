"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, Ref, RefObject } from "react";
import CompanionSpeechBubble from "./CompanionSpeechBubble";
import PixelSprite from "./PixelSprite";
import { ANCHOR_ROW, BODY_CENTER_X, GRID_H, GRID_W, JUMP_FRAME } from "./companionAnimations";
import { lineNear, perchLedge } from "./companionGeometry";
import type { AnimationState, CompanionId, CompanionSize, PerchMode, PixelCompanionHandle } from "./companionTypes";
import { useMediaQuery } from "./useMediaQuery";
import { useTextSelection } from "./useTextSelection";
import type { SelectionBox } from "./useTextSelection";

interface PixelCompanionProps {
  character: CompanionId;
  size?: CompanionSize;
  /** Positioned ancestor the companion lives in. It is placed absolutely and never affects layout. */
  stageRef: RefObject<HTMLElement | null>;
  sectionIds: readonly string[];
  activeId: string | null;
  /** Selector for the article body; only selections inside it trigger inspection. */
  contentSelector: string;
  /** Overrides the OS preference (used by the development panel). */
  reducedMotion?: boolean;
  paused?: boolean;
  replayKey?: number;
  ref?: Ref<PixelCompanionHandle>;
}

/** `x` is the horizontal centre of the body, `ledge` the y of the line it rests on (stage coordinates). */
type Target = { x: number; ledge: number };
type Step = { kind: "walk" | "hop" | "lift"; x: number; ledge: number };
type Rail = { x: number; top: number; height: number };
type BubbleState = { message: string; prompt: boolean };

const FOLLOW_COOLDOWN_MS = 500;
const WALK_SPEED = 150; // px per second
const RUN_DISTANCE = 360;
const MAX_HOP = 220;
const LIFT_MIN = 120; // trips shorter than this hop; longer ones ride the lift
const MODE_STATE: Record<PerchMode, AnimationState> = { stand: "idle", hang: "hang", sit: "sit", work: "work" };
const NO_TRAVEL = { ms: 0, arc: 0, ease: "linear", key: 0 };

export default function PixelCompanion({
  character, size = 24, stageRef, sectionIds, activeId, contentSelector, reducedMotion, paused, replayKey, ref,
}: PixelCompanionProps) {
  const systemReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reduced = reducedMotion ?? systemReduced;
  const docked = useMediaQuery("(max-width: 760px)");
  const effSize = docked ? Math.min(size, 24) : size;
  const scale = effSize / GRID_H;

  const [minimized, setMinimized] = useState(false);
  const [state, setState] = useState<AnimationState>("idle");
  const [jumpFrame, setJumpFrame] = useState<number | undefined>(undefined);
  const [pos, setPos] = useState<Target | null>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [rate, setRate] = useState(1);
  const [travel, setTravel] = useState(NO_TRAVEL);
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [rail, setRail] = useState<Rail | null>(null);

  const timers = useRef<number[]>([]);
  const autoEnd = useRef(0);
  const followTimer = useRef(0);
  const posRef = useRef<Target | null>(null);
  const running = useRef(false);
  const inspecting = useRef(false);
  const lastMove = useRef(0);
  const perched = useRef("");
  const restState = useRef<AnimationState>("idle");
  const dismissedText = useRef<string | null>(null);
  const selectionText = useRef("");
  const activeRef = useRef<string | null>(activeId);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    running.current = false;
    setRail(null);
  }, []);
  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const commitPos = useCallback((p: Target | null) => {
    posRef.current = p;
    setPos(p);
  }, []);

  useEffect(
    () => () => {
      clear();
      window.clearTimeout(autoEnd.current);
      window.clearTimeout(followTimer.current);
    },
    [clear],
  );

  const contentRoot = useCallback(() => document.querySelector(contentSelector), [contentSelector]);

  /**
   * The companion never stands over the article text. It lives in the left margin: `stand` is where it rests,
   * `land` is where it lands after a hop, so every arrival ends with a short visible walk up to its spot.
   */
  const lane = useCallback(() => {
    const stage = stageRef.current;
    const content = contentRoot();
    if (!stage || !content) return null;
    const contentLeft = content.getBoundingClientRect().left - stage.getBoundingClientRect().left;
    const stand = Math.round(contentLeft - (11.5 * scale + 10));
    return { stand, land: Math.max(Math.round(8.5 * scale + 4), stand - 22) };
  }, [stageRef, contentRoot, scale]);

  /** Breaks a trip into a lift ride (long trips) or hops down the margin, then a short walk to the resting spot. */
  const plan = useCallback(
    (from: Target, to: Target): Step[] => {
      const dy = to.ledge - from.ledge;
      if (Math.abs(dy) <= 14) return Math.abs(to.x - from.x) > 4 ? [{ kind: "walk", x: to.x, ledge: to.ledge }] : [];
      const l = lane();
      if (l && Math.abs(dy) > LIFT_MIN) {
        // Step onto the lift pad, ride the rail straight to the next title, step off.
        const steps: Step[] = [];
        if (Math.abs(from.x - l.stand) > 4) steps.push({ kind: "walk", x: l.stand, ledge: from.ledge });
        steps.push({ kind: "lift", x: l.stand, ledge: to.ledge });
        if (Math.abs(l.stand - to.x) > 6) steps.push({ kind: "walk", x: to.x, ledge: to.ledge });
        return steps;
      }
      const landX = l ? l.land : to.x;
      const hops = Math.ceil(Math.abs(dy) / MAX_HOP);
      const steps: Step[] = [];
      for (let k = 1; k <= hops; k += 1) {
        steps.push({ kind: "hop", x: landX, ledge: Math.round(from.ledge + (dy * k) / hops) });
      }
      if (Math.abs(landX - to.x) > 6) steps.push({ kind: "walk", x: to.x, ledge: to.ledge });
      return steps;
    },
    [lane],
  );

  const run = useCallback(
    (steps: Step[], final: AnimationState, sitAfter: boolean) => {
      clear();
      setJumpFrame(undefined);
      running.current = true;
      let cursor = posRef.current;
      let t = 0;
      for (const step of steps) {
        if (!cursor) break;
        const from: Target = cursor;
        const dx = step.x - from.x;
        const dist = Math.hypot(dx, step.ledge - from.ledge);
        if (step.kind === "walk") {
          const speedUp = dist > RUN_DISTANCE ? 1.9 : 1;
          const ms = Math.max(280, Math.round((dist / (WALK_SPEED * speedUp)) * 1000));
          at(t, () => {
            if (Math.abs(dx) > 2) setFacing(dx < 0 ? -1 : 1);
            setState("walk");
            setRate(speedUp);
            setTravel((tr) => ({ ms, arc: 0, ease: "linear", key: tr.key + 1 }));
            commitPos({ x: step.x, ledge: step.ledge });
          });
          t += ms;
        } else if (step.kind === "lift") {
          // Fast and mostly distance-independent: a long scroll costs well under a second of travel.
          const ms = Math.round(Math.min(950, 360 + dist * 0.3));
          at(t, () => {
            setFacing(1);
            setRate(1);
            setJumpFrame(undefined);
            setState("idle");
            setRail({ x: step.x, top: Math.min(from.ledge, step.ledge), height: Math.abs(step.ledge - from.ledge) });
          });
          at(t + 120, () => {
            setTravel((tr) => ({ ms, arc: 0, ease: "cubic-bezier(.55,0,.15,1)", key: tr.key + 1 }));
            commitPos({ x: step.x, ledge: step.ledge });
          });
          at(t + 120 + ms, () => {
            setTravel(NO_TRAVEL);
            setRail(null);
          });
          t += 120 + ms + 120;
        } else {
          const ms = Math.round(Math.min(760, 380 + dist * 0.8));
          const arc = Math.round(Math.min(90, Math.max(26, dist * 0.22)));
          at(t, () => {
            if (Math.abs(dx) > 2) setFacing(dx < 0 ? -1 : 1);
            setRate(1);
            setTravel(NO_TRAVEL);
            setState("jump");
            setJumpFrame(JUMP_FRAME.crouch);
          });
          at(t + 140, () => {
            setJumpFrame(JUMP_FRAME.up);
            setTravel((tr) => ({ ms, arc, ease: "ease-in-out", key: tr.key + 1 }));
            commitPos({ x: step.x, ledge: step.ledge });
          });
          at(t + 140 + ms * 0.32, () => setJumpFrame(JUMP_FRAME.apex));
          at(t + 140 + ms * 0.64, () => setJumpFrame(JUMP_FRAME.down));
          at(t + 140 + ms, () => {
            setJumpFrame(JUMP_FRAME.land);
            setTravel(NO_TRAVEL);
          });
          t += 140 + ms + 160;
        }
        cursor = { x: step.x, ledge: step.ledge };
      }
      at(t, () => {
        running.current = false;
        setTravel(NO_TRAVEL);
        setJumpFrame(undefined);
        setRate(1);
        setFacing(1);
        restState.current = final;
        setState(final);
        lastMove.current = Date.now();
        if (sitAfter) {
          at(2000, () => {
            restState.current = "sit";
            setState("sit");
          });
        }
      });
    },
    [clear, at, commitPos],
  );

  const moveTo = useCallback(
    (target: Target, final: AnimationState, sitAfter = false, instant = false) => {
      const from = posRef.current;
      if (!from || instant || reduced || docked) {
        clear();
        setJumpFrame(undefined);
        setTravel(NO_TRAVEL);
        setFacing(1);
        setRate(1);
        commitPos(target);
        restState.current = reduced ? "idle" : final;
        setState(reduced ? "idle" : final);
        lastMove.current = Date.now();
        if (sitAfter && !reduced && !docked) {
          at(2000, () => {
            restState.current = "sit";
            setState("sit");
          });
        }
        return;
      }
      run(plan(from, target), final, sitAfter);
    },
    [reduced, docked, clear, commitPos, at, run, plan],
  );

  /** Chooses where the companion should be for the current scroll position and goes there. */
  const follow = useCallback(
    (instant: boolean) => {
      const stage = stageRef.current;
      const content = contentRoot();
      if (!stage || !content) return;
      const sr = stage.getBoundingClientRect();
      const vh = window.innerHeight;
      const cur = posRef.current;
      const curVy = cur ? sr.top + cur.ledge : 0;

      const l = lane();
      if (!l) return;
      let target: (Target & { state: AnimationState; key: string }) | null = null;
      const id = activeRef.current ?? sectionIds[0];
      const section = id ? document.getElementById(id) : null;
      const anchor = section?.querySelector<HTMLElement>("[data-companion-anchor]");
      if (id && section && anchor) {
        const ledge = perchLedge(stage, anchor);
        const vy = sr.top + ledge;
        if (vy >= 110 && vy <= vh * 0.62) {
          const mode = (section.dataset.companionMode as PerchMode | undefined) ?? "stand";
          target = { x: l.stand, ledge, state: MODE_STATE[mode] ?? "idle", key: `perch:${id}` };
        }
      }
      const needs = instant || !cur || curVy < 120 || curVy > vh * 0.58 || (target !== null && perched.current !== target.key);
      if (!needs) return;
      let sitAfter = false;
      if (!target) {
        const line = lineNear(stage, content, vh * 0.34 - sr.top);
        if (!line) return;
        target = { x: l.stand, ledge: line.ledge, state: "idle", key: "line" };
        sitAfter = true;
      }
      perched.current = target.key;
      moveTo({ x: target.x, ledge: target.ledge }, target.state, sitAfter, instant);
    },
    [stageRef, contentRoot, sectionIds, moveTo, lane],
  );

  // Follow the reader: sample after scrolling settles, with a cooldown so fast scrolling cannot queue movement.
  const scheduleFollow = useCallback(() => {
    if (followTimer.current) return;
    followTimer.current = window.setTimeout(function check() {
      followTimer.current = 0;
      if (inspecting.current) return;
      if (running.current) {
        followTimer.current = window.setTimeout(check, 400);
        return;
      }
      const wait = Math.max(0, FOLLOW_COOLDOWN_MS - (Date.now() - lastMove.current));
      if (wait > 0) {
        followTimer.current = window.setTimeout(check, wait);
        return;
      }
      follow(false);
    }, 220);
  }, [follow]);

  useEffect(() => {
    if (minimized || reduced || docked) return;
    window.addEventListener("scroll", scheduleFollow, { passive: true });
    return () => {
      window.removeEventListener("scroll", scheduleFollow);
      window.clearTimeout(followTimer.current);
      followTimer.current = 0;
    };
  }, [minimized, reduced, docked, scheduleFollow]);

  // A new active section is also a reason to re-evaluate (it may now be in reach to perch on).
  useEffect(() => {
    if (minimized || reduced || docked || !activeId) return;
    scheduleFollow();
  }, [activeId, minimized, reduced, docked, scheduleFollow]);

  // First placement (and re-opening after minimising): no animation.
  useEffect(() => {
    if (minimized) return;
    const timer = window.setTimeout(() => {
      if (!posRef.current && !docked) {
        perched.current = "";
        follow(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [minimized, docked, follow]);

  // Re-anchor without animation when the layout changes (resize, font load, content height).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || minimized || docked || typeof ResizeObserver === "undefined") return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!inspecting.current && !running.current && posRef.current) {
          perched.current = "";
          follow(true);
        }
      }, 150);
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [stageRef, minimized, docked, follow]);

  // Reduced motion: drop whatever was running and show the still pose.
  useEffect(() => {
    if (!reduced) return;
    const timer = window.setTimeout(() => {
      clear();
      setJumpFrame(undefined);
      setTravel(NO_TRAVEL);
      setRate(1);
      setState((s) => (s === "inspect" || s === "celebrate" ? s : "idle"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reduced, clear]);

  const returnFromInspect = useCallback(() => {
    inspecting.current = false;
    perched.current = "";
    follow(false);
  }, [follow]);

  const startInspect = useCallback(
    (first: SelectionBox, _last: SelectionBox, message: string, prompt: boolean, autoEndMs = 0) => {
      const stage = stageRef.current;
      if (!stage) return;
      const sr = stage.getBoundingClientRect();
      inspecting.current = true;
      window.clearTimeout(autoEnd.current);
      autoEnd.current = 0;
      const l = lane();
      if (!l) return;
      setBubble({ message, prompt });
      // Stand in the margin level with the first selected line and point the magnifier at it.
      moveTo({ x: l.stand, ledge: Math.round(first.bottom - sr.top - 3) }, "inspect");
      if (autoEndMs) {
        autoEnd.current = window.setTimeout(() => {
          autoEnd.current = 0;
          setBubble(null);
          returnFromInspect();
        }, autoEndMs);
      }
    },
    [stageRef, lane, moveTo, returnFromInspect],
  );

  const selection = useTextSelection(contentSelector, !minimized);
  useEffect(() => {
    if (!selection) {
      dismissedText.current = null;
      // Control-triggered inspection ends on its own timer; selection-triggered inspection ends here.
      if (!inspecting.current || autoEnd.current) return;
      const timer = window.setTimeout(() => {
        selectionText.current = "";
        setBubble(null);
        returnFromInspect();
      }, 500);
      return () => window.clearTimeout(timer);
    }
    if (dismissedText.current === selection.text) return;
    const timer = window.setTimeout(() => {
      selectionText.current = selection.text;
      startInspect(selection.first, selection.last, "Want to unpack this?", true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selection, startInspect, returnFromInspect]);

  const dismiss = useCallback(() => {
    dismissedText.current = selectionText.current;
    window.clearTimeout(autoEnd.current);
    autoEnd.current = 0;
    setBubble(null);
    returnFromInspect();
  }, [returnFromInspect]);

  useImperativeHandle(
    ref,
    () => ({
      play: (next) => {
        clear();
        window.clearTimeout(autoEnd.current);
        autoEnd.current = 0;
        inspecting.current = false;
        setBubble(null);
        setJumpFrame(undefined);
        setTravel(NO_TRAVEL);
        setRate(next === "walk" ? 1 : 1);
        if (next !== "jump") {
          restState.current = next;
          return setState(next);
        }
        setState("jump");
        setJumpFrame(JUMP_FRAME.crouch);
        at(150, () => {
          setJumpFrame(JUMP_FRAME.up);
          setTravel((tr) => ({ ms: 620, arc: 44, ease: "ease-in-out", key: tr.key + 1 }));
          at(200, () => setJumpFrame(JUMP_FRAME.apex));
          at(400, () => setJumpFrame(JUMP_FRAME.down));
          at(620, () => {
            setJumpFrame(JUMP_FRAME.land);
            setTravel(NO_TRAVEL);
            at(170, () => {
              setJumpFrame(undefined);
              setState(restState.current);
            });
          });
        });
      },
      celebrate: () => {
        clear();
        window.clearTimeout(autoEnd.current);
        autoEnd.current = 0;
        inspecting.current = false;
        setJumpFrame(undefined);
        setTravel(NO_TRAVEL);
        setState("celebrate");
        setBubble({ message: "Nice work!", prompt: false });
        at(2000, () => {
          setBubble(null);
          setState(restState.current);
        });
      },
      inspect: (element) => {
        const r = element.getBoundingClientRect();
        // Stand on top of the control rather than behind it.
        const first = { left: r.left, top: r.top, right: r.right, bottom: r.top + 3 };
        const last = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        selectionText.current = "";
        startInspect(first, last, "Curious about this control?", false, 4500);
      },
    }),
    [clear, at, startInspect],
  );

  const toggleMinimized = () => {
    if (!minimized) {
      clear();
      window.clearTimeout(autoEnd.current);
      autoEnd.current = 0;
      inspecting.current = false;
      commitPos(null);
      setBubble(null);
      setTravel(NO_TRAVEL);
      setJumpFrame(undefined);
    }
    setMinimized(!minimized);
  };

  const shown: AnimationState = effSize <= 16 ? "idle" : state;
  const still = reduced || effSize <= 16;
  const hopping = state === "celebrate" && !reduced;
  const visible = !minimized && (docked || pos);
  const x = pos ? Math.round(pos.x - BODY_CENTER_X * scale) : 0;
  const y = pos ? Math.round(pos.ledge - ANCHOR_ROW[shown] * scale) : 0;
  const style: CSSProperties | undefined = docked
    ? undefined
    : {
        transform: `translate3d(${x}px, ${y}px, 0)`,
        transition: travel.ms ? `transform ${travel.ms}ms ${travel.ease}` : "transform 110ms linear",
      };

  return (
    <>
      {rail && !docked && <span className="companion-rail" style={{ left: rail.x, top: rail.top, height: rail.height }} aria-hidden="true" />}
      {visible && (
        <div className={`companion ${docked ? "companion-docked" : ""}`} style={style} aria-hidden="true">
          <div
            key={travel.key}
            className={`companion-arc ${travel.arc ? "is-arcing" : ""} ${hopping ? "is-hopping" : ""}`}
            style={{ "--arc": `${travel.arc}px`, "--dur": `${travel.ms}ms` } as CSSProperties}
          >
            <div className="companion-flip" style={{ transform: `scaleX(${facing})`, transformOrigin: `${(BODY_CENTER_X / GRID_W) * 100}% 50%` }}>
              <PixelSprite
                character={character}
                state={shown}
                size={effSize}
                still={still}
                frame={shown === "jump" ? jumpFrame : undefined}
                paused={paused}
                replayKey={replayKey}
                rate={rate}
              />
            </div>
          </div>
          {shown !== "walk" && shown !== "jump" && (
            <span
              className="companion-plank"
              style={{ left: BODY_CENTER_X * scale, top: ANCHOR_ROW[shown] * scale - (shown === "hang" ? 2 : 0), width: Math.round(18 * scale) }}
            />
          )}
        </div>
      )}
      {!minimized && bubble && (
        <CompanionSpeechBubble
          message={bubble.message}
          docked={docked}
          onAccept={bubble.prompt ? () => setBubble({ ...bubble, message: "Prototype: explanations will appear here.", prompt: false }) : undefined}
          onClear={bubble.prompt ? () => window.getSelection()?.removeAllRanges() : undefined}
          onDismiss={bubble.prompt ? dismiss : () => { setBubble(null); if (inspecting.current) dismiss(); }}
        />
      )}
      <div className="companion-dock">
        <button type="button" className="companion-dock-button" aria-pressed={!minimized} onClick={toggleMinimized}>
          <PixelSprite character={character} state="idle" size={24} still />
          {minimized ? "Show companion" : "Hide companion"}
        </button>
      </div>
    </>
  );
}
