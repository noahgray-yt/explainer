import { Scene, useLayout } from "./Scene";
import { FRAME, type TemplateProps } from "./types";

export function PromptListSlide(props: TemplateProps<"prompt-list">) {
  const layout = useLayout(props, ({ b, text }, slide) => {
    const prompts = slide.data.prompts;
    const n = Math.max(1, prompts.length);
    const gap = 30;
    const h = Math.min(74, (500 - (n - 1) * gap) / n);
    const top = FRAME.body.y + (FRAME.body.h - (n * h + (n - 1) * gap)) / 2;
    const x = 260;
    const w = 1080;
    prompts.forEach((p, i) => {
      const y = top + i * (h + gap);
      b.bubble(x, y, w, h, { tone: "blue", sameStep: i > 0 });
      text({ key: `p${i}`, text: p, path: ["data", "prompts", i], x: x + 26, y: y + 4, w: w - 52, h: h - 8, size: 26, min: 15, multiline: true, lineHeight: 1.12 });
    });
  });
  return <Scene layout={layout} props={props} />;
}
