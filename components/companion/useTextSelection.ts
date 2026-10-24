"use client";

import { useEffect, useState } from "react";

export type SelectionBox = { left: number; top: number; right: number; bottom: number };
export type TextSelection = { text: string; first: SelectionBox; last: SelectionBox; range: Range };

const box = (r: DOMRect): SelectionBox => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

const inside = (node: Node, selector: string) => (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest(selector) != null;

/**
 * Tracks a non-trivial text selection inside `containerSelector`, debounced while the user is still dragging.
 * Selections that touch an element matching `excludeSelector` (controls, diagrams, editors) are ignored.
 */
export function useTextSelection(containerSelector: string, enabled: boolean, excludeSelector?: string) {
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
      if (excludeSelector && (inside(range.startContainer, excludeSelector) || inside(range.endContainer, excludeSelector) || inside(range.commonAncestorContainer, excludeSelector))) {
        return setSelection(null);
      }
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      const first = rects[0];
      const last = rects[rects.length - 1];
      if (!first || !last) return setSelection(null);
      setSelection((prev) => (prev && prev.text === text ? prev : { text, first: box(first), last: box(last), range: range.cloneRange() }));
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
  }, [containerSelector, enabled, excludeSelector]);

  return enabled ? selection : null;
}
