"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { TextSelection } from "@/components/companion/useTextSelection";

export interface Passage {
  text: string;
  sectionId: string;
}

interface Props {
  selection: TextSelection | null;
  onExplain: (passage: Passage) => void;
  onUnpack: (passage: Passage) => void;
  onSave: (passage: Passage) => void;
  onCopy: (passage: Passage) => void;
}

const sectionOf = (range: Range) => {
  const node = range.commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return el?.closest("section[id]")?.id ?? "";
};

/** Compact actions floating beside the highlighted passage. Mouse-down is cancelled so the selection survives clicks. */
export default function SelectionToolbar({ selection, onExplain, onUnpack, onSave, onCopy }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!selection) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const rects = Array.from(selection.range.getClientRects()).filter((r) => r.width > 0);
      const first = rects[0];
      const last = rects[rects.length - 1];
      const bar = ref.current;
      if (!first || !last || !bar) return setPos(null);
      const w = bar.offsetWidth;
      const h = bar.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Above the first line when there is room under the sticky header, otherwise below the last line.
      const above = first.top - h - 8;
      const top = above >= 64 ? above : Math.min(last.bottom + 8, vh - h - 8);
      if (first.bottom < 56 || last.top > vh) return setPos(null);
      const left = Math.min(Math.max(8, first.left), Math.max(8, vw - w - 8));
      setPos({ left: Math.round(left), top: Math.round(top) });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [selection]);

  if (!selection) return null;
  const passage: Passage = { text: selection.text, sectionId: sectionOf(selection.range) };
  const keep = (event: React.MouseEvent) => event.preventDefault();
  const action = (fn: (p: Passage) => void) => ({ onMouseDown: keep, onClick: () => fn(passage) });

  return (
    <div ref={ref} className="st" data-fr-block role="toolbar" aria-label="Actions for the selected text" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}>
      <button type="button" {...action(onExplain)}>Explain this</button>
      <button type="button" {...action(onUnpack)}>Unpack this</button>
      <button type="button" {...action(onSave)}>Save to notes</button>
      <button type="button" {...action(onCopy)}>Copy</button>
    </div>
  );
}
