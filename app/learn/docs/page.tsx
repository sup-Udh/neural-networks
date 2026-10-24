import type { Metadata } from "next";
import DocsShell from "@/components/docs/DocsShell";
import "./docs.css";

export const metadata: Metadata = {
  title: "Field Guide — NeuralArc",
  description: "A placeholder documentation page where your companion reads along with you.",
};

export default function DocsPage() {
  return <DocsShell />;
}
