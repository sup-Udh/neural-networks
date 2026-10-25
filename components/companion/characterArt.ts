import type { CompanionId } from "./companionTypes";

/*
 * Canonical pixel art for the two companions, hand-drawn as ASCII parts on a 24 x 36 grid.
 *
 *   rune = the dark knight (helmet with red plume, gold visor, shield, sword)
 *   sol  = the green adventurer (blond hair, tunic, belt, torch)
 *
 * The same parts feed the picker, the world map and the lesson companion, so the three can never drift.
 * A "." is transparent. Every row of a part must be the same width; parts are centred on the grid.
 */

export const GRID_W = 24;
export const GRID_H = 36;

export type Rows = readonly string[];

export interface ArmSet {
  /** Viewer-left arm in each pose. All variants are the same width so they can swap in place. */
  down: Rows;
  up: Rows;
  forward: Rows;
  /** Optional alternate for the swing of a walk step. */
  swing?: Rows;
}

export interface LegSet {
  stand: Rows;
  /** Hanging / dangling legs, used when sitting and hanging (wider spread, boots swing). */
  dangle: Rows;
  /** Legs tucked up for jumping. */
  tuck: Rows;
}

export interface CharacterArt {
  id: CompanionId;
  name: string;
  palette: Record<string, string>;
  head: Rows;
  torso: Rows;
  legs: LegSet;
  armL: ArmSet;
  armR: ArmSet;
  /** Held items drawn over the arms in the default pose. */
  heldL?: Rows;
  heldR?: Rows;
  /** Frames for an animated held prop (the adventurer's torch flame). */
  flame?: readonly Rows[];
  /** Horizontal offsets (left edge, in grid columns) for the side parts. */
  armLX: number;
  armRX: number;
  heldLX?: number;
  heldRX?: number;
  /** Top row of each held item in the default pose. */
  heldLY?: number;
  heldRY?: number;
  /** Row where `torso` starts when standing. Head sits directly above, legs below. */
  torsoY: number;
  headY: number;
  legsY: number;
}

const KNIGHT_PALETTE: Record<string, string> = {
  K: "#2a1f1a", r: "#d8412a", R: "#9c2a1c",
  d: "#464b54", m: "#6c727b", l: "#9b9890", h: "#d4cdb9",
  g: "#e4a72f", G: "#b87a1c",
  b: "#a95a20", B: "#7a3d16", o: "#cc7a30",
  s: "#d3d9de", S: "#8c949c",
};

const ADVENTURER_PALETTE: Record<string, string> = {
  K: "#2a1b14",
  Y: "#e8b44a", y: "#c98a2e", Z: "#f4cf70",
  f: "#f3bb90", F: "#d9955f",
  G: "#6e8c40", g: "#4d6a2c", L: "#8fab55",
  B: "#7b4a22", u: "#e7a92d",
  d: "#3b2b20", b: "#8d5527", c: "#5c3515",
  T: "#8b5a2b", t: "#5e3a1b",
  r: "#d63c22", o: "#f18b2b", e: "#f7d64c",
};

/* ----------------------------------------------------------------------------- Rune, the knight */

