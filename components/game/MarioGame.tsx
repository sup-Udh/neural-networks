"use client";



import { useEffect, useRef, useState } from "react";

// must load in this order
const LEGACY_SCRIPTS = [
  "util.js",
  "input.js",
  "resources.js",
  "sprite.js",
  "entity.js",
  "pipe.js",
  "mushroom.js",
  "fireflower.js",
  "star.js",
  "fireball.js",
  "coin.js",
  "bcoin.js",
  "goomba.js",
  "koopa.js",
  "floor.js",
  "block.js",
  "rubble.js",
  "prop.js",
  "player.js",
  "flag.js",
  "levels/level.js",
  "levels/11.js",
  "levels/11tunnel.js",
  "game.js",
] as const;

const SCRIPT_BASE = "/game/mario/js/";

declare global {
  interface Window {
    __marioGameHost?: HTMLElement;
    __marioGameDestroy?: () => void;
  }
}

type GameStatus = "loading" | "ready" | "error";
// adding the scripts in order

function loadScript(src: string, scripts: HTMLScriptElement[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.marioScript = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}.`));
    scripts.push(script);
    document.head.appendChild(script);
  });
}


export default function MarioGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<GameStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scripts: HTMLScriptElement[] = [];
    let cancelled = false;

    // game.js reads this value when it runs and appends its canvas here.
    window.__marioGameHost = host;

    const startGame = async () => {
      try {
        for (const file of LEGACY_SCRIPTS) {
          await loadScript(`${SCRIPT_BASE}${file}`, scripts);
          if (cancelled) return;
        }
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "The Mario game could not be loaded.");
      }
    };

    void startGame();

    return () => {
      cancelled = true;

      window.__marioGameDestroy?.();
      host.replaceChildren();
      if (window.__marioGameHost === host) delete window.__marioGameHost;
      delete window.__marioGameDestroy;
      scripts.forEach((script) => script.remove());
    };
  }, []);

  return (
    <section className="mario-game" aria-label="Mario game">
      <div className="mario-game__host" ref={hostRef} />
      {status === "loading" && <p className="mario-game__message">Loading game…</p>}
      {status === "error" && <p className="mario-game__message mario-game__message--error">{error}</p>}
    </section>
  );
}
