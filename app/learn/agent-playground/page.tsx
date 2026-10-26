import type { Metadata } from "next";
import MarioGame from "@/components/game/MarioGame";
import "./agent-playground.css";

export const metadata: Metadata = {
  title: "Agent Playground — NeuralArc",
  description: "Play a Canvas platform game before connecting it to a neural-network agent.",
};

export default function AgentPlaygroundPage() {
  return (
    <main className="agent-playground">
      <div className="agent-playground__intro">
        <p>Agent Frontier / Playground</p>
        <h1>Play the game first.</h1>
        <span>Arrow keys move. X jumps. Z runs.</span>
      </div>
      <MarioGame />
    </main>
  );
}
