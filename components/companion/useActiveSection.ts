"use client";

import { useEffect, useState } from "react";

/**
 * Reports the document section crossing a thin band near the top of the viewport.
 * Updates are debounced so rapid scrolling reports only where it settles.
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          const first = ids.find((id) => visible.has(id));
          if (first) setActive(first);
        }, 180);
      },
      { rootMargin: "-18% 0px -66% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [ids]);

  return active;
}
