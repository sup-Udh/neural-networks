/* Pure neuron mathematics. Shared by the diagram, equation, challenge and code editor; no React in here. */

export type ActivationId = "identity" | "relu" | "sigmoid";

export interface NeuronParams {
  x1: number;
  x2: number;
  w1: number;
  w2: number;
  bias: number;
  activation: ActivationId;
}

export interface ForwardResult {
  /** Individual contributions x₁w₁ and x₂w₂. */
  products: [number, number];
  /** Σ wᵢxᵢ, before the bias. */
  sum: number;
  /** Σ wᵢxᵢ + b. */
  z: number;
  /** f(z). */
  a: number;
}

export const ACTIVATIONS: Record<ActivationId, { label: string; formula: string; fn: (z: number) => number }> = {
  identity: { label: "Identity", formula: "f(z) = z", fn: (z) => z },
  relu: { label: "ReLU", formula: "f(z) = max(0, z)", fn: (z) => Math.max(0, z) },
  // exp(-z) overflows to Infinity for very negative z, which correctly gives 1 / Infinity = 0.
  sigmoid: { label: "Sigmoid", formula: "f(z) = 1 / (1 + e⁻ᶻ)", fn: (z) => 1 / (1 + Math.exp(-z)) },
};

export const ACTIVATION_IDS = Object.keys(ACTIVATIONS) as ActivationId[];

export const DEFAULT_PARAMS: NeuronParams = { x1: 1.5, x2: 2, w1: 0.6, w2: -0.4, bias: 0.2, activation: "identity" };

export function activate(id: ActivationId, z: number): number {
  return ACTIVATIONS[id].fn(z);
}

/** Σ wᵢxᵢ for any number of inputs. */
export function weightedSum(inputs: readonly number[], weights: readonly number[]): number {
  if (inputs.length !== weights.length) throw new Error("inputs and weights must have the same length");
  return inputs.reduce((total, x, i) => total + x * weights[i], 0);
}

export function forward(p: NeuronParams): ForwardResult {
  const products: [number, number] = [p.x1 * p.w1, p.x2 * p.w2];
  const sum = weightedSum([p.x1, p.x2], [p.w1, p.w2]);
  const z = sum + p.bias;
  return { products, sum, z, a: activate(p.activation, z) };
}

/** Keeps slider values free of floating-point noise such as 0.30000000000000004. */
export function roundParam(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Readable number: real minus sign, no trailing zeros, "—" for values that are not finite. */
export function formatNumber(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Number(n.toFixed(digits));
  const text = Object.is(rounded, -0) ? "0" : String(rounded);
  return text.replace("-", "−");
}

/** Number in an expression: negative values get parentheses so "×" and "+" stay unambiguous. */
export function formatOperand(n: number, digits = 3): string {
  return n < 0 ? `(${formatNumber(n, digits)})` : formatNumber(n, digits);
}
