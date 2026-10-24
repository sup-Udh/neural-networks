import { forward, formatNumber } from "./neuron";
import type { NeuronParams } from "./neuron";

export type Direction = "increase" | "decrease" | "same";

export interface Scenario {
  id: string;
  /** The question shown to the learner. */
  prompt: string;
  base: NeuronParams;
  change: Partial<NeuronParams>;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "negative-weight",
    prompt: "w₂ is already negative. We make it even more negative: w₂ goes from −0.4 to −1.2. What happens to the output?",
    base: { x1: 1.5, x2: 2, w1: 0.6, w2: -0.4, bias: 0.2, activation: "identity" },
    change: { w2: -1.2 },
  },
  {
    id: "relu-flat",
    prompt: "This neuron uses ReLU and currently has a negative z. We raise w₁ from 0.5 to 1. What happens to the output?",
    base: { x1: 1, x2: 2, w1: 0.5, w2: -1, bias: 0, activation: "relu" },
    change: { w1: 1 },
  },
  {
    id: "sigmoid-up",
    prompt: "This neuron uses sigmoid. We raise w₁ from 0.5 to 1 while x₁ stays positive. What happens to the output?",
    base: { x1: 2, x2: 1, w1: 0.5, w2: 0.3, bias: -0.5, activation: "sigmoid" },
    change: { w1: 1 },
  },
];

const SAME_TOLERANCE = 5e-4;

export function outcome(s: Scenario) {
  const before = forward(s.base);
  const after = forward({ ...s.base, ...s.change });
  const delta = after.a - before.a;
  const direction: Direction = Math.abs(delta) < SAME_TOLERANCE ? "same" : delta > 0 ? "increase" : "decrease";
  return { before, after, direction };
}

export function evaluate(s: Scenario, choice: Direction) {
  const result = outcome(s);
  const correct = choice === result.direction;
  const { before, after } = result;
  let why = `Before the change z = ${formatNumber(before.z)} and a = ${formatNumber(before.a)}. After it z = ${formatNumber(after.z)} and a = ${formatNumber(after.a)}.`;
  if (s.base.activation === "relu" && before.z <= 0 && after.z <= 0) {
    why += " ReLU outputs 0 for every z ≤ 0, so the weight changed z but not the output.";
  } else if (s.base.activation === "sigmoid") {
    why += " Sigmoid always rises as z rises, so a larger z means a larger output.";
  } else if (result.direction === "decrease") {
    why += " A more negative weight on a positive input pulls the weighted sum down.";
  }
  return { correct, ...result, why };
}
