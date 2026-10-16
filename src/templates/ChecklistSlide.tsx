import { Scene, useLayout } from "./Scene";
import { FRAME, type TemplateProps } from "./types";

export function ChecklistSlide(props: TemplateProps<"checklist">) {
  const layout = useLayout(props, ({ b, text }, slide) => {
    const items = slide.data.items;
    const n = Math.max(1, items.length);
    const hasNotes = items.some((it) => it.note.trim());
    const rowH = Math.min(hasNotes ? 104 : 84, FRAME.body.h / n);
    const top = FRAME.body.y + (FRAME.body.h - n * rowH) / 2;
    const iconX = 400;
    items.forEach((item, i) => {
      const y = top + rowH * i;
      const iconY = y + (hasNotes ? 30 : rowH / 2);
      if (item.status === "warn") b.warning(iconX, iconY, 34);
      else b.check(iconX, iconY, 32, { stroke: "green" });
      text({
        key: `i${i}`,
        text: item.text,
        path: ["data", "items", i, "text"],
        x: 450,
        y: hasNotes ? y + 8 : y + 6,
        w: 820,
        h: hasNotes ? 44 : rowH - 12,
        size: 30,
        min: 18,
        valign: hasNotes ? "middle" : "middle",
        multiline: !hasNotes,
      });
      if (item.note.trim()) {
        text({
          key: `n${i}`,
          text: item.note,
          path: ["data", "items", i, "note"],
          x: 450,
          y: y + 52,
          w: 820,
          h: 36,
          size: 21,
          min: 14,
          valign: "top",
          color: "ink-soft",
          multiline: false,
        });
      }
    });
  });
  return <Scene layout={layout} props={props} />;
}
