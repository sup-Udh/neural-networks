import { ACTIVATIONS, forward, formatNumber, formatOperand } from "./neuron";
import type { NeuronParams } from "./neuron";

export const STEP_COUNT = 6;

export interface StepInfo {
  title: string;
  text: string;
}

/** What the neuron is doing at playback step `step` (0-based), written from the live parameters. */
export function describeStep(p: NeuronParams, step: number): StepInfo {
  const r = forward(p);
  const f = ACTIVATIONS[p.activation].label.toLowerCase();
  switch (step) {
    case 0:
      return { title: "Inputs arrive", text: `The neuron receives x₁ = ${formatNumber(p.x1)} and x₂ = ${formatNumber(p.x2)}.` };
    case 1:
      return {
        title: "Multiply by weights",
        text: `Each input is scaled by its weight: x₁·w₁ = ${formatOperand(p.x1)} × ${formatOperand(p.w1)} = ${formatNumber(r.products[0])}, and x₂·w₂ = ${formatOperand(p.x2)} × ${formatOperand(p.w2)} = ${formatNumber(r.products[1])}.`,
      };
    case 2:
      return {
        title: "Add the contributions",
        text: `The neuron adds the two products: ${formatNumber(r.products[0])} + ${formatOperand(r.products[1])} = ${formatNumber(r.sum)}.`,
      };
    case 3:
      return {
        title: "Add the bias",
        text: `Now the bias shifts the total: z = ${formatNumber(r.sum)} + ${formatOperand(p.bias)} = ${formatNumber(r.z)}.`,
      };
    case 4:
      return {
        title: "Apply the activation",
        text: `The ${f} function transforms z: a = f(${formatNumber(r.z)}) = ${formatNumber(r.a)}.`,
      };
    default:
      return { title: "Output", text: `The neuron outputs a = ${formatNumber(r.a)}.` };
  }
}
