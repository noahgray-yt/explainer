import { tag } from "./helpers";
import { Scene, useLayout } from "./Scene";
import type { TemplateProps } from "./types";

export function StatSlide(props: TemplateProps<"stat">) {
  const layout = useLayout(props, (api, slide) => {
    const { b, text, measure } = api;
    const size = 160;
    const valueW = Math.min(1000, measure(slide.data.value, size));
    b.sparkle(800 + valueW / 2 + 40, 318, 34);
    text({
      key: "value",
      text: slide.data.value,
      path: ["data", "value"],
      x: 300,
      y: 290,
      w: 1000,
      h: 190,
      size,
      min: 60,
      align: "center",
      valign: "bottom",
      multiline: false,
      lineHeight: 1,
    });
    text({ key: "label", text: slide.data.label, path: ["data", "label"], x: 260, y: 492, w: 1080, h: 60, size: 36, min: 20, align: "center", multiline: true });
    if (slide.data.note.trim()) tag(api, { key: "note", text: slide.data.note, path: ["data", "note"], cx: 800, cy: 600, size: 22 });
  });
  return <Scene layout={layout} props={props} />;
}
