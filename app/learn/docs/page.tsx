import type { Metadata } from "next";
import DocsShell from "@/components/docs/DocsShell";
import "./docs.css";
import "./lesson.css";

export const metadata: Metadata = {
  title: "Lesson 01: Your first neuron — NeuralArc",
  description: "An interactive field guide: build a single neuron, watch it compute, write it in code, and take notes with your companion.",
};

export default function DocsPage() {
  return <DocsShell />;
}
