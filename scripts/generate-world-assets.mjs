// Paints every world sprite to public/assets/world/** and writes a manifest the renderer reads.
//   node scripts/generate-world-assets.mjs            -> regenerate the PNGs and manifest.json
//   node scripts/generate-world-assets.mjs --sheet X  -> also write a contact sheet PNG to X
import sharp from "sharp";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { C, bridge, campfire, castle, caveMouth, crystals, cypressGrove, fenceSection, fieldChest, floweringBush, flowers, hayMound, houseGray, houseWhite, lantern, moundBush, mountain, mushroom, pine, pondFlowers, rock, rocksInWater, ruin, ruinPillar, sapling, sign, stoneTower, stump, tallGrass, tent, trainingTarget, treeRound, treeSmall } from "./world-art/sprites.mjs";
import { Raster } from "./world-art/raster.mjs";

const root = join(process.cwd(), "public/assets/world");
const apple = { light: "#8be8b4", mid: "#5ad88e", shade: "#34ad78", deep: "#1f8a68" };
const olive = { light: "#9aea7a", mid: "#6fd45e", shade: "#44ad50", deep: "#2c8a48" };

/** [folder, name, painter]. The name is what the map data refers to. */
const sprites = [
  ["vegetation", "tree-round-a", () => treeRound(11)],
  ["vegetation", "tree-round-b", () => treeRound(23)],
  ["vegetation", "tree-round-c", () => treeRound(37, olive)],
  ["vegetation", "tree-apple-a", () => treeRound(41, apple, true)],
  ["vegetation", "tree-apple-b", () => treeRound(53, apple, true)],
  ["vegetation", "tree-small-a", () => treeSmall(5)],
  ["vegetation", "tree-small-b", () => treeSmall(17)],
  ["vegetation", "pine-a", () => pine(3)],
  ["vegetation", "pine-b", () => pine(9, true)],
  ["vegetation", "cypress-grove-a", () => cypressGrove(7, 6)],
  ["vegetation", "cypress-grove-b", () => cypressGrove(19, 4)],
  ["vegetation", "mound-a", () => moundBush(2, 46, 26)],
  ["vegetation", "mound-b", () => moundBush(8, 38, 22)],
  ["vegetation", "mound-c", () => moundBush(14, 30, 18)],
  ["vegetation", "sapling", () => sapling()],
  ["vegetation", "flowering-bush", () => floweringBush(4)],
  ["vegetation", "tall-grass", () => tallGrass(6)],
  ["vegetation", "flowers-pink", () => flowers(3, C.pink)],
  ["vegetation", "flowers-white", () => flowers(9, C.flowerWhite)],
  ["vegetation", "flowers-yellow", () => flowers(15, C.yellow)],
  ["landmarks", "mountain-xl", () => mountain(5, 92, 88)],
  ["landmarks", "mountain-l", () => mountain(7, 74, 72)],
  ["landmarks", "mountain-m", () => mountain(12, 58, 56)],
  ["landmarks", "mountain-s", () => mountain(21, 44, 40)],
  ["landmarks", "cave-mouth", () => caveMouth()],
  ["landmarks", "stone-tower", () => stoneTower()],
  ["landmarks", "castle", () => castle()],
  ["landmarks", "ruin", () => ruin()],
  ["landmarks", "crystals", () => crystals()],
  ["structures", "house-gray-a", () => houseGray(1)],
  ["structures", "house-gray-b", () => houseGray(2)],
  ["structures", "house-white", () => houseWhite(false)],
  ["structures", "house-white-flip", () => houseWhite(true)],
  ["structures", "bridge", () => bridge(38)],
  ["structures", "fence-section", () => fenceSection()],
  ["structures", "ruin-pillar", () => ruinPillar()],
  ["structures", "tent", () => tent()],
  ["props", "hay-mound-a", () => hayMound(1)],
  ["props", "hay-mound-b", () => hayMound(4)],
  ["props", "rock-a", () => rock(2)],
  ["props", "rock-b", () => rock(5, true)],
  ["props", "rocks-water", () => rocksInWater()],
  ["props", "sign", () => sign()],
  ["props", "lantern", () => lantern()],
  ["props", "campfire", () => campfire()],
  ["props", "stump", () => stump()],
  ["props", "mushroom", () => mushroom()],
  ["props", "field-chest", () => fieldChest()],
  ["props", "training-target", () => trainingTarget()],
  ["props", "pond-flowers", () => pondFlowers()],
];

await rm(root, { recursive: true, force: true });
const manifest = {};
const painted = [];
for (const [folder, name, paint] of sprites) {
  const { raster, foot } = paint();
  const dir = join(root, folder);
  await mkdir(dir, { recursive: true });
  await sharp(raster.toRgba(), { raw: { width: raster.w, height: raster.h, channels: 4 } }).png().toFile(join(dir, `${name}.png`));
  manifest[name] = { src: `/assets/world/${folder}/${name}.png`, w: raster.w, h: raster.h, footX: foot[0], footY: foot[1] };
  painted.push({ name, raster });
}
await writeFile(join(root, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`wrote ${sprites.length} sprites to ${root}`);

// A tileable strip of lawn for the character-selection stage, drawn from the same palette as the world.
{
  const tile = new Raster(32, 16);
  tile.rect(0, 0, 32, 16, C.grass);
  tile.rect(0, 0, 32, 1, "#2a6a35");
  for (const x of [3, 4, 9, 10, 18, 19, 25, 26, 30]) tile.px(x, 1, "#2a6a35");
  tile.rect(0, 2, 32, 1, C.grassLight);
  for (const [x, y] of [[5, 6], [17, 9], [26, 5], [11, 12], [29, 13], [2, 11]]) { tile.px(x, y, C.grassMark); tile.px(x + 1, y, C.grassMark); tile.px(x + 2, y, C.grassMark); tile.px(x + 1, y - 1, C.grassMark); }
  const dir = join(process.cwd(), "public/assets/characters/shared");
  await mkdir(dir, { recursive: true });
  await sharp(tile.toRgba(), { raw: { width: 32, height: 16, channels: 4 } }).png().toFile(join(dir, "ground-tile.png"));
}

const sheetAt = process.argv.indexOf("--sheet");
if (sheetAt > -1) {
  const scale = 3;
  const cols = 8;
  const cell = 120;
  const rows = Math.ceil(painted.length / cols);
  const sheet = new Raster(cols * cell, rows * cell);
  painted.forEach(({ raster }, i) => {
    const ox = (i % cols) * cell + 4;
    const oy = Math.floor(i / cols) * cell + 4;
    sheet.blit(raster, ox, oy);
  });
  const rgba = sheet.toRgba();
  for (let i = 0; i < sheet.w * sheet.h; i++) if (!rgba[i * 4 + 3]) { rgba[i * 4] = 143; rgba[i * 4 + 1] = 222; rgba[i * 4 + 2] = 94; rgba[i * 4 + 3] = 255; }
  await sharp(rgba, { raw: { width: sheet.w, height: sheet.h, channels: 4 } }).resize(sheet.w * 1, sheet.h * 1, { kernel: "nearest" }).png().toFile(process.argv[sheetAt + 1]);
  void scale;
}
