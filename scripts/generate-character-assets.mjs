// Exports the canonical Rune and Sol art as PNG sprite sheets, portraits and a documented animation registry.
//   node scripts/generate-character-assets.mjs
// The live app draws the same frames straight from components/companion (SVG and canvas), so these files are
// a stable export of that source, not a second copy to keep in sync by hand: re-run this script after editing the art.
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "neuralarc-art-"));
const entry = join(dir, "entry.ts");
const bundle = join(dir, "entry.mjs");
await writeFile(entry, `export * from ${JSON.stringify(resolve(root, "components/companion/companionAnimations.ts").replaceAll("\\", "/"))};
export { portraits } from ${JSON.stringify(resolve(root, "components/companion/spriteData.ts").replaceAll("\\", "/"))};
`);
execFileSync(process.execPath, [join(root, "node_modules/rolldown/bin/cli.mjs"), entry, "--format", "esm", "--platform", "node", "-o", bundle], { stdio: "pipe" });
const { getAnimations, anchorRow, LOOPING, GRID_W, GRID_H, portraits } = await import(pathToFileURL(bundle).href);

const STATES = ["idle", "walk", "jump", "inspect", "hang", "sit", "work", "celebrate"];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function paint(buffer, width, pixels, ox, oy) {
  for (const [x, y, w, h, color] of pixels) {
    const [r, g, b] = rgb(color);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = ((oy + yy) * width + ox + xx) * 4;
      buffer[i] = r; buffer[i + 1] = g; buffer[i + 2] = b; buffer[i + 3] = 255;
    }
  }
}

for (const id of ["rune", "sol"]) {
  const out = join(root, "public/assets/characters", id);
  await mkdir(out, { recursive: true });
  const animations = getAnimations(id);
  const columns = Math.max(...STATES.map((s) => animations[s].length));
  const width = columns * GRID_W;
  const height = STATES.length * GRID_H;
  const sheet = Buffer.alloc(width * height * 4);
  const registry = {
    character: id,
    design: id === "rune" ? "dark knight: red plume, gold visor, shield and sword" : "blond adventurer: green tunic, brown belt and boots, torch",
    frame: { width: GRID_W, height: GRID_H, anchor: "bottom centre (feet) unless an animation says otherwise", transparentPadding: true },
    facing: "front-facing; mirrored horizontally for left/right travel",
    sheet: { file: "sheet.png", columns, rows: STATES.length, rowOrder: STATES },
    animations: {},
  };
  STATES.forEach((state, row) => {
    const frames = animations[state];
    frames.forEach((frame, col) => paint(sheet, width, frame.pixels, col * GRID_W, row * GRID_H));
    registry.animations[state] = {
      row,
      frames: frames.length,
      frameDurationsMs: frames.map((f) => f.ms),
      loop: LOOPING[state],
      anchorRow: anchorRow(id, state),
    };
  });
  await sharp(sheet, { raw: { width, height, channels: 4 } }).png().toFile(join(out, "sheet.png"));

  const idle = Buffer.alloc(GRID_W * GRID_H * 4);
  paint(idle, GRID_W, animations.idle[0].pixels, 0, 0);
  await sharp(idle, { raw: { width: GRID_W, height: GRID_H, channels: 4 } }).png().toFile(join(out, "idle.png"));

  const p = portraits[id];
  const portrait = Buffer.alloc(p.width * p.height * 4);
  paint(portrait, p.width, p.pixels, 0, 0);
  await sharp(portrait, { raw: { width: p.width, height: p.height, channels: 4 } }).png().toFile(join(out, "portrait.png"));
  registry.portrait = { file: "portrait.png", width: p.width, height: p.height };
  await writeFile(join(out, "animations.json"), JSON.stringify(registry, null, 1));
}
console.log("wrote character sprite sheets to public/assets/characters");
