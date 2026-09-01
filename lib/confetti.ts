"use client";

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  s: number;
  rot: number;
  vr: number;
  col: string;
  life: number;
}

let parts: Part[] = [];
let raf: number | null = null;

function canvas(): HTMLCanvasElement | null {
  const el = document.getElementById("fx") as HTMLCanvasElement | null;
  if (el) {
    el.width = el.clientWidth;
    el.height = el.clientHeight;
  }
  return el;
}

function palColors(): string[] {
  const cs = getComputedStyle(document.documentElement);
  return ["--accent", "--good", "--warn", "--crit"]
    .map((v) => cs.getPropertyValue(v).trim())
    .filter(Boolean);
}

function tick(cv: HTMLCanvasElement) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.life--;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
    ctx.fillStyle = p.col;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
    ctx.restore();
  }
  if (parts.length) raf = requestAnimationFrame(() => tick(cv));
  else {
    raf = null;
    ctx.clearRect(0, 0, cv.width, cv.height);
  }
}

export function burst(x: number, y: number, count = 26) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = canvas();
  if (!cv) return;
  const cols = palColors();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 5;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 3,
      g: 0.16 + Math.random() * 0.1,
      s: 4 + Math.random() * 4,
      rot: Math.random() * 6,
      vr: -0.3 + Math.random() * 0.6,
      col: cols[i % cols.length] || "#888",
      life: 60 + Math.random() * 30,
    });
  }
  if (!raf) raf = requestAnimationFrame(() => tick(cv));
}

/** Fire from a DOM element's centre. */
export function burstFrom(el: Element, count?: number) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, count);
}
