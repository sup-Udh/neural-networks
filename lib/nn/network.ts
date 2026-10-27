/*
 * A small feed-forward network. Convention: weights[layer][outputNeuron][inputNeuron], so
 * z[j] = sum_i weights[layer][j][i] * a[i] + biases[layer][j], then a_next[j] = activation(z[j]).
 */

export const ACTIVATION_NAMES = ["relu", "sigmoid", "tanh", "linear"] as const;
export type ActivationName = (typeof ACTIVATION_NAMES)[number];

export const ACTIVATIONS: Record<ActivationName, (z: number) => number> = {
  relu: (z) => Math.max(0, z),
  sigmoid: (z) => 1 / (1 + Math.exp(-z)),
  tanh: (z) => Math.tanh(z),
  linear: (z) => z,
};

export interface DenseLayer {
  weights: number[][];
  biases: number[];
  activation: ActivationName;
}

export interface NetworkModel {
  inputSize: number;
  layers: DenseLayer[];
}

export interface NeuronTrace {
  /** weight * input for each incoming connection. */
  terms: number[];
  weightedSum: number;
  bias: number;
  z: number;
  activation: ActivationName;
  output: number;
}

export interface LayerTrace {
  input: number[];
  neurons: NeuronTrace[];
  output: number[];
}

export interface ForwardResult {
  output: number[];
  layers: LayerTrace[];
}

/** Returns human-readable problems; an empty list means the model is valid. */
export function validateModel(model: NetworkModel): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(model.inputSize) || model.inputSize < 1) errors.push(`inputSize must be a positive integer (got ${model.inputSize}).`);
  if (model.layers.length === 0) errors.push("The network needs at least one layer.");
  let previous = model.inputSize;
  model.layers.forEach((layer, l) => {
    const name = `Layer ${l + 1}`;
    if (!(ACTIVATION_NAMES as readonly string[]).includes(layer.activation)) errors.push(`${name}: unsupported activation "${layer.activation}".`);
    if (layer.weights.length === 0) errors.push(`${name}: needs at least one neuron.`);
    if (layer.biases.length !== layer.weights.length) errors.push(`${name}: ${layer.weights.length} neurons but ${layer.biases.length} biases.`);
    layer.weights.forEach((row, j) => {
      if (row.length !== previous) errors.push(`${name}, neuron ${j + 1}: expected ${previous} weights but found ${row.length}.`);
      row.forEach((w, i) => {
        if (!Number.isFinite(w)) errors.push(`${name}, neuron ${j + 1}, weight ${i + 1} is not a finite number.`);
      });
    });
    layer.biases.forEach((b, j) => {
      if (!Number.isFinite(b)) errors.push(`${name}, neuron ${j + 1}: bias is not a finite number.`);
    });
    previous = layer.weights.length;
  });
  return errors;
}

export function assertValidModel(model: NetworkModel): void {
  const errors = validateModel(model);
  if (errors.length) throw new Error(errors.join(" "));
}

export function forward(model: NetworkModel, inputs: readonly number[]): ForwardResult {
  assertValidModel(model);
  if (inputs.length !== model.inputSize) throw new Error(`Expected ${model.inputSize} inputs but received ${inputs.length}.`);
  inputs.forEach((x, i) => {
    if (!Number.isFinite(x)) throw new Error(`Input ${i + 1} is not a finite number.`);
  });

  let a = [...inputs];
  const layers: LayerTrace[] = [];
  for (const layer of model.layers) {
    const fn = ACTIVATIONS[layer.activation];
    const input = a;
    const neurons = layer.weights.map((row, j): NeuronTrace => {
      const terms = row.map((w, i) => w * input[i]);
      const weightedSum = terms.reduce((s, t) => s + t, 0);
      const bias = layer.biases[j];
      const z = weightedSum + bias;
      return { terms, weightedSum, bias, z, activation: layer.activation, output: fn(z) };
    });
    a = neurons.map((n) => n.output);
    layers.push({ input, neurons, output: a });
  }
  return { output: a, layers };
}

/** Small seeded PRNG (mulberry32) so initial parameters are reproducible. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function initModel(inputSize: number, spec: { size: number; activation: ActivationName }[], seed: number): NetworkModel {
  const rand = seededRandom(seed);
  let previous = inputSize;
  const layers = spec.map(({ size, activation }) => {
    const scale = Math.sqrt(1 / previous);
    const weights = Array.from({ length: size }, () => Array.from({ length: previous }, () => (rand() * 2 - 1) * scale));
    previous = size;
    return { weights, biases: new Array<number>(size).fill(0), activation };
  });
  const model = { inputSize, layers };
  assertValidModel(model);
  return model;
}

function mapLayer(model: NetworkModel, index: number, fn: (l: DenseLayer) => DenseLayer): NetworkModel {
  return { ...model, layers: model.layers.map((l, i) => (i === index ? fn(l) : l)) };
}

/** Immutable updates: each returns a new model and leaves the argument untouched. */
export function withWeight(model: NetworkModel, layer: number, neuron: number, input: number, value: number): NetworkModel {
  if (!Number.isFinite(value)) throw new Error("Weight must be a finite number.");
  if (model.layers[layer]?.weights[neuron]?.[input] === undefined) throw new Error(`No weight at layer ${layer + 1}, neuron ${neuron + 1}, input ${input + 1}.`);
  return mapLayer(model, layer, (l) => ({
    ...l,
    weights: l.weights.map((row, j) => (j === neuron ? row.map((w, i) => (i === input ? value : w)) : row)),
  }));
}

export function withBias(model: NetworkModel, layer: number, neuron: number, value: number): NetworkModel {
  if (!Number.isFinite(value)) throw new Error("Bias must be a finite number.");
  if (model.layers[layer]?.biases[neuron] === undefined) throw new Error(`No bias at layer ${layer + 1}, neuron ${neuron + 1}.`);
  return mapLayer(model, layer, (l) => ({ ...l, biases: l.biases.map((b, j) => (j === neuron ? value : b)) }));
}

export function withActivation(model: NetworkModel, layer: number, activation: ActivationName): NetworkModel {
  if (!(ACTIVATION_NAMES as readonly string[]).includes(activation)) throw new Error(`Unsupported activation "${activation}".`);
  if (!model.layers[layer]) throw new Error(`No layer ${layer + 1}.`);
  return mapLayer(model, layer, (l) => ({ ...l, activation }));
}

export function cloneModel(model: NetworkModel): NetworkModel {
  return {
    inputSize: model.inputSize,
    layers: model.layers.map((l) => ({ activation: l.activation, biases: [...l.biases], weights: l.weights.map((r) => [...r]) })),
  };
}

/** Parses untrusted data (e.g. localStorage) into a validated model, or null. */
export function parseModel(data: unknown): NetworkModel | null {
  if (!data || typeof data !== "object") return null;
  const m = data as NetworkModel;
  if (!Array.isArray(m.layers) || typeof m.inputSize !== "number") return null;
  try {
    const clean = cloneModel(m);
    return validateModel(clean).length ? null : clean;
  } catch {
    return null;
  }
}
