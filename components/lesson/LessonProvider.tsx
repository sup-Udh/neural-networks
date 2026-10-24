"use client";

/*
 * The single source of truth for the neuron experiment: parameters, playback and the latest code result.
 * Equation, diagram, sliders, step-through, code editor and challenge all read this state.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { DEFAULT_PARAMS, forward, roundParam } from "@/lib/neuron/neuron";
import type { ForwardResult, NeuronParams } from "@/lib/neuron/neuron";
import { STEP_COUNT } from "@/lib/neuron/steps";

export type NumericParam = "x1" | "x2" | "w1" | "w2" | "bias";
export type Speed = 0.5 | 1 | 2;
export type PlayStatus = "idle" | "playing" | "paused" | "done";

export interface CodeResult {
  value: number;
  /** Which model quantity the learner's code reproduced, if any. */
  matches: "z" | "a" | null;
  /** The parameters the code was run with; the result is stale once these change. */
  params: NeuronParams;
}

interface State {
  params: NeuronParams;
  /** null = settled view with every value shown; otherwise the 0-based step being shown. */
  step: number | null;
  status: PlayStatus;
  speed: Speed;
  codeResult: CodeResult | null;
}

type Action =
  | { type: "param"; key: NumericParam; value: number }
  | { type: "activation"; value: NeuronParams["activation"] }
  | { type: "run" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "reset" }
  | { type: "goto"; step: number }
  | { type: "advance" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "speed"; value: Speed }
  | { type: "code"; result: CodeResult | null };

const LAST = STEP_COUNT - 1;
const SETTLED = { step: null, status: "idle" } as const;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "param": {
      const value = roundParam(action.value);
      if (state.params[action.key] === value) return state;
      return { ...state, params: { ...state.params, [action.key]: value }, ...SETTLED };
    }
    case "activation":
      return state.params.activation === action.value ? state : { ...state, params: { ...state.params, activation: action.value }, ...SETTLED };
    case "run":
      return { ...state, step: 0, status: "playing" };
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "playing" } : state;
    case "reset":
      return { ...state, ...SETTLED };
    case "goto":
      return { ...state, step: Math.min(LAST, Math.max(0, action.step)), status: "paused" };
    case "advance":
      if (state.status !== "playing" || state.step === null) return state;
      return state.step >= LAST ? { ...state, status: "done" } : { ...state, step: state.step + 1 };
    case "next":
      if (state.step === null) return { ...state, step: 0, status: "paused" };
      return state.step >= LAST ? { ...state, status: "done" } : { ...state, step: state.step + 1, status: "paused" };
    case "prev":
      if (state.step === null) return state;
      return state.step <= 0 ? { ...state, ...SETTLED } : { ...state, step: state.step - 1, status: "paused" };
    case "speed":
      return { ...state, speed: action.value };
    case "code":
      return { ...state, codeResult: action.result };
  }
}

export const STEP_MS = 1500;

interface Lesson {
  params: NeuronParams;
  result: ForwardResult;
  step: number | null;
  status: PlayStatus;
  speed: Speed;
  codeResult: CodeResult | null;
  setParam: (key: NumericParam, value: number) => void;
  setActivation: (value: NeuronParams["activation"]) => void;
  setSpeed: (value: Speed) => void;
  run: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  next: () => void;
  prev: () => void;
  gotoStep: (step: number) => void;
  setCodeResult: (result: CodeResult | null) => void;
}

const LessonContext = createContext<Lesson | null>(null);

export function LessonProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { params: DEFAULT_PARAMS, ...SETTLED, speed: 1, codeResult: null } as State);
  const timer = useRef(0);

  // One timer drives playback: it exists only while status is "playing" and is replaced on every step or speed change.
  useEffect(() => {
    if (state.status !== "playing") return;
    timer.current = window.setTimeout(() => dispatch({ type: "advance" }), STEP_MS / state.speed);
    return () => window.clearTimeout(timer.current);
  }, [state.status, state.step, state.speed]);

  const result = useMemo(() => forward(state.params), [state.params]);

  const setParam = useCallback((key: NumericParam, value: number) => dispatch({ type: "param", key, value }), []);
  const setActivation = useCallback((value: NeuronParams["activation"]) => dispatch({ type: "activation", value }), []);
  const setSpeed = useCallback((value: Speed) => dispatch({ type: "speed", value }), []);
  const run = useCallback(() => dispatch({ type: "run" }), []);
  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const resume = useCallback(() => dispatch({ type: "resume" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const next = useCallback(() => dispatch({ type: "next" }), []);
  const prev = useCallback(() => dispatch({ type: "prev" }), []);
  const gotoStep = useCallback((step: number) => dispatch({ type: "goto", step }), []);
  const setCodeResult = useCallback((r: CodeResult | null) => dispatch({ type: "code", result: r }), []);

  const value = useMemo<Lesson>(
    () => ({
      params: state.params, result, step: state.step, status: state.status, speed: state.speed, codeResult: state.codeResult,
      setParam, setActivation, setSpeed, run, pause, resume, reset, next, prev, gotoStep, setCodeResult,
    }),
    [state, result, setParam, setActivation, setSpeed, run, pause, resume, reset, next, prev, gotoStep, setCodeResult],
  );

  return <LessonContext value={value}>{children}</LessonContext>;
}

export function useLesson(): Lesson {
  const lesson = useContext(LessonContext);
  if (!lesson) throw new Error("useLesson must be used inside <LessonProvider>");
  return lesson;
}
