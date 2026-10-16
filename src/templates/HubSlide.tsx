import { rectEdge } from "../sketch/builder";
import { drawIcon } from "../sketch/icons";
import { Scene, useLayout } from "./Scene";
import type { TemplateProps } from "./types";

export function HubSlide(props: TemplateProps<"hub">) {
  const layout = useLayout(props, ({ b, text, measure }, slide) => {
    const nodes = slide.data.nodes;
    const n = Math.max(1, nodes.length);
    const cx = 800;
    const cy = 478;
    const cw = Math.min(320, Math.max(190, measure(slide.data.center, 30) + 64));
    const ch = 76;
    const rx = 480;
    const ry = 196;
    const nw = 260;
    const nh = 68;
    const start = n % 2 ? -90 : -90 + 180 / n;
    const pos = nodes.map((_, i) => {
      const a = ((start + (i * 360) / n) * Math.PI) / 180;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const;
    });

    b.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 14, { tone: "purple" });
    text({ key: "center", text: slide.data.center, path: ["data", "center"], x: cx - cw / 2 + 12, y: cy - ch / 2 + 6, w: cw - 24, h: ch - 12, size: 30, min: 16, align: "center", multiline: true, lineHeight: 1.05 });

    pos.forEach(([x, y], i) => {
      const [sx, sy] = rectEdge(cx, cy, cw + 18, ch + 18, x, y);
      const [ex, ey] = rectEdge(x, y, nw + 18, nh + 18, cx, cy);
      b.arrow(sx, sy, ex, ey, { bend: 0.04, head: 11, strokeWidth: 1.5, sameStep: i > 0 });
    });

    nodes.forEach((node, i) => {
      const [x, y] = pos[i];
      const left = x - nw / 2;
      const top = y - nh / 2;
      b.roundRect(left, top, nw, nh, 10, { fill: "paper" });
      drawIcon(b, node.icon, left + 38, y, 34, b.tone(i));
      text({ key: `n${i}`, text: node.label, path: ["data", "nodes", i, "label"], x: left + 66, y: top + 6, w: nw - 78, h: nh - 12, size: 26, min: 15, multiline: true, lineHeight: 1.05 });
    });
  });
  return <Scene layout={layout} props={props} />;
}
