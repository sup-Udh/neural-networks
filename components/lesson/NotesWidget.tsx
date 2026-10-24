"use client";

import { useEffect, useRef, useState } from "react";
import { annotateNote, deleteNote, notesStore, usePersisted } from "@/lib/storage/stores";
import type { Note } from "@/lib/storage/stores";

interface Props {
  titleOf: (sectionId: string) => string;
  onOpenNote: (note: Note) => void;
  onMessage: (message: string) => void;
  /** Bumped by the parent each time a note is saved so the icon can play its saved animation. */
  savedPulse: number;
}

export default function NotesWidget({ titleOf, onOpenNote, onMessage, savedPulse }: Props) {
  const notes = usePersisted(notesStore);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) iconRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (notes.length === 0 && !open) return null;

  const copy = async (note: Note) => {
    try {
      await navigator.clipboard.writeText(note.text);
      onMessage("Note copied.");
    } catch {
      onMessage("Copy was blocked by the browser.");
    }
  };

  return (
    <div className="nw" data-no-toolbar>
      {!open && (
        <button ref={iconRef} type="button" key={savedPulse} className={`nw-icon ${savedPulse ? "is-saved" : ""}`} aria-label={`Open notes, ${notes.length} saved`} aria-expanded={false} onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 3h10l3 3v15H6z M9 9h7 M9 13h7 M9 17h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
          <span className="nw-count">{notes.length}</span>
        </button>
      )}
      {open && (
        <section className="nw-panel" aria-label="Saved notes" data-fr-block onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <header>
            <h2>Notes <span>{notes.length} saved</span></h2>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Minimize notes">–</button>
          </header>
          {notes.length === 0 ? (
            <p className="nw-empty">No notes yet. Select a passage in the lesson and choose “Save to notes”.</p>
          ) : (
            <ul>
              {notes.map((note) => (
                <li key={note.id}>
                  <button type="button" className="nw-text" onClick={() => { onOpenNote(note); if (window.innerWidth < 760) setOpen(false); }}>
                    “{note.text}”
                  </button>
                  <p className="nw-meta">{titleOf(note.sectionId)} · {new Date(note.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                  <label className="sr-only" htmlFor={`note-${note.id}`}>Your note on this passage</label>
                  <textarea id={`note-${note.id}`} rows={2} placeholder="Add your own note…" defaultValue={note.annotation} maxLength={500}
                    onBlur={(e) => { if (e.target.value !== note.annotation) annotateNote(note.id, e.target.value); }} />
                  <div className="nw-actions">
                    <button type="button" onClick={() => copy(note)}>Copy</button>
                    <button type="button" onClick={() => deleteNote(note.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
