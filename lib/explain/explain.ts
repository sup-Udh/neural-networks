/*
 * Local explanations for the lesson. There is no AI backend in this project, so these are hand-written
 * explanations keyed to the lesson's concepts and filled in with the learner's live numbers.
 * The UI labels them as locally generated.
 */
import { ACTIVATIONS, forward, formatNumber, formatOperand } from "../neuron/neuron";
import type { NeuronParams } from "../neuron/neuron";

export interface Concept {
  id: string;
  title: string;
  keywords: string[];
  /** Section that teaches it, used as the fallback when a passage matches nothing specific. */
  sectionIds: string[];
  simple: string;
  meaning: string;
  terms: [string, string][];
  steps: string[];
  formula?: string;
  example: (p: NeuronParams) => string;
  /** Playback step that best shows this concept in the diagram. */
  inspectStep?: number;
}

const f = formatNumber;

export const CONCEPTS: Concept[] = [
  {
    id: "neural-network",
    title: "Neural network",
    keywords: ["neural network", "neural networks", "learn", "predict"],
    sectionIds: ["welcome"],
    simple: "A neural network is a function built from many small units (neurons) whose numbers are adjusted until its predictions get good.",
    meaning: "Instead of writing rules by hand, we build a flexible function and let data decide the numbers inside it.",
    terms: [
      ["Neuron", "A small calculation that turns several numbers into one."],
      ["Parameter", "A number inside the network (a weight or a bias) that can be adjusted."],
    ],
    steps: ["Numbers go in.", "Each neuron combines them using its weights and bias.", "A final number comes out as the prediction."],
    example: (p) => `Here the "network" is a single neuron. With x₁ = ${f(p.x1)} and x₂ = ${f(p.x2)} it predicts ${f(forward(p).a)}.`,
  },
  {
    id: "neuron",
    title: "Neuron",
    keywords: ["neuron", "first neuron", "building block"],
    sectionIds: ["neuron"],
    simple: "A neuron multiplies each input by a weight, adds the results together with a bias, then passes that total through an activation function.",
    meaning: "It is the smallest unit of a neural network: a weighted vote followed by a shaping step.",
    terms: [
      ["z", "The raw total: weighted inputs plus the bias."],
      ["a", "The neuron's output after the activation function."],
    ],
    steps: ["Multiply each input by its weight.", "Add the products together.", "Add the bias to get z.", "Apply the activation function to get a."],
    formula: "z = w₁x₁ + w₂x₂ + b\na = f(z)",
    example: (p) => {
      const r = forward(p);
      return `z = ${formatOperand(p.w1)}×${formatOperand(p.x1)} + ${formatOperand(p.w2)}×${formatOperand(p.x2)} + ${formatOperand(p.bias)} = ${f(r.z)}, so a = ${f(r.a)}.`;
    },
    inspectStep: 1,
  },
  {
    id: "input",
    title: "Input",
    keywords: ["input", "inputs", "x₁", "x₂", "x1", "x2"],
    sectionIds: ["inputs"],
    simple: "Inputs are the numbers you give the neuron, such as measurements. Here they are x₁ and x₂.",
    meaning: "An input is just a value describing something about the example. The neuron never changes it; it only weighs it.",
    terms: [["Feature", "A measurable property of an example, such as a size or a count."]],
    steps: ["Choose a value for x₁ and x₂.", "Each travels along its own connection.", "A weight scales it on the way in."],
    example: (p) => `Right now x₁ = ${f(p.x1)} and x₂ = ${f(p.x2)}. Moving x₁ to ${f(p.x1 + 1)} would change the product x₁w₁ from ${f(p.x1 * p.w1)} to ${f((p.x1 + 1) * p.w1)}.`,
    inspectStep: 0,
  },
  {
    id: "weight",
    title: "Weight",
    keywords: ["weight", "weights", "w₁", "w₂", "w1", "w2", "positive weight", "negative weight"],
    sectionIds: ["weights"],
    simple: "A weight says how strongly one input pushes the neuron's total up (positive weight) or down (negative weight).",
    meaning: "The weight multiplies its input. A large weight magnifies the input, a small one mutes it, a negative one flips its direction.",
    terms: [
      ["Positive weight", "A larger input raises z."],
      ["Negative weight", "A larger input lowers z."],
    ],
    steps: ["Take an input.", "Multiply by its weight.", "The product is that input's contribution to z."],
    formula: "contribution = wᵢ · xᵢ",
    example: (p) => `With w₁ = ${f(p.w1)} the first input contributes ${f(p.x1)} × ${formatOperand(p.w1)} = ${f(p.x1 * p.w1)}. With w₂ = ${f(p.w2)} the second contributes ${f(p.x2 * p.w2)}.`,
    inspectStep: 1,
  },
  {
    id: "weighted-sum",
    title: "Weighted sum",
    keywords: ["weighted sum", "weighted total", "sum", "add the products", "adds"],
    sectionIds: ["neuron", "computation"],
    simple: "The weighted sum multiplies every input by its weight and adds the results together.",
    meaning: "It is the neuron's combined opinion of all its inputs before the bias and activation are applied.",
    terms: [
      ["Σ (sigma)", "Shorthand for 'add up all of these'."],
      ["Product", "The result of one multiplication, such as x₁w₁."],
    ],
    steps: ["Compute x₁ × w₁.", "Compute x₂ × w₂.", "Add the two products."],
    formula: "Σ = w₁x₁ + w₂x₂",
    example: (p) => {
      const r = forward(p);
      return `${f(r.products[0])} + ${formatOperand(r.products[1])} = ${f(r.sum)}.`;
    },
    inspectStep: 2,
  },
  {
    id: "bias",
    title: "Bias",
    keywords: ["bias", "shift", "baseline"],
    sectionIds: ["bias"],
    simple: "The bias is a number added to the weighted sum. It shifts the result up or down no matter what the inputs are.",
    meaning: "Without a bias, all-zero inputs would always give z = 0. The bias lets the neuron start from a different baseline.",
    terms: [["Offset", "A fixed amount added to every result."]],
    steps: ["Compute the weighted sum.", "Add b to it.", "The result is z."],
    formula: "z = (w₁x₁ + w₂x₂) + b",
    example: (p) => `The weighted sum is ${f(forward(p).sum)}. Adding b = ${f(p.bias)} gives z = ${f(forward(p).z)}.`,
    inspectStep: 3,
  },
  {
    id: "activation",
    title: "Activation function",
    keywords: ["activation", "f(z)", "squash", "non-linear", "nonlinear"],
    sectionIds: ["activation"],
    simple: "The activation function reshapes z into the neuron's final output, for example by clipping negatives or squeezing the value into 0 to 1.",
    meaning: "It lets a neuron respond in non-straight-line ways, which is what makes networks of neurons more expressive than a single straight-line formula.",
    terms: [
      ["Identity", "Leaves z unchanged."],
      ["ReLU", "Replaces negative z with 0."],
      ["Sigmoid", "Maps any z to a number between 0 and 1."],
    ],
    steps: ["Take z from the previous step.", "Feed it into f.", "The result is the output a."],
    formula: "a = f(z)",
    example: (p) => `${ACTIVATIONS[p.activation].label} turns z = ${f(forward(p).z)} into a = ${f(forward(p).a)}.`,
    inspectStep: 4,
  },
  {
    id: "relu",
    title: "ReLU",
    keywords: ["relu", "max(0"],
    sectionIds: [],
    simple: "ReLU passes positive values through and turns every negative value into 0.",
    meaning: "It is the 'rectified linear unit': a straight line for z > 0 and flat zero for z ≤ 0.",
    terms: [["Rectify", "Cut off the negative part."]],
    steps: ["If z is greater than 0, output z.", "Otherwise output 0."],
    formula: "f(z) = max(0, z)",
    example: (p) => `ReLU(${f(forward(p).z)}) = ${f(Math.max(0, forward(p).z))}.`,
    inspectStep: 4,
  },
  {
    id: "sigmoid",
    title: "Sigmoid",
    keywords: ["sigmoid", "e⁻ᶻ", "squash"],
    sectionIds: [],
    simple: "Sigmoid squeezes any number into the range 0 to 1, smoothly. Very negative z gives almost 0, very positive z gives almost 1.",
    meaning: "It turns an unbounded score into something that can be read like a probability or a soft on/off.",
    terms: [["e", "Euler's number, about 2.718."], ["Saturate", "Flatten out near 0 or 1, where changing z barely changes the output."]],
    steps: ["Compute e raised to −z.", "Add 1.", "Take 1 divided by that result."],
    formula: "f(z) = 1 / (1 + e⁻ᶻ)",
    example: (p) => `sigmoid(${f(forward(p).z)}) = ${f(1 / (1 + Math.exp(-forward(p).z)))}.`,
    inspectStep: 4,
  },
  {
    id: "output",
    title: "Output",
    keywords: ["output", "result", "prediction"],
    sectionIds: ["challenge", "code"],
    simple: "The output is the neuron's final number a, the prediction after the activation function.",
    meaning: "Everything upstream (inputs, weights, bias, activation) exists to produce this one value.",
    terms: [["Forward pass", "Computing the output from the inputs, front to back."]],
    steps: ["Inputs are weighted and summed.", "The bias is added.", "The activation function is applied.", "The result is the output."],
    example: (p) => `For the current settings the output is ${f(forward(p).a)}.`,
    inspectStep: 5,
  },
  {
    id: "layers",
    title: "Layers and training",
    keywords: ["layer", "layers", "loss", "training", "backpropagation", "multilayer"],
    sectionIds: ["next"],
    simple: "Real networks connect many neurons in layers, then adjust their weights and biases to reduce a loss, a score for how wrong the predictions are.",
    meaning: "This lesson covers one neuron's forward pass. Training (how the numbers get adjusted) comes in later lessons.",
    terms: [["Layer", "A group of neurons that process the same inputs side by side."], ["Loss", "A number measuring how far a prediction is from the right answer."]],
    steps: ["Many neurons form a layer.", "Layer outputs feed the next layer.", "Training nudges weights to lower the loss."],
    example: () => "The single neuron you have been using is the building block that gets repeated in every layer.",
  },
];

