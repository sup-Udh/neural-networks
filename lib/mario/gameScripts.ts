/** Legacy game scripts in the order they must load. Shared by the live wrapper and the headless evaluator. */
export const LEGACY_SCRIPTS = [
  "util.js", "input.js", "resources.js", "sprite.js", "entity.js", "pipe.js", "mushroom.js", "fireflower.js", "star.js",
  "fireball.js", "coin.js", "bcoin.js", "goomba.js", "koopa.js", "floor.js", "block.js", "rubble.js", "prop.js",
  "player.js", "flag.js", "levels/level.js", "levels/11.js", "levels/11tunnel.js", "game.js",
] as const;

export const SCRIPT_BASE = "/game/mario/js/";
