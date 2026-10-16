import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import type { Theme, Tone } from "../theme/themes";

/* ------------------------------------------------------------------ *
 * Builds hand-drawn shapes as plain path data. rough.js does the math,
 * React renders the <path> elements – so strokes can be animated and
 * exported to PNG/PDF. Every shape gets a fixed seed: same data →
 * same sketch.
 * ------------------------------------------------------------------ */

export interface Stroke {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  /** Position in the draw animation */
  order: number;
}

export interface ShapeOpts {
  /** Pastel fill with matching outline */
  tone?: Tone;
  /** Theme color name ("paper", "surface", …) or any CSS color */
  fill?: string;
  /** Theme color name, tone name or CSS color; default: ink (or the tone's outline) */
  stroke?: string;
  strokeWidth?: number;
  fillStyle?: Options["fillStyle"];
  roughness?: number;
  /** Same animation step as the previous shape */
  sameStep?: boolean;
}

const gen = rough.generator();
type Drawable = ReturnType<typeof gen.line>;

/** Simple string hash for reproducible seeds. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 2 ** 30;
}

export class SketchBuilder {
  readonly strokes: Stroke[] = [];
  private seed: number;
  private step = -1;

  constructor(
    readonly theme: Theme,
    seedKey: string,
  ) {
    this.seed = hashSeed(seedKey) || 1;
  }

  get steps() {
    return this.step + 1;
  }

  /** Starts a new animation step; shapes with sameStep follow at the same time. */
  nextStep() {
    this.step++;
  }

  tone(i: number): Tone {
    const order = this.theme.toneOrder;
    return order[((i % order.length) + order.length) % order.length];
  }

  /** Theme color ("ink", "ink-soft", "paper" …), tone name (its outline) or CSS color. */
  color(c: string | undefined): string | undefined {
    if (!c) return undefined;
    if (c in this.theme.tones) return this.theme.tones[c as Tone].stroke;
    const key = c.replace(/-([a-z])/g, (_m, l: string) => l.toUpperCase());
    return key in this.theme.colors ? this.theme.colors[key as keyof Theme["colors"]] : c;
  }

  private options(o: ShapeOpts = {}): Options {
    const r = this.theme.rough;
    const tone = o.tone ? this.theme.tones[o.tone] : undefined;
    const fill = tone?.fill ?? (o.fill ? (o.fill in this.theme.colors ? this.color(o.fill) : o.fill) : undefined);
    return {
      seed: (this.seed = (this.seed * 48271) % 2147483647),
      roughness: o.roughness ?? r.roughness,
      bowing: r.bowing,
      stroke: o.stroke ? this.color(o.stroke)! : (tone?.stroke ?? this.theme.colors.ink),
      strokeWidth: o.strokeWidth ?? r.strokeWidth,
      fill,
      fillStyle: o.fillStyle ?? (o.tone ? r.fillStyle : "solid"),
      fillWeight: r.fillWeight,
      hachureGap: r.hachureGap,
      hachureAngle: -41,
      disableMultiStroke: !r.doubleStroke,
      disableMultiStrokeFill: true,
    };
  }

  private push(drawable: Drawable, o: ShapeOpts = {}) {
    if (!o.sameStep || this.step < 0) this.step++;
    for (const p of gen.toPaths(drawable)) {
      this.strokes.push({ d: p.d, stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill ?? "none", order: this.step });
    }
  }

  rect(x: number, y: number, w: number, h: number, o: ShapeOpts = {}) {
    this.push(gen.rectangle(x, y, w, h, this.options(o)), o);
  }

  /** Rectangle with rounded corners. */
  roundRect(x: number, y: number, w: number, h: number, r: number, o: ShapeOpts = {}) {
    this.push(gen.path(roundRectPath(x, y, w, h, r), this.options(o)), o);
  }

  /** Pill / tag shape. */
  pill(x: number, y: number, w: number, h: number, o: ShapeOpts = {}) {
    this.roundRect(x, y, w, h, h / 2, o);
  }

  ellipse(cx: number, cy: number, w: number, h: number, o: ShapeOpts = {}) {
    this.push(gen.ellipse(cx, cy, w, h, this.options(o)), o);
  }

  circle(cx: number, cy: number, d: number, o: ShapeOpts = {}) {
    this.ellipse(cx, cy, d, d, o);
  }

  line(x1: number, y1: number, x2: number, y2: number, o: ShapeOpts = {}) {
    this.push(gen.line(x1, y1, x2, y2, this.options(o)), o);
  }

  polyline(points: [number, number][], o: ShapeOpts = {}) {
    this.push(gen.linearPath(points, this.options(o)), o);
  }

  polygon(points: [number, number][], o: ShapeOpts = {}) {
    this.push(gen.polygon(points, this.options(o)), o);
  }

  curve(points: [number, number][], o: ShapeOpts = {}) {
    this.push(gen.curve(points, this.options(o)), o);
  }

  path(d: string, o: ShapeOpts = {}) {
    this.push(gen.path(d, this.options(o)), o);
  }

  /** Slightly curved arrow with an open head. */
  arrow(x1: number, y1: number, x2: number, y2: number, o: ShapeOpts & { bend?: number; head?: number; both?: boolean } = {}) {
    const bend = o.bend ?? 0.06;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const cx = (x1 + x2) / 2 + (-(y2 - y1) / len) * len * bend;
    const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * len * bend;
    this.path(`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, { roughness: 0.6, ...o });
    const head = (tx: number, ty: number, fx: number, fy: number) => {
      const a = Math.atan2(ty - fy, tx - fx);
      const s = o.head ?? 13;
      this.polyline(
        [
          [tx - s * Math.cos(a - 0.5), ty - s * Math.sin(a - 0.5)],
          [tx, ty],
          [tx - s * Math.cos(a + 0.5), ty - s * Math.sin(a + 0.5)],
        ],
        { roughness: 0.4, ...o, sameStep: true },
      );
    };
    head(x2, y2, cx, cy);
    if (o.both) head(x1, y1, cx, cy);
  }

  /** Hand-drawn underline: one thin, gently curved stroke. */
  underline(x: number, y: number, w: number, color: string) {
    this.curve(
      [
        [x - 6, y + 1],
        [x + w * 0.3, y - 2],
        [x + w * 0.65, y + 2],
        [x + w + 8, y - 1],
      ],
      { stroke: color, strokeWidth: 2.6, roughness: 0.5 },
    );
  }

  /** Small four-pointed sparkle. */
  sparkle(cx: number, cy: number, size: number, o: ShapeOpts = {}) {
    const s = size / 2;
    const d = `M ${cx} ${cy - s} Q ${cx + s * 0.15} ${cy - s * 0.15} ${cx + s} ${cy} Q ${cx + s * 0.15} ${cy + s * 0.15} ${cx} ${cy + s} Q ${cx - s * 0.15} ${cy + s * 0.15} ${cx - s} ${cy} Q ${cx - s * 0.15} ${cy - s * 0.15} ${cx} ${cy - s} Z`;
    this.path(d, { roughness: 0.3, strokeWidth: 1.6, ...o });
  }

  /** Check mark. */
  check(cx: number, cy: number, size: number, o: ShapeOpts = {}) {
    const s = size / 2;
    this.polyline(
      [
        [cx - s * 0.8, cy],
        [cx - s * 0.25, cy + s * 0.55],
        [cx + s * 0.9, cy - s * 0.75],
      ],
      { strokeWidth: 2.4, roughness: 0.5, ...o },
    );
  }

  /** Small cross. */
  cross(cx: number, cy: number, size: number, o: ShapeOpts = {}) {
    const s = size / 2;
    this.line(cx - s, cy - s, cx + s, cy + s, { roughness: 0.5, ...o });
    this.line(cx + s, cy - s, cx - s, cy + s, { roughness: 0.5, ...o, sameStep: true });
  }

  /** Warning triangle with exclamation mark. */
  warning(cx: number, cy: number, size: number, o: ShapeOpts = {}) {
    const s = size / 2;
    this.polygon(
      [
        [cx, cy - s],
        [cx + s * 1.05, cy + s * 0.85],
        [cx - s * 1.05, cy + s * 0.85],
      ],
      { tone: "yellow", stroke: "ink", ...o },
    );
    this.line(cx, cy - s * 0.35, cx, cy + s * 0.25, { ...o, sameStep: true, roughness: 0.3 });
    this.circle(cx, cy + s * 0.55, s * 0.1, { ...o, sameStep: true, fill: this.theme.colors.ink });
  }

  /** Speech bubble with a small tail at the bottom left. */
  bubble(x: number, y: number, w: number, h: number, o: ShapeOpts = {}) {
    const r = Math.min(14, h / 3);
    const t = x + 34;
    const d = [
      `M ${x + r} ${y}`,
      `L ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h - r}`,
      `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
      `L ${t + 22} ${y + h}`,
      `L ${t - 4} ${y + h + 16}`,
      `L ${t + 4} ${y + h}`,
      `L ${x + r} ${y + h}`,
      `Q ${x} ${y + h} ${x} ${y + h - r}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      "Z",
    ].join(" ");
    this.path(d, o);
  }

  /** App window sketch: frame, title bar line and three dots. */
  window(x: number, y: number, w: number, h: number, o: ShapeOpts = {}) {
    this.roundRect(x, y, w, h, 8, { fill: "paper", ...o });
    this.line(x, y + 44, x + w, y + 44, { ...o, sameStep: true, roughness: 0.4 });
    for (let i = 0; i < 3; i++) this.circle(x + 20 + i * 18, y + 22, 9, { ...o, sameStep: true, strokeWidth: 1.3 });
  }
}

export function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/** Where a ray from the rectangle's center towards (towardX, towardY) leaves the rectangle. */
export function rectEdge(cx: number, cy: number, w: number, h: number, towardX: number, towardY: number): [number, number] {
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx === 0 ? Infinity : w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}
