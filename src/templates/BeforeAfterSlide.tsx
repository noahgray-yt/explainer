import { Scene, useLayout } from "./Scene";
import type { TemplateProps } from "./types";

export function BeforeAfterSlide(props: TemplateProps<"before-after">) {
  const layout = useLayout(props, ({ b, text }, slide) => {
    const cols = [
      { side: slide.data.before, key: "before" as const, x: 230, color: "ink-soft" as const },
      { side: slide.data.after, key: "after" as const, x: 850, color: "accent" as const },
    ];
    const w = 520;
    const rows = Math.max(slide.data.before.points.length, slide.data.after.points.length, 1);
    b.line(800, 280, 800, 360 + rows * 92, { stroke: "ink-soft", strokeWidth: 1.4, roughness: 1 });

    for (const col of cols) {
      text({
        key: `${col.key}-h`,
        text: col.side.heading,
        path: ["data", col.key, "heading"],
        x: col.x,
        y: 270,
        w,
        h: 50,
        size: 34,
        min: 20,
        align: "center",
        color: col.color,
        multiline: false,
      });
      // Both columns start at the same height, like a table
      const rowH = 92;
      const top = 352;
      col.side.points.forEach((point, i) => {
        const cy = top + rowH * i + rowH / 2;
        if (col.key === "before") b.cross(col.x + 22, cy, 16, { stroke: "ink-soft", strokeWidth: 1.8 });
        else b.check(col.x + 22, cy, 30, { stroke: "green" });
        text({
          key: `${col.key}-${i}`,
          text: point,
          path: ["data", col.key, "points", i],
          x: col.x + 54,
          y: cy - rowH / 2 + 4,
          w: w - 60,
          h: rowH - 8,
          size: 30,
          min: 18,
          multiline: true,
        });
      });
    }
  });
  return <Scene layout={layout} props={props} />;
}
