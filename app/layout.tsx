import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const interTight = localFont({
  src: [
    { path: "../public/fonts/inter-tight-regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/inter-tight-semibold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/inter-tight-bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuralArc — Learn Neural Networks by Building",
  description:
    "Explore neural networks through interactive visualizations, hands-on coding, and AI-powered arcade experiments.",
  openGraph: {
    title: "NeuralArc — Learn Neural Networks by Building",
    description:
      "Explore neural networks through interactive visualizations, hands-on coding, and AI-powered arcade experiments.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#101114" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