export interface Passage {
  text: string;
  sectionId: string;
}

function matchConcepts(passage: Passage): Concept[] {
  const text = passage.text.toLowerCase();
  const scored = CONCEPTS.map((c) => ({ c, score: c.keywords.filter((k) => text.includes(k.toLowerCase())).length * 2 + (c.sectionIds.includes(passage.sectionId) ? 0.5 : 0) }))
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.c);
}

function fallbackConcept(passage: Passage): Concept | null {
  return CONCEPTS.find((c) => c.sectionIds.includes(passage.sectionId)) ?? null;
}

export interface Explanation {
  concepts: Concept[];
  /** True when nothing in the passage matched a known lesson concept. */
  generic: boolean;
  simple: string;
  example: string;
}

export function explainPassage(passage: Passage, p: NeuronParams): Explanation {
  const matched = matchConcepts(passage);
  const concepts = matched.length ? matched.slice(0, 2) : [fallbackConcept(passage)].filter((c): c is Concept => c !== null);
  const lead = concepts[0];
  if (!lead) {
    return { concepts: [], generic: true, simple: "I don't have a specific note for this passage. Try selecting a phrase about weights, bias, activation or the weighted sum.", example: "" };
  }
  return {
    concepts,
    generic: matched.length === 0,
    simple: matched.length ? lead.simple : `This passage belongs to the "${lead.title}" part of the lesson. ${lead.simple}`,
    example: lead.example(p),
  };
}

export function unpackPassage(passage: Passage, p: NeuronParams) {
  const base = explainPassage(passage, p);
  const lead = base.concepts[0] ?? null;
  const terms = base.concepts.flatMap((c) => c.terms);
  return {
    ...base,
    lead,
    meaning: lead?.meaning ?? base.simple,
    terms,
    steps: lead?.steps ?? [],
    formula: lead?.formula,
    inspectStep: lead?.inspectStep,
  };
}
