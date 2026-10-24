"use client";

import { useEffect, useState } from "react";

export type SelectionBox = { left: number; top: number; right: number; bottom: number };
export type TextSelection = { text: string; first: SelectionBox; last: SelectionBox };

const box = (r: DOMRect): SelectionBox => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

/** Tracks a non-trivial text selection inside `containerSelector`, debounced while the user is still dragging. */
export function useTextSelection(containerSelector: string, enabled: boolean) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const read = () => {
      const current = window.getSelection();
      const root = document.querySelector(containerSelector);
      if (!current || current.isCollapsed || current.rangeCount === 0 || !root) return setSelection(null);
      const text = current.toString().trim();
      const range = current.getRangeAt(0);
      if (text.length < 3 || !root.contains(range.commonAncestorContainer)) return setSelection(null);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      const first = rects[0];
      const last = rects[rects.length - 1];
      if (!first || !last) return setSelection(null);
      setSelection((prev) => (prev && prev.text === text ? prev : { text, first: box(first), last: box(last) }));
    };
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.clearTimeout(timer);
    };
  }, [containerSelector, enabled]);

  return enabled ? selection : null;
}
