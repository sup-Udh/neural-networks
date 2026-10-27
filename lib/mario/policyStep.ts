import { forward } from "../nn/network";
import type { ForwardResult, NetworkModel } from "../nn/network";
import { selectAction } from "./actions";
import type { KeyDriver, KeyState, MarioAction } from "./actions";
import { encodeObservation } from "./observation";
import type { GameSnapshot, Observation } from "./observation";

export interface NetworkStep {
  observation: Observation;
  trace: ForwardResult | null;
  action: MarioAction | null;
  keys: KeyState;
  explanation: string;
}

/**
 * One frame of network control: encode → forward → select → keys. Shared by the live controller and the headless
 * evaluator so training measures exactly the behaviour the user sees when they run the same model.
 */
export function networkStep(model: NetworkModel, snapshot: GameSnapshot, driver: KeyDriver): NetworkStep {
  const observation = encodeObservation(snapshot);
  if (!observation.available) {
    driver.reset();
    return { observation, trace: null, action: null, keys: {}, explanation: `No decision: ${observation.reason}.` };
  }
  try {
    const trace = forward(model, observation.inputs);
    const sel = selectAction(trace.output);
    return { observation, trace, action: sel.action, keys: driver.next(sel.action, observation.raw.isGrounded), explanation: sel.reason };
  } catch (error) {
    return {
      observation, trace: null, action: "wait", keys: driver.next("wait", observation.raw.isGrounded),
      explanation: `Inference failed: ${error instanceof Error ? error.message : String(error)}. Waiting.`,
    };
  }
}
