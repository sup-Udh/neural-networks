"use client";

import { useEffect, useRef } from "react";

type NodePoint = { x: number; y: number; vx: number; vy: number; phase: number; tone: number };
type Pulse = { from: number; to: number; progress: number; speed: number };

export default function NeuralBackground({ variant = "landing" }: { variant?: "landing" | "onboarding" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 600px)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    let nodes: NodePoint[] = [];
    let pulses: Pulse[] = [];
    let isVisible = !document.hidden;
    let motionAllowed = !reducedMotion.matches;

    const createNodes = () => {
      const density = mobileQuery.matches ? 0.000033 : width < 900 ? 0.000055 : 0.000062;
      const count = variant === "onboarding"
        ? mobileQuery.matches ? 26 : 40
        : Math.max(mobileQuery.matches ? 22 : 40, Math.min(mobileQuery.matches ? 32 : 86, Math.round(width * height * density)));
      nodes = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.17,
        vy: (Math.random() - 0.5) * 0.17,
        phase: Math.random() * Math.PI * 2,
        tone: index % 19 === 0 ? 2 : index % 5 === 0 ? 1 : 0,
      }));
      pulses = Array.from({ length: 3 }, () => ({
        from: Math.floor(Math.random() * count),
        to: Math.floor(Math.random() * count),
        progress: Math.random(),
        speed: 0.00012 + Math.random() * 0.00008,
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      createNodes();
    };

    const animate = (time: number) => {
      frame = window.requestAnimationFrame(animate);
      if (!isVisible || !motionAllowed) return;
      const delta = Math.min(time - (lastTime || time), 40);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      const distance = variant === "onboarding" ? (mobileQuery.matches ? 94 : 120) : mobileQuery.matches ? 100 : 142;
      const distanceSquared = distance * distance;

      for (const node of nodes) {
        node.x += node.vx * delta;
        node.y += node.vy * delta;
        node.phase += delta * 0.0007;
        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node) continue;
        for (let j = i + 1; j < nodes.length; j += 1) {
          const other = nodes[j];
          if (!other) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < distanceSquared) {
            const opacity = 0.14 * (1 - Math.sqrt(d2) / distance);
            context.strokeStyle = `rgba(75,96,127,${opacity})`;
            context.lineWidth = 0.7;
            context.beginPath();
            context.moveTo(node.x, node.y);
            context.lineTo(other.x, other.y);
            context.stroke();
          }
        }
      }

      for (const pulse of pulses) {
        const start = nodes[pulse.from];
        const end = nodes[pulse.to];
        if (!start || !end) continue;
        pulse.progress += delta * pulse.speed;
        if (pulse.progress >= 1) {
          pulse.from = pulse.to;
          pulse.to = Math.floor(Math.random() * nodes.length);
          pulse.progress = 0;
        }
        const x = start.x + (end.x - start.x) * pulse.progress;
        const y = start.y + (end.y - start.y) * pulse.progress;
        context.fillStyle = "rgba(243,112,30,0.8)";
        context.beginPath();
        context.arc(x, y, 1.8, 0, Math.PI * 2);
        context.fill();
      }

      for (const node of nodes) {
        const radius = node.tone === 2 ? 2.3 : node.tone === 1 ? 1.8 : 1.2;
        const color = node.tone === 2 ? "243,112,30" : node.tone === 1 ? "232,216,201" : "75,96,127";
        const opacity = node.tone === 2 ? 0.67 + Math.sin(node.phase) * 0.12 : node.tone === 1 ? 0.42 : 0.52;
        context.fillStyle = `rgba(${color},${opacity})`;
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => { motionAllowed = !event.matches; };
    const onVisibilityChange = () => { isVisible = !document.hidden; };
    resize();
    frame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [variant]);

  return <canvas className="neural-background" ref={canvasRef} aria-hidden="true" />;
}
