import type { Metadata } from "next";
import WorldMap from "@/components/world/WorldMap";
import "./world.css";

export const metadata: Metadata = { title: "The Neural Frontier — NeuralArc", description: "Explore a living world as you learn neural networks." };

export default function WorldPage() { return <WorldMap />; }
