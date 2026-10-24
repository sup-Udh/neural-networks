import { describe, expect, it } from "vitest";
import { ACTIVATIONS, DEFAULT_PARAMS, activate, forward, formatNumber, roundParam, weightedSum } from "./neuron";
import type { NeuronParams } from "./neuron";
import { STEP_COUNT, describeStep } from "./steps";
import { SCENARIOS, evaluate, outcome } from "./challenge";

const params = (over: Partial<NeuronParams> = {}): NeuronParams => ({ ...DEFAULT_PARAMS, ...over });

describe("weighted sum", () => {
  it("multiplies and adds", () => expect(weightedSum([1, 2], [3, 4])).toBe(11));
  it("handles zero inputs", () => expect(weightedSum([0, 0], [5, -7])).toBe(0));
  it("handles negative inputs and weights", () => expect(weightedSum([-2, 3], [4, -1])).toBe(-11));
  it("rejects mismatched lengths", () => expect(() => weightedSum([1], [1, 2])).toThrow());
});

describe("bias", () => {
  it("is added after the weighted sum", () => {
    const r = forward(params({ x1: 2, x2: 3, w1: 1, w2: 1, bias: 0.5 }));
    expect(r.sum).toBe(5);
    expect(r.z).toBe(5.5);
  });
  it("shifts the result alone when inputs are zero", () => {
    expect(forward(params({ x1: 0, x2: 0, bias: -1.25 })).z).toBe(-1.25);
  });
});

describe("activations", () => {
  it("identity returns z", () => {
    expect(activate("identity", -3)).toBe(-3);
    expect(activate("identity", 0)).toBe(0);
    expect(activate("identity", 4.5)).toBe(4.5);
  });
  it("relu clips negatives", () => {
    expect(activate("relu", -2)).toBe(0);
    expect(activate("relu", 0)).toBe(0);
    expect(activate("relu", 3)).toBe(3);
  });
  it("sigmoid is 0.5 at zero, bounded and symmetric", () => {
    expect(activate("sigmoid", 0)).toBe(0.5);
    expect(activate("sigmoid", 2)).toBeCloseTo(0.8808, 4);
    expect(activate("sigmoid", -2)).toBeCloseTo(1 - activate("sigmoid", 2), 10);
    expect(activate("sigmoid", 1000)).toBe(1);
    expect(activate("sigmoid", -1000)).toBe(0);
  });
  it("lists a formula for every activation", () => {
    for (const id of Object.keys(ACTIVATIONS) as (keyof typeof ACTIVATIONS)[]) expect(ACTIVATIONS[id].formula).toContain("f(z)");
  });
});

describe("forward pass and parameter changes", () => {
  it("applies the chosen activation to z", () => {
    const base = params({ x1: 1, x2: 1, w1: 1, w2: -3, bias: 0 });
    expect(forward(base).z).toBe(-2);
    expect(forward({ ...base, activation: "identity" }).a).toBe(-2);
    expect(forward({ ...base, activation: "relu" }).a).toBe(0);
    expect(forward({ ...base, activation: "sigmoid" }).a).toBeCloseTo(0.1192, 4);
  });
  it("responds to each parameter", () => {
    const base = params();
    const out = forward(base).a;
    expect(forward({ ...base, x1: base.x1 + 1 }).a).not.toBe(out);
    expect(forward({ ...base, w2: base.w2 + 1 }).a).not.toBe(out);
    expect(forward({ ...base, bias: base.bias + 1 }).a).toBeCloseTo(out + 1, 10);
  });
  it("keeps z equal to products plus bias (output synchronisation)", () => {
    const p = params({ x1: -1.2, x2: 0.7, w1: 0.9, w2: -1.1, bias: 0.3 });
    const r = forward(p);
    expect(r.z).toBeCloseTo(r.products[0] + r.products[1] + p.bias, 12);
    expect(r.a).toBe(activate(p.activation, r.z));
  });
});

describe("formatting", () => {
  it("uses a real minus and trims zeros", () => {
    expect(formatNumber(-0.5)).toBe("−0.5");
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(0.30000000000000004)).toBe("0.3");
  });
  it("never prints negative zero or non-finite numbers", () => {
    expect(formatNumber(-0.0001)).toBe("0");
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
  it("rounds slider values", () => expect(roundParam(0.1 + 0.2)).toBe(0.3));
});

describe("step descriptions", () => {
  it("ends on the same output as forward()", () => {
    const p = params({ activation: "sigmoid" });
    expect(describeStep(p, STEP_COUNT - 1).text).toContain(formatNumber(forward(p).a));
  });
});

describe("challenge scenarios", () => {
  it("derives the answer from the maths", () => {
    const directions = SCENARIOS.map((s) => outcome(s).direction);
    expect(directions).toContain("increase");
    expect(directions).toContain("decrease");
    expect(directions).toContain("same");
  });
  it("accepts only the true direction", () => {
    for (const s of SCENARIOS) {
      const truth = outcome(s).direction;
      for (const choice of ["increase", "decrease", "same"] as const) expect(evaluate(s, choice).correct).toBe(choice === truth);
    }
  });
});
