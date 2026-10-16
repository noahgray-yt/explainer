import { row } from "./helpers";
import { Scene, useLayout } from "./Scene";
import { FRAME, type TemplateProps } from "./types";

export function FlowSlide(props: TemplateProps<"flow">) {
  const layout = useLayout(props, ({ b, text }, slide) => {
    const steps = slide.data.steps;
    const n = Math.max(1, steps.length);
    // Shrinks to fit when a loaded deck has more steps than the model may produce
    const gap = n >= 5 ? 74 : 96;
    const boxW = Math.min(n >= 5 ? 196 : 220, (FRAME.body.w - (n - 1) * gap) / n);
    const boxH = 100;
    const boxY = 405;
    const xs = row(n, boxW, gap, FRAME.body.x, FRAME.body.w);

    steps.forEach((step, i) => {
      const x = xs[i];
      b.roundRect(x, boxY, boxW, boxH, 12, { tone: b.tone(i) });
      text({
        key: `l${i}`,
        text: step.label,
        path: ["data", "steps", i, "label"],
        x: x + 12,
        y: boxY + 10,
        w: boxW - 24,
        h: boxH - 20,
        size: 30,
        min: 18,
        align: "center",
        multiline: true,
        lineHeight: 1.1,
      });
      if (step.note.trim()) {
        text({
          key: `t${i}`,
          text: step.note,
          path: ["data", "steps", i, "note"],
          x: x - gap / 2 + 10,
          y: boxY + boxH + 16,
          w: boxW + gap - 20,
          h: 66,
          size: 22,
          min: 15,
          align: "center",
          valign: "top",
          color: "ink-soft",
          multiline: true,
        });
      }
      if (i < n - 1) {
        const y = boxY + boxH / 2;
        b.arrow(x + boxW + 12, y, x + boxW + gap - 12, y, { bend: i % 2 ? 0.08 : -0.08 });
      }
    });
  });
  return <Scene layout={layout} props={props} />;
}
