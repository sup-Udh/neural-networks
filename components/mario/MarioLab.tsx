"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import MarioGame from "@/components/game/MarioGame";
import { MarioController } from "@/lib/mario/controller";
import type { ControlMode, MarioHooks } from "@/lib/mario/controller";
import { liveStore } from "@/lib/mario/liveStore";
import { WorkerPolicy } from "@/lib/mario/policyWorker";
import * as W from "@/lib/mario/workspace";
import type { Workspace } from "@/lib/mario/workspace";
import type { ActivationName } from "@/lib/nn/network";
import { DecisionInspector, EpisodeMetricsPanel, useLive } from "./DecisionInspector";
import ExperimentsPanel from "./ExperimentsPanel";
import NetworkViz from "./NetworkViz";
import type { Selected } from "./NetworkViz";
import ParameterEditor from "./ParameterEditor";
import PolicyEditor from "./PolicyEditor";
import "./mario-lab.css";

type Tab = "network" | "parameters" | "policy" | "experiments";
const TABS: [Tab, string][] = [["network", "Network"], ["parameters", "Parameters"], ["policy", "Policy code"], ["experiments", "Experiments"]];
const MODES: [ControlMode, string][] = [["human", "Human (keyboard)"], ["network", "Neural network"], ["policy", "Policy code"]];

export default function MarioLab() {
  const ws = useSyncExternalStore(W.workspaceStore.subscribe, W.workspaceStore.get, W.workspaceStore.getServer);
  const wsRef = useRef(ws);
  useEffect(() => {
    wsRef.current = ws;
  });

  const hooksRef = useRef<MarioHooks | null>(null);
  const controllerRef = useRef<MarioController | null>(null);
  const policyRef = useRef<WorkerPolicy | null>(null);
  const recordedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<ControlMode>("human");
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState<Tab>("network");
  const [selected, setSelected] = useState<Selected | null>({ layer: 1, neuron: 1 });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const live = useLive();

  /** Applies a workspace update; invalid edits throw and are shown instead of silently ignored. */
  const update = useCallback((fn: (w: Workspace) => Workspace) => {
    try {
      W.workspaceStore.set(fn(wsRef.current));
      setMessage(null);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  // One policy worker per applied code version; disposed when replaced or unmounted.
  useEffect(() => {
    const p = new WorkerPolicy(ws.activeCode);
    policyRef.current = p;
    return () => {
      p.dispose();
      if (policyRef.current === p) policyRef.current = null;
    };
  }, [ws.activeCode, ws.codeVersion]);

  const onReady = useCallback(
    (hooks: MarioHooks) => {
      controllerRef.current?.detach();
      hooksRef.current = hooks;
      const controller = new MarioController({
        hooks,
        getModel: () => ({ model: wsRef.current.model, revision: wsRef.current.revision }),
        getPolicy: () => policyRef.current,
        onDecision: (decision, metrics) => {
          liveStore.set({ decision, metrics });
          if (metrics.status === "running") recordedRef.current = false;
          else if (!recordedRef.current) {
            recordedRef.current = true;
            update((w) => W.recordRun(w, controllerRef.current?.getMode() ?? "human", metrics));
          }
        },
      });
      controllerRef.current = controller;
      controller.attach();
      setReady(true);
    },
    [update],
  );

  useEffect(
    () => () => {
      controllerRef.current?.detach();
      controllerRef.current = null;
      hooksRef.current = null;
      liveStore.clear();
    },
    [],
  );

  const setMode = (m: ControlMode) => {
    controllerRef.current?.setMode(m);
    setModeState(m);
  };
  const reset = () => {
    try {
      controllerRef.current?.resetEpisode();
      hooksRef.current?.reset();
      recordedRef.current = false;
      liveStore.clear();
    } catch (error) {
      setMessage({ ok: false, text: `Could not reset yet: ${error instanceof Error ? error.message : String(error)}` });
    }
  };
  const setPause = (p: boolean) => {
    if (!hooksRef.current) return;
    hooksRef.current.paused = p;
    setPaused(p);
  };
  const run = () => {
    reset();
    setPause(false);
  };

  const decision = live.decision;
  const trace = decision?.trace ?? null;
  const inputs = decision?.observation.available ? decision.observation.inputs : null;

  return (
    <div className="ml">
      <div className="ml-stage">
        <MarioGame onReady={onReady} />
        <div className="ml-controls" role="group" aria-label="Simulation controls">
          <div className="ml-row" role="radiogroup" aria-label="Controller">
            {MODES.map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : ""} onClick={() => setMode(m)} disabled={!ready}>
                {label}
              </button>
            ))}
          </div>
          <div className="ml-row">
            <button type="button" className="is-primary" onClick={run} disabled={!ready} title="Reload the level and start a fresh episode">Run (restart level)</button>
            <button type="button" onClick={() => setPause(true)} disabled={!ready || paused}>Pause</button>
            <button type="button" onClick={() => setPause(false)} disabled={!ready || !paused}>Resume</button>
            <button type="button" onClick={reset} disabled={!ready}>Reset level</button>
          </div>
          <p className="ml-note">
            {!ready ? "Loading the game…" : mode === "human" ? "Keyboard: arrows move, X jumps, Z runs." : `${mode === "network" ? "Neural network" : "Policy code"} is controlling Mario; the keyboard is ignored.`}
            {" "}Active: model rev {ws.revision} ({ws.basedOn ?? "edited"}), policy v{ws.codeVersion}.
          </p>
          {message && <p className={message.ok ? "ml-ok" : "ml-error"} role="alert">{message.text}</p>}
        </div>
        <EpisodeMetricsPanel />
      </div>

      <div className="ml-side">
        <div className="ml-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="ml-panel" role="tabpanel">
          {tab === "network" && (
            <>
              <NetworkViz model={ws.model} trace={trace} inputs={inputs} chosen={decision?.action ?? null} selected={selected} onSelect={(s) => { setSelected(s); setTab("parameters"); }} />
              <p className="ml-note">Circles show real activations from the latest forward pass. Click a neuron to edit it. Blue = positive weight, orange = negative.</p>
              <DecisionInspector />
            </>
          )}
          {tab === "parameters" && (
            <>
              <div className="ml-row">
                <button type="button" onClick={() => setTab("network")}>← Diagram</button>
                <button type="button" onClick={() => update(W.resetModel)}>Reset to starter model</button>
              </div>
              <ParameterEditor
                model={ws.model}
                selected={selected}
                onWeight={(l, n, i, v) => update((w) => W.editWeight(w, l, n, i, v))}
                onBias={(l, n, v) => update((w) => W.editBias(w, l, n, v))}
                onActivation={(l, a: ActivationName) => update((w) => W.editActivation(w, l, a))}
              />
              <p className="ml-note">Edits apply immediately to the model Mario uses, on the next frame.</p>
            </>
          )}
          {tab === "policy" && (
            <PolicyEditor
              draft={ws.draftCode}
              active={ws.activeCode}
              version={ws.codeVersion}
              onDraft={(c) => update((w) => W.setDraftCode(w, c))}
              onApply={() => update(W.applyCode)}
              onReset={() => update(W.resetCode)}
            />
          )}
          {tab === "experiments" && (
            <ExperimentsPanel ws={ws} onSave={(n) => update((w) => W.saveSnapshot(w, n))} onRestore={(id) => update((w) => W.restoreSnapshot(w, id))} onDelete={(id) => update((w) => W.deleteSnapshot(w, id))} />
          )}
        </div>
      </div>
    </div>
  );
}