const RUNE: CharacterArt = {
  id: "rune",
  name: "Rune",
  palette: KNIGHT_PALETTE,
  head: [
    "...KKKK.....",
    "..KrrrrK....",
    ".KrrrrRRK...",
    ".KrRKKKKKK..",
    ".KlhhhllllK.",
    ".KlmmmmmmdK.",
    ".KmggggggdK.",
    ".KmKKgGKKdK.",
    ".KmKKgGKKdK.",
    ".KlmmgGmmdK.",
    ".KmmmgGmddK.",
    ".KmmmmmmddK.",
    "..KKKKKKKK..",
  ],
  torso: [
    "KKKKKKKKKK",
    "KlhhhhhhlK",
    "KmlhhhhlmK",
    "KdmllllmdK",
    "KdmmmmmmdK",
    "KBBBggBBBK",
    "KdddGGdddK",
    ".KKKKKKKK.",
  ],
  legs: {
    stand: [
      "KdmdKKdmdK",
      "KdmdKKdmdK",
      "KdmdKKdmdK",
      "KdmdKKdmdK",
      "KdmdKKdmdK",
      "KmmdKKmmdK",
      "KKKKKKKKKK",
      "KBbBKKBbBK",
      "KBbbKKbbBK",
      "KbooKKoobK",
      "KKKKKKKKKK",
    ],
    dangle: [
      "KddmmddmmddK",
      "KdmdK..KdmdK",
      "KdmdK..KdmdK",
      "KBbBK..KBbBK",
      "KbooK..KoobK",
      "KKKKK..KKKKK",
    ],
    tuck: [
      "KdmdKKdmdK",
      "KmmdKKmmdK",
      "KBbBKKBbBK",
      "KbooKKoobK",
      "KKKKKKKKKK",
    ],
  },
  armL: {
    down: [
      ".KKKK",
      "KhhlK",
      "KlmdK",
      "KKdmK",
      ".KdmK",
      ".KmdK",
      "KBbbK",
      "KbooK",
      "KBbbK",
      ".KKK.",
    ],
    up: [
      "KbooK",
      "KBbbK",
      "KKdmK",
      "KhhlK",
      "KlmdK",
      "KKdmK",
      ".KmdK",
      ".KKKK",
      ".....",
      ".....",
    ],
    forward: [
      ".KKKK",
      "KhhlK",
      "KlmdK",
      "KKdmK",
      "KKmdK",
      "KBbbK",
      "KbooK",
      "KBbbK",
      ".KKK.",
      ".....",
    ],
  },
  armR: {
    down: [
      "KKKK.",
      "KlhhK",
      "KdmlK",
      "KmdKK",
      "KmdK.",
      "KdmK.",
      "KbbBK",
      "KoobK",
      "KbbBK",
      ".KKK.",
    ],
    up: [
      "KbooK",
      "KBbbK",
      "KmdKK",
      "KlhhK",
      "KdmlK",
      "KmdKK",
      "KdmK.",
      "KKKK.",
      ".....",
      ".....",
    ],
    forward: [
      "KKKK.",
      "KlhhK",
      "KdmlK",
      "KmdKK",
      "KKmdK",
      "KbbBK",
      "KoobK",
      "KbbBK",
      ".KKK.",
      ".....",
    ],
  },
  heldL: [
    ".KK.",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "KsSK",
    "gGGg",
    ".bB.",
  ],
  heldR: [
    ".KKKKK",
    "KoooBK",
    "KobbBK",
    "KobbBK",
    "KobbBK",
    "KobbBK",
    "KobbBK",
    "KobbBK",
    "KobbBK",
    ".KobK.",
    "..KK..",
  ],
  armLX: 3,
  armRX: 16,
  heldLX: 0,
  heldRX: 18,
  heldLY: 12,
  heldRY: 18,
  headY: 4,
  torsoY: 17,
  legsY: 25,
};

/* ----------------------------------------------------------------------------- Sol, the adventurer */

