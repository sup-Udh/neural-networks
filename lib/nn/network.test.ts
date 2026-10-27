import { describe, expect, it } from "vitest";
import { forward, initModel, validateModel, withActivation, withBias, withWeight } from "./network";
import type { NetworkModel } from "./network";

const model = (): NetworkModel => ({
  inputSize: 2,
  layers: [
    { activation: "relu", weights: [[1, -1], [0.5, 0.5]], biases: [0, -1] },
    { activation: "linear", weights: [[2, 3]], biases: [0.25] },
  ],
});

describe("forward pass", () => {
  it("computes weighted sums, bias, activation and layering by hand", () => {
    const r = forward(model(), [3, 1]);
    // layer 1: z = [3*1 + 1*-1 + 0, 3*.5 + 1*.5 - 1] = [2, 1] -> relu -> [2, 1]
    expect(r.layers[0].neurons.map((n) => n.z)).toEqual([2, 1]);
    expect(r.layers[0].neurons[0].terms).toEqual([3, -1]);
    expect(r.layers[0].neurons[1].bias).toBe(-1);
    // layer 2: 2*2 + 3*1 + 0.25
    expect(r.output).toEqual([7.25]);
    expect(r.layers[1].input).toEqual([2, 1]);
  });
  it("applies each activation", () => {
    const base = model();
    const out = (a: "relu" | "sigmoid" | "tanh" | "linear") => forward(withActivation(base, 1, a), [3, 1]).output[0];
    expect(out("linear")).toBe(7.25);
    expect(out("relu")).toBe(7.25);
    expect(out("sigmoid")).toBeCloseTo(1 / (1 + Math.exp(-7.25)), 12);
    expect(out("tanh")).toBeCloseTo(Math.tanh(7.25), 12);
    expect(forward(model(), [-3, 1]).layers[0].neurons[0].output).toBe(0); // relu clips z = -4
  });
  it("trace output equals the returned output", () => {
    const r = forward(initModel(5, [{ size: 4, activation: "tanh" }, { size: 3, activation: "linear" }], 7), [1, 0, 0.5, -1, 1]);
    expect(r.layers.at(-1)?.output).toEqual(r.output);
    expect(r.output).toHaveLength(3);
  });
  it("rejects wrong input size and non-finite inputs", () => {
    expect(() => forward(model(), [1])).toThrow(/Expected 2 inputs/);
    expect(() => forward(model(), [1, NaN])).toThrow(/finite/);
  });
});

describe("validation", () => {
  it("accepts a good model", () => expect(validateModel(model())).toEqual([]));
  it("reports dimension, bias, activation and numeric problems", () => {
    const bad = model();
    bad.layers[0].weights[0] = [1];
    bad.layers[0].biases = [0];
    bad.layers[1].weights[0][1] = Infinity;
    (bad.layers[1] as { activation: string }).activation = "softmax";
    const errors = validateModel(bad).join(" ");
    expect(errors).toMatch(/expected 2 weights but found 1/);
    expect(errors).toMatch(/2 neurons but 1 biases/);
    expect(errors).toMatch(/not a finite number/);
    expect(errors).toMatch(/unsupported activation "softmax"/);
    expect(() => forward(bad, [1, 1])).toThrow();
  });
});

describe("immutable edits", () => {
  it("changes predictions without mutating the original", () => {
    const m = model();
    const before = forward(m, [3, 1]).output[0];
    const edited = withWeight(m, 1, 0, 0, 10);
    expect(forward(edited, [3, 1]).output[0]).toBe(10 * 2 + 3 + 0.25);
    expect(forward(m, [3, 1]).output[0]).toBe(before);
    expect(withBias(m, 1, 0, 1).layers[1].biases[0]).toBe(1);
    expect(m.layers[1].biases[0]).toBe(0.25);
  });
  it("rejects invalid edits", () => {
    expect(() => withWeight(model(), 0, 0, 0, NaN)).toThrow(/finite/);
    expect(() => withWeight(model(), 5, 0, 0, 1)).toThrow(/No weight/);
    expect(() => withBias(model(), 0, 9, 1)).toThrow(/No bias/);
  });
  it("seeded init is reproducible", () => {
    const spec = [{ size: 3, activation: "relu" as const }];
    expect(initModel(2, spec, 1)).toEqual(initModel(2, spec, 1));
    expect(initModel(2, spec, 1)).not.toEqual(initModel(2, spec, 2));
  });
});
