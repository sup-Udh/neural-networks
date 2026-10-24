"use client";

interface CompanionSpeechBubbleProps {
  message: string;
  /** Prompt actions; omit for a plain dismissible note. */
  onAccept?: () => void;
  onClear?: () => void;
  onDismiss: () => void;
  docked?: boolean;
}

// mousedown is cancelled on the controls so pressing them never collapses the user's text selection.
const keepSelection = (event: React.MouseEvent) => event.preventDefault();

export default function CompanionSpeechBubble({ message, onAccept, onClear, onDismiss, docked }: CompanionSpeechBubbleProps) {
  return (
    <div className={`companion-bubble ${docked ? "companion-bubble-docked" : ""}`} role="status" data-fr-block>
      <button className="companion-bubble-close" type="button" aria-label="Dismiss" onMouseDown={keepSelection} onClick={onDismiss}>×</button>
      <p>{message}</p>
      <div className="companion-bubble-actions">
        {onAccept && <button type="button" className="is-primary" onMouseDown={keepSelection} onClick={onAccept}>Unpack</button>}
        {onClear && <button type="button" onMouseDown={keepSelection} onClick={onClear}>Clear selection</button>}
        <button type="button" onMouseDown={keepSelection} onClick={onDismiss}>Not now</button>
      </div>
    </div>
  );
}
