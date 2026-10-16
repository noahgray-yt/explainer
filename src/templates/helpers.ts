import type { LayoutApi } from "./types";

/** Spreads n items of width w with spacing gap, centered in [x0, x0 + span]. */
export function row(n: number, w: number, gap: number, x0: number, span: number): number[] {
  const total = n * w + (n - 1) * gap;
  const start = x0 + (span - total) / 2;
  return Array.from({ length: n }, (_, i) => start + i * (w + gap));
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

/** A small pastel tag (pill) centered at (cx, cy), sized to its text. */
export function tag(
  api: LayoutApi,
  opts: { key: string; text: string; path?: (string | number)[]; cx: number; cy: number; size?: number; tone?: "yellow" | "blue" | "green" | "purple" | "pink" | "orange"; maxW?: number },
) {
  const size = opts.size ?? 24;
  const w = Math.min(opts.maxW ?? 520, Math.max(90, api.measure(opts.text, size) + 40));
  const h = size + 22;
  api.b.pill(opts.cx - w / 2, opts.cy - h / 2, w, h, { tone: opts.tone ?? "yellow" });
  api.text({
    key: opts.key,
    text: opts.text,
    path: opts.path,
    x: opts.cx - w / 2 + 14,
    y: opts.cy - h / 2 + 2,
    w: w - 28,
    h: h - 4,
    size,
    min: 14,
    align: "center",
    multiline: false,
  });
}
