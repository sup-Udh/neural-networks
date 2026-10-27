import type { NetworkModel } from "./network";

/** Short architecture description, e.g. "5 → 5 relu → 3 linear". */
export function architectureSignature(m: NetworkModel): string {
  return [String(m.inputSize), ...m.layers.map((l) => `${l.weights.length} ${l.activation}`)].join(" → ");
}

/** Stable content hash of a model's parameters, architecture and activations (FNV-1a over a canonical string). */
export function modelHash(m: NetworkModel): string {
  const canon = JSON.stringify([m.inputSize, m.layers.map((l) => [l.activation, l.weights, l.biases])]);
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface ParamChange {
  where: string;
  a: number | string;
  b: number | string;
  /** b − a for numbers; absent for activation changes. */
  delta?: number;
}

export interface ModelComparison {
  /** True only if every layer has the same shape, so every parameter has a counterpart. */
  compatible: boolean;
  structural: string[];
  comparedParams: number;
  changedParams: number;
  percentChanged: number | null;
  maxAbsDiff: number | null;
  /** Mean |b − a| over all compared parameters (unchanged ones count as 0). */
  meanAbsDiff: number | null;
  changes: ParamChange[];
}

/** Compares two models parameter by parameter. Layers whose shapes differ are reported structurally, not numerically. */
export function compareModels(a: NetworkModel, b: NetworkModel): ModelComparison {
  const structural: string[] = [];
  if (a.inputSize !== b.inputSize) structural.push(`Input size ${a.inputSize} vs ${b.inputSize}.`);
  if (a.layers.length !== b.layers.length) structural.push(`${a.layers.length} layers vs ${b.layers.length} layers.`);
  const changes: ParamChange[] = [];
  let compared = 0;
  let absSum = 0;
  let maxAbs = 0;
  const prevA = (i: number) => (i === 0 ? a.inputSize : a.layers[i - 1].weights.length);
  const prevB = (i: number) => (i === 0 ? b.inputSize : b.layers[i - 1].weights.length);

  for (let l = 0; l < Math.min(a.layers.length, b.layers.length); l++) {
    const la = a.layers[l];
    const lb = b.layers[l];
    const sameShape = la.weights.length === lb.weights.length && prevA(l) === prevB(l);
    if (!sameShape) {
      structural.push(`Layer ${l + 1}: ${prevA(l)}→${la.weights.length} vs ${prevB(l)}→${lb.weights.length}; its parameters are not compared.`);
      continue;
    }
    if (la.activation !== lb.activation) changes.push({ where: `L${l + 1} activation`, a: la.activation, b: lb.activation });
    la.weights.forEach((row, j) =>
      row.forEach((w, i) => {
        const d = lb.weights[j][i] - w;
        compared++;
        absSum += Math.abs(d);
        maxAbs = Math.max(maxAbs, Math.abs(d));
        if (d !== 0) changes.push({ where: `L${l + 1} n${j + 1} w${i + 1}`, a: w, b: lb.weights[j][i], delta: d });
      }),
    );
    la.biases.forEach((bias, j) => {
      const d = lb.biases[j] - bias;
      compared++;
      absSum += Math.abs(d);
      maxAbs = Math.max(maxAbs, Math.abs(d));
      if (d !== 0) changes.push({ where: `L${l + 1} n${j + 1} bias`, a: bias, b: lb.biases[j], delta: d });
    });
  }
  changes.sort((x, y) => Math.abs(y.delta ?? Infinity) - Math.abs(x.delta ?? Infinity));
  const changedParams = changes.filter((c) => c.delta !== undefined).length;
  return {
    compatible: structural.length === 0,
    structural,
    comparedParams: compared,
    changedParams,
    percentChanged: compared ? (changedParams / compared) * 100 : null,
    maxAbsDiff: compared ? maxAbs : null,
    meanAbsDiff: compared ? absSum / compared : null,
    changes,
  };
}
