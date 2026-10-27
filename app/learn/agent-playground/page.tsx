import type { Metadata } from "next";
import MarioLab from "@/components/mario/MarioLab";
import "./agent-playground.css";

export const metadata: Metadata = {
  title: "Agent Playground — NeuralArc",
  description: "Play Mario, then let an editable neural network or your own policy code control it.",
};

export default function AgentPlaygroundPage() {
  return (
    <main className="agent-playground">
      <div className="agent-playground__intro">
        <p>Agent Frontier / Playground</p>
        <h1>Mario Lab</h1>
        <span>Human mode: arrow keys move, X jumps, Z runs. Switch the controller to hand Mario to a neural network.</span>
      </div>
      <MarioLab />
    </main>
  );
}
