"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusState } from "@/lib/reading/focusReading";
import { createFocusController } from "./focusController";
import type { FocusController, FocusOptions } from "./focusController";

export interface FocusReading {
  state: FocusState;
  /** True from the moment focus begins until its exit has finished. */
  active: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

/** React wrapper around the focus controller. React only sees the four state changes, never pointer events. */
export function useFocusReadingMode(options: FocusOptions): FocusReading {
  const [state, setState] = useState<FocusState>("normal");
  const controller = useRef<FocusController | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
    controller.current?.refresh();
  }, [options.auto, options.delayMs, options.reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps -- options is read through the ref

  useEffect(() => {
    const instance = createFocusController(() => optionsRef.current, setState);
    controller.current = instance;
    instance.start();
    return () => {
      instance.stop();
      controller.current = null;
    };
  }, []);

  const enter = useCallback(() => void controller.current?.enter(true), []);
  const exit = useCallback(() => controller.current?.exit(), []);
  const toggle = useCallback(() => controller.current?.toggle(), []);

  return { state, active: state !== "normal", enter, exit, toggle };
}
