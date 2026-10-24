/* Scrolls to a saved passage and briefly highlights it without touching the DOM (CSS Custom Highlight API). */

interface HighlightRegistry {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => void;
}

let clearTimer = 0;

/** Finds `text` inside the section, ignoring whitespace differences. Returns the matching range or null. */
function findRange(section: Element, text: string): Range | null {
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  const owners: { node: Text; offset: number }[] = [];
  let compact = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (let i = 0; i < node.data.length; i += 1) {
      if (/\s/.test(node.data[i])) continue;
      compact += node.data[i];
      owners.push({ node, offset: i });
    }
  }
  const target = text.replace(/\s+/g, "");
  const at = target ? compact.indexOf(target) : -1;
  if (at < 0) return null;
  const start = owners[at];
  const end = owners[at + target.length - 1];
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}

export function flashPassage(sectionId: string, text: string, smooth: boolean): boolean {
  const section = document.getElementById(sectionId);
  if (!section) return false;
  const range = findRange(section, text);
  const anchor = (range?.startContainer.parentElement ?? section) as HTMLElement;
  anchor.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });

  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  const HighlightCtor = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  window.clearTimeout(clearTimer);
  if (range && registry && HighlightCtor) {
    registry.set("note-flash", new HighlightCtor(range));
    clearTimer = window.setTimeout(() => registry.delete("note-flash"), 2600);
  } else {
    anchor.classList.add("note-flash-el");
    clearTimer = window.setTimeout(() => anchor.classList.remove("note-flash-el"), 2600);
  }
  return range !== null;
}
