export type LandmarkState = "available" | "completed" | "upcoming";
export const WORLD = { width: 1800, height: 1120 } as const;
export const REGIONS = [
  { id: "grove", number: "01", name: "Neuron Grove", x: 280, y: 300, color: "#8abe5a", description: "Every network starts somewhere. Meet the tiny building block that turns inputs into useful outputs.", topics: ["Inputs", "Weights", "Bias", "Activation"], lessonIds: ["neuron-basics"], type: "hut" },
  { id: "caves", number: "02", name: "Activation Caves", x: 650, y: 505, color: "#8e7bd0", description: "Explore the caves where activation functions shape a neuron's response.", topics: ["Identity", "ReLU", "Sigmoid", "Curves"], lessonIds: [], type: "cave" },
  { id: "foundry", number: "03", name: "Network Foundry", x: 1000, y: 280, color: "#be985a", description: "A workshop for connecting neurons into layers and complete networks.", topics: ["Layers", "Forward propagation", "Architecture"], lessonIds: [], type: "foundry" },
  { id: "training", number: "04", name: "Training Grounds", x: 1290, y: 590, color: "#78a967", description: "Practice how models learn from examples, errors, and repeated adjustments.", topics: ["Training data", "Loss", "Gradient descent", "Backpropagation"], lessonIds: [], type: "windmill" },
  { id: "frontier", number: "05", name: "Agent Frontier", x: 1580, y: 340, color: "#78a8b0", description: "Follow the trail toward a future challenge: putting a model to work in the world.", topics: ["Model decisions", "Agent inputs", "Evaluation"], lessonIds: [], type: "outpost" },
] as const;
export const WAYPOINTS: Record<string, { x: number; y: number }[]> = {
  grove: [{x:280,y:340}], caves: [{x:405,y:365},{x:500,y:435},{x:650,y:505}], foundry: [{x:720,y:500},{x:820,y:420},{x:920,y:340},{x:1000,y:315}], training: [{x:1080,y:330},{x:1160,y:410},{x:1220,y:500},{x:1290,y:625}], frontier: [{x:1370,y:610},{x:1450,y:520},{x:1520,y:430},{x:1580,y:375}],
};
