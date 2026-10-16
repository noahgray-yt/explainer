import type { IconName } from "../../shared/schema";
import type { Tone } from "../theme/themes";
import type { SketchBuilder } from "./builder";

/* ------------------------------------------------------------------ *
 * Small icon sketches. Coordinates live in a 100×100 box around (0,0);
 * drawIcon() scales them to `size` at (cx, cy). One shape per icon gets
 * the pastel tone, the rest are thin ink lines.
 * ------------------------------------------------------------------ */

type Pt = [number, number];

export function drawIcon(b: SketchBuilder, name: IconName, cx: number, cy: number, size: number, tone: Tone) {
  const k = size / 100;
  const P = (x: number, y: number): Pt => [cx + x * k, cy + y * k];
  const sw = Math.max(1.2, b.theme.rough.strokeWidth * Math.min(1, size / 70));
  const o = { strokeWidth: sw, sameStep: true, roughness: 0.6 };
  const fillO = { ...o, tone, stroke: "ink" };
  const L = (x1: number, y1: number, x2: number, y2: number) => b.line(...P(x1, y1), ...P(x2, y2), o);
  const C = (x: number, y: number, d: number, f = false) => b.circle(...P(x, y), d * k, f ? fillO : o);
  const R = (x: number, y: number, w: number, h: number, f = false) => b.rect(...P(x, y), w * k, h * k, f ? fillO : o);
  const poly = (pts: Pt[], f = false) => b.polygon(pts.map(([x, y]) => P(x, y)), f ? fillO : o);
  const pl = (pts: Pt[]) => b.polyline(pts.map(([x, y]) => P(x, y)), o);
  const path = (d: string, f = false) => b.path(scalePath(d, cx, cy, k), f ? fillO : o);

  // The whole icon appears in one animation step.
  b.nextStep();

  switch (name) {
    case "idea":
      C(0, -12, 62, true);
      R(-14, 22, 28, 18);
      L(-10, 46, 10, 46);
      L(0, -62, 0, -50);
      L(-44, -40, -36, -32);
      L(44, -40, 36, -32);
      break;
    case "gear": {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        L(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 46, Math.sin(a) * 46);
      }
      C(0, 0, 66, true);
      C(0, 0, 24);
      break;
    }
    case "document":
      poly(
        [
          [-32, -44],
          [16, -44],
          [32, -28],
          [32, 44],
          [-32, 44],
        ],
        true,
      );
      pl([
        [16, -44],
        [16, -28],
        [32, -28],
      ]);
      L(-20, -10, 20, -10);
      L(-20, 6, 20, 6);
      L(-20, 22, 8, 22);
      break;
    case "user":
      C(0, -22, 40, true);
      path("M -36 44 Q -36 6 0 6 Q 36 6 36 44 Z");
      break;
    case "users":
      C(-18, -20, 34, true);
      path("M -48 40 Q -48 6 -18 6 Q 12 6 12 40 Z");
      C(22, -14, 30);
      path("M 0 40 Q 0 12 22 12 Q 48 12 48 40");
      break;
    case "cloud":
      path("M -40 26 Q -54 26 -52 10 Q -50 -6 -32 -4 Q -30 -30 -4 -30 Q 22 -32 26 -8 Q 50 -12 50 10 Q 50 26 34 26 Z", true);
      break;
    case "database":
      b.ellipse(...P(0, -30), 72 * k, 24 * k, fillO);
      L(-36, -30, -36, 30);
      L(36, -30, 36, 30);
      path("M -36 0 Q 0 16 36 0");
      path("M -36 30 Q 0 46 36 30");
      break;
    case "lock":
      path("M -22 -6 L -22 -26 Q -22 -46 0 -46 Q 22 -46 22 -26 L 22 -6");
      R(-34, -6, 68, 52, true);
      C(0, 14, 12);
      L(0, 20, 0, 32);
      break;
    case "bolt":
      poly(
        [
          [8, -50],
          [-30, 6],
          [-2, 6],
          [-10, 50],
          [30, -8],
          [2, -8],
        ],
        true,
      );
      break;
    case "chart":
      pl([
        [-44, -44],
        [-44, 40],
        [46, 40],
      ]);
      R(-32, 10, 18, 30, true);
      R(-6, -12, 18, 52, true);
      R(20, -32, 18, 72, true);
      break;
    case "clock":
      C(0, 0, 90, true);
      L(0, 0, 0, -28);
      L(0, 0, 22, 12);
      break;
    case "globe":
      C(0, 0, 90, true);
      b.ellipse(...P(0, 0), 40 * k, 90 * k, o);
      L(-45, 0, 45, 0);
      path("M -38 -22 Q 0 -14 38 -22");
      path("M -38 22 Q 0 30 38 22");
      break;
    case "code":
      pl([
        [-20, -28],
        [-46, 0],
        [-20, 28],
      ]);
      pl([
        [20, -28],
        [46, 0],
        [20, 28],
      ]);
      L(8, -38, -8, 38);
      break;
    case "chat":
      path("M -44 -36 L 44 -36 L 44 18 L -6 18 L -26 40 L -24 18 L -44 18 Z", true);
      L(-28, -16, 28, -16);
      L(-28, 0, 14, 0);
      break;
    case "search":
      C(-10, -10, 60, true);
      L(12, 12, 42, 42);
      break;
    case "check":
      C(0, 0, 90, true);
      pl([
        [-24, 0],
        [-6, 20],
        [26, -20],
      ]);
      break;
    case "warning":
      poly(
        [
          [0, -46],
          [46, 40],
          [-46, 40],
        ],
        true,
      );
      L(0, -16, 0, 14);
      C(0, 26, 6);
      break;
    case "rocket":
      path("M 0 -50 Q 26 -26 20 24 L -20 24 Q -26 -26 0 -50 Z", true);
      C(0, -12, 18);
      poly([
        [-20, 6],
        [-38, 30],
        [-20, 24],
      ]);
      poly([
        [20, 6],
        [38, 30],
        [20, 24],
      ]);
      L(-8, 32, -12, 48);
      L(8, 32, 12, 48);
      break;
    case "folder":
      path("M -46 -30 L -14 -30 L -6 -20 L 46 -20 L 46 38 L -46 38 Z", true);
      L(-46, -8, 46, -8);
      break;
    case "mail":
      R(-46, -30, 92, 62, true);
      pl([
        [-46, -30],
        [0, 6],
        [46, -30],
      ]);
      break;
    case "heart":
      path("M 0 40 Q -50 6 -42 -20 Q -32 -46 0 -24 Q 32 -46 42 -20 Q 50 6 0 40 Z", true);
      break;
    case "star": {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 20 : 48;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      poly(pts, true);
      break;
    }
    case "puzzle":
      path(
        "M -36 -36 L -10 -36 Q -10 -50 2 -50 Q 14 -50 14 -36 L 36 -36 L 36 -10 Q 50 -10 50 2 Q 50 14 36 14 L 36 36 L -36 36 Z",
        true,
      );
      break;
    case "key":
      C(-24, 0, 40, true);
      L(-4, 0, 46, 0);
      L(30, 0, 30, 16);
      L(42, 0, 42, 12);
      break;
    case "terminal":
      R(-46, -36, 92, 72, true);
      pl([
        [-30, -14],
        [-14, 0],
        [-30, 14],
      ]);
      L(-6, 16, 24, 16);
      break;
    case "book":
      path("M 0 -30 Q -24 -42 -46 -32 L -46 34 Q -24 24 0 36 Z", true);
      path("M 0 -30 Q 24 -42 46 -32 L 46 34 Q 24 24 0 36 Z");
      break;
    case "money":
      R(-48, -28, 96, 56, true);
      C(0, 0, 32);
      L(-38, -18, -30, -18);
      L(30, 18, 38, 18);
      break;
    case "target":
      C(0, 0, 90, true);
      C(0, 0, 56);
      C(0, 0, 20);
      L(0, 0, 40, -40);
      pl([
        [28, -44],
        [40, -40],
        [44, -28],
      ]);
      break;
    case "link":
      path("M -6 -16 L 8 -30 Q 22 -44 36 -30 Q 50 -16 36 -2 L 22 12", true);
      path("M 6 16 L -8 30 Q -22 44 -36 30 Q -50 16 -36 2 L -22 -12");
      L(-14, 14, 14, -14);
      break;
    case "eye":
      path("M -48 0 Q 0 -44 48 0 Q 0 44 -48 0 Z", true);
      C(0, 0, 30);
      C(0, 0, 8);
      break;
  }
}

/** Scales/moves a path with absolute M/L/Q commands into the target box. */
function scalePath(d: string, cx: number, cy: number, k: number): string {
  return d.replace(/([MLQ])([^MLQZ]*)/g, (_m, cmd: string, args: string) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    return `${cmd} ${nums.map((n, i) => (i % 2 === 0 ? cx + n * k : cy + n * k)).join(" ")} `;
  });
}
