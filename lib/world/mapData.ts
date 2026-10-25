export const TILE = 16;
export const GRID = { columns: 80, rows: 56 } as const;
export const WORLD = { width: GRID.columns * TILE, height: GRID.rows * TILE } as const;

export type RegionId = "grove" | "caves" | "foundry" | "training" | "frontier";
export interface Region {
  id: RegionId;
  number: string;
  name: string;
  x: number;
  y: number;
  description: string;
  topics: readonly string[];
  lessonIds: readonly string[];
  type: "field-station" | "cave" | "foundry" | "training" | "tower";
}

export const REGIONS: readonly Region[] = [
  { id: "grove", number: "01", name: "Neuron Grove", x: 11 * TILE, y: 21 * TILE, description: "Every network starts somewhere. Meet the small building block that turns inputs into useful outputs.", topics: ["Inputs", "Weights", "Bias", "Activation"], lessonIds: ["neuron-basics"], type: "field-station" },
  { id: "caves", number: "02", name: "Activation Caves", x: 32 * TILE, y: 14 * TILE, description: "Follow the crystals into the hills and see how activation functions shape a neuron's response.", topics: ["Identity", "ReLU", "Sigmoid", "Curves"], lessonIds: [], type: "cave" },
  { id: "foundry", number: "03", name: "Network Foundry", x: 48 * TILE, y: 34 * TILE, description: "A timber and stone workshop for connecting neurons into layers and complete networks.", topics: ["Layers", "Connections", "Architecture"], lessonIds: [], type: "foundry" },
  { id: "training", number: "04", name: "Training Grounds", x: 59 * TILE, y: 19 * TILE, description: "A quiet practice field for learning from examples, errors, and repeated adjustments.", topics: ["Training data", "Loss", "Gradient descent", "Backpropagation"], lessonIds: [], type: "training" },
  { id: "frontier", number: "05", name: "Agent Frontier", x: 72 * TILE, y: 36 * TILE, description: "The trail ends at a distant watchtower, where a trained model will one day make decisions of its own.", topics: ["Model decisions", "Agent inputs", "Evaluation"], lessonIds: [], type: "tower" },
];

/** Routes use tile centers; the player stays on the authored trail. */
const pt = (x: number, y: number) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
export const ROUTE_TILES: readonly (readonly [number, number])[] = [
  [11, 21], [17, 21], [17, 17], [23, 17], [27, 17], [29, 14], [32, 14],
  [36, 14], [36, 22], [42, 22], [46, 26], [46, 31], [48, 34],
  [53, 34], [55, 30], [59, 30], [59, 23], [59, 19], [63, 19], [66, 23], [68, 28], [72, 32], [72, 36],
];
export const WAYPOINTS: Record<RegionId, readonly { x: number; y: number }[]> = {
  grove: [pt(11,21)], caves: [pt(29,14),pt(32,14)], foundry: [pt(46,31),pt(48,34)], training: [pt(59,23),pt(59,19)], frontier: [pt(72,32),pt(72,36)],
};

/** Hand-authored water centerline in tile coordinates. */
export const RIVER_TILES: readonly (readonly [number, number])[] = [
  [1,42],[8,40],[15,39],[20,36],[22,31],[23,25],[26,21],[31,18],[37,18],[41,21],[44,24],[48,25],[53,27],[59,27],[65,30],[70,32],[78,33],
];

/** Deliberate woodland silhouettes: bounds and spacing were laid out by hand. */
export const WOODLANDS = [
  { x: 2, y: 7, rx: 8, ry: 9 }, { x: 2, y: 25, rx: 8, ry: 11 },
  { x: 14, y: 5, rx: 8, ry: 6 }, { x: 18, y: 28, rx: 7, ry: 6 },
  { x: 37, y: 5, rx: 5, ry: 7 }, { x: 38, y: 32, rx: 6, ry: 8 },
  { x: 63, y: 5, rx: 9, ry: 6 }, { x: 65, y: 42, rx: 11, ry: 8 },
  { x: 30, y: 40, rx: 8, ry: 5 }, { x: 8, y: 48, rx: 6, ry: 5 },
] as const;
