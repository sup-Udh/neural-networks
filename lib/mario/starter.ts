import { cloneModel } from "../nn/network";
import type { NetworkModel } from "../nn/network";
import { INPUT_SIZE } from "./observation";

/**
 * Starter network: 5 inputs → 5 hidden (relu) → 3 outputs (linear, one score per action in ACTIONS order).
 * These weights are HAND-SET, not trained. Reading them left to right:
 *  hidden 1 fires when an obstacle is closer than ~58 px   hidden 2 when a pit is closer than ~58 px
 *  hidden 3 fires when an enemy is closer than ~48 px      hidden 4 mirrors "grounded"   hidden 5 is a constant 1
 *  run  = 0.6 (constant)   jump = 4 × (obstacle + pit + enemy detectors)   wait = 0.1 (constant)
 * so Mario runs by default and jumps when something dangerous is near. Nothing here has learned from the game.
 */
const STARTER: NetworkModel = {
  inputSize: INPUT_SIZE,
  layers: [
    {
      activation: "relu",
      weights: [
        [2, 0, 0, 0, 0],
        [0, 2, 0, 0, 0],
        [0, 0, 2, 0, 0],
        [0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0],
      ],
      biases: [-0.4, -0.8, -1, 0, 1],
    },
    {
      activation: "linear",
      weights: [
        [0, 0, 0, 0, 0.6],
        [4, 4, 4, 0, 0],
        [0, 0, 0, 0, 0.1],
      ],
      biases: [0, 0, 0],
    },
  ],
};

export const STARTER_MODEL_ID = "starter-v1";
export const starterModel = (): NetworkModel => cloneModel(STARTER);

export const STARTER_POLICY_CODE = `// Policy code decides which action Mario takes. It does NOT change the network's weights.
// Edit weights and biases in the Parameters tab instead.
//
// decide(obs) runs in a Web Worker once per game frame and must return "run", "jump" or "wait".
//   obs.raw.obstacleDistancePx / pitDistancePx / enemyDistancePx   pixels, or null if nothing is in range
//   obs.raw.horizontalVelocity, obs.raw.verticalVelocity, obs.raw.isGrounded
//   obs.inputs   the 5 normalized network inputs
//   obs.scores   output scores [run, jump, wait] from the ACTIVE network (raw scores, not probabilities)
function decide(obs) {
  // Start from whatever the network prefers.
  const best = obs.scores.indexOf(Math.max(...obs.scores));
  const fromNetwork = ["run", "jump", "wait"][best];

  // Example override: never stand still.
  if (fromNetwork === "wait") return "run";
  return fromNetwork;
}
`;
