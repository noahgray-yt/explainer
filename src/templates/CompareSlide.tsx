import { Scene, useLayout } from "./Scene";
import type { TemplateProps } from "./types";

export function CompareSlide(props: TemplateProps<"compare">) {
  const layout = useLayout(props, ({ b, text }, slide) => {
    const wins = [
      { win: slide.data.left, key: "left" as const, x: 180, tone: "purple" as const },
      { win: slide.data.right, key: "right" as const, x: 920, tone: "green" as const },
    ];
    const y = 280;
    const w = 500;
    const h = 320;
    for (const { win, key, x, tone } of wins) {
      b.window(x, y, w, h);
      text({ key: `${key}-h`, text: win.heading, path: ["data", key, "heading"], x: x + 78, y: y + 4, w: w - 96, h: 38, size: 22, min: 14, multiline: false });
      const n = Math.max(1, win.lines.length);
      const rowH = Math.min(78, (h - 80) / n);
      const top = y + 64 + (h - 80 - n * rowH) / 2;
      win.lines.forEach((line, i) => {
        const cy = top + rowH * i + rowH / 2;
        b.pill(x + 30, cy - 8, 34, 16, { tone, sameStep: true });
        text({ key: `${key}-${i}`, text: line, path: ["data", key, "lines", i], x: x + 80, y: cy - rowH / 2 + 4, w: w - 104, h: rowH - 8, size: 28, min: 16, multiline: true });
      });
      if (win.caption.trim()) {
        text({
          key: `${key}-c`,
          text: win.caption,
          path: ["data", key, "caption"],
          x,
          y: y + h + 12,
          w,
          h: 36,
          size: 22,
          min: 14,
          align: "center",
          color: "ink-soft",
          multiline: false,
        });
      }
    }
    b.arrow(706, 450, 894, 450, { bend: -0.1 });
    text({ key: "rel", text: slide.data.relation, path: ["data", "relation"], x: 690, y: 386, w: 220, h: 40, size: 24, min: 14, align: "center", color: "ink-soft", multiline: false });
  });
  return <Scene layout={layout} props={props} />;
}