const SOL: CharacterArt = {
  id: "sol",
  name: "Sol",
  palette: ADVENTURER_PALETTE,
  head: [
    "..KKKKKKKK..",
    ".KYYZZZYYYK.",
    "KYZZYYYYyYYK",
    "KYZYYyYYYYYK",
    "KYyYYYYYYyYK",
    "KYyffffffyYK",
    "KYfKffffKfYK",
    "KYfKffffKfYK",
    "KyffffFFffyK",
    ".KfffFFfffK.",
    "..KKffffKK..",
    "....KKKK....",
  ],
  torso: [
    "KKGGffGGKK",
    "KGLLGGGgGK",
    "KGGGGGGGGK",
    "KBBBBuuBBK",
    "KGGGGGGGGK",
    "KgGGGGGGgK",
    "KKGGGGGGKK",
    ".KKKKKKKK.",
  ],
  legs: {
    stand: [
      "KdddKKdddK",
      "KdddKKdddK",
      "KdddKKdddK",
      "KbbbKKbbbK",
      "KcbbKKbbcK",
      "KccbKKbccK",
      "KKKKKKKKKK",
    ],
    dangle: [
      "KddddddddddK",
      "KdddK..KdddK",
      "KbbbK..KbbbK",
      "KccbK..KbccK",
      "KKKKK..KKKKK",
    ],
    tuck: [
      "KdddKKdddK",
      "KbbbKKbbbK",
      "KccbKKbccK",
      "KKKKKKKKKK",
    ],
  },
  armL: {
    down: [
      ".KKK",
      "KLGg",
      "KGgK",
      "KffK",
      "KffK",
      "KfFK",
      ".KK.",
    ],
    up: [
      "KffK",
      "KffK",
      "KGgK",
      "KLGg",
      "KGgK",
      ".KK.",
      "....",
    ],
    forward: [
      ".KKK",
      "KLGg",
      "KGgK",
      "KKff",
      ".KfK",
      "..KK",
      "....",
    ],
  },
  armR: {
    down: [
      "KKK.",
      "gGLK",
      "KgGK",
      "KffK",
      "KffK",
      "KFfK",
      ".KK.",
    ],
    up: [
      "KffK",
      "KffK",
      "KgGK",
      "gGLK",
      "KgGK",
      ".KK.",
      "....",
    ],
    forward: [
      "KKK.",
      "gGLK",
      "KgGK",
      "ffKK",
      "KfK.",
      "KK..",
      "....",
    ],
  },
  /* The torch is held by the viewer-right hand: 4 wide, flame on top, stick below. */
  heldR: [
    "KTTK",
    "KTtK",
    "KTtK",
    "KTtK",
    "KTtK",
    "KTtK",
    "KTtK",
    "KTtK",
    ".KK.",
  ],
  flame: [
    [
      "..e.",
      ".eoK",
      "eoor",
      "oerr",
      ".orK",
    ],
    [
      ".e..",
      "eooK",
      "oeor",
      "reor",
      ".orK",
    ],
    [
      "..e.",
      ".oeK",
      "eeor",
      "oorr",
      ".rrK",
    ],
  ],
  armLX: 4,
  armRX: 16,
  heldRX: 18,
  heldRY: 15,
  headY: 9,
  torsoY: 21,
  legsY: 29,
};

export const ART: Record<CompanionId, CharacterArt> = { rune: RUNE, sol: SOL };

/** Check that every part is rectangular, so a typo in the art fails loudly instead of skewing a sprite. */
export function validateArt(art: CharacterArt): string[] {
  const problems: string[] = [];
  const check = (label: string, rows: Rows | undefined) => {
    if (!rows || rows.length === 0) return;
    const width = rows[0].length;
    rows.forEach((row, i) => {
      if (row.length !== width) problems.push(`${art.id}.${label} row ${i} is ${row.length} wide, expected ${width}`);
      for (const ch of row) if (ch !== "." && !(ch in art.palette)) problems.push(`${art.id}.${label} row ${i} uses unknown colour "${ch}"`);
    });
  };
  check("head", art.head);
  check("torso", art.torso);
  check("legs.stand", art.legs.stand);
  check("legs.dangle", art.legs.dangle);
  check("legs.tuck", art.legs.tuck);
  for (const side of ["armL", "armR"] as const) {
    for (const pose of ["down", "up", "forward"] as const) check(`${side}.${pose}`, art[side][pose]);
  }
  check("heldL", art.heldL);
  check("heldR", art.heldR);
  art.flame?.forEach((rows, i) => check(`flame[${i}]`, rows));
  return problems;
}
