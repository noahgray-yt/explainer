import { fmtNumber, row, tag } from "./helpers";
import { Scene, useLayout } from "./Scene";
import type { TemplateProps } from "./types";

export function BarsSlide(props: TemplateProps<"bars">) {
  const layout = useLayout(props, (api, slide) => {
    const { b, text } = api;
    const { bars, caption } = slide.data;
    const unit = slide.data.unit.trim();
    const n = Math.max(1, bars.length);
    const chartX = 220;
    const chartW = 700;
    const base = 640;
    const maxH = 290;
    const max = Math.max(...bars.map((x) => x.value), 0) || 1;
    const slot = chartW / n;
    const barW = Math.min(76, slot * 0.55);
    const xs = row(n, barW, slot - barW, chartX, chartW);

    if (caption.trim()) {
      text({ key: "cap", text: caption, path: ["data", "caption"], x: chartX - 10, y: 268, w: chartW, h: 34, size: 22, min: 15, color: "ink-soft", multiline: false });
    }
    b.line(chartX - 20, base, chartX + chartW + 20, base, { roughness: 0.4 });
    bars.forEach((bar, i) => {
      const h = Math.max(6, (bar.value / max) * maxH);
      const x = xs[i];
      b.rect(x, base - h, barW, h, { tone: "orange", sameStep: i > 0 });
      text({
        key: `v${i}`,
        text: `${fmtNumber(bar.value)}${unit ? (unit.length > 2 ? " " : "") + unit : ""}`,
        path: ["data", "bars", i, "value"],
        x: x - (slot - barW) / 2,
        y: base - h - 38,
        w: slot,
        h: 34,
        size: 22,
        min: 14,
        align: "center",
        valign: "bottom",
        multiline: false,
      });
      text({
        key: `l${i}`,
        text: bar.label,
        path: ["data", "bars", i, "label"],
        x: x - (slot - barW) / 2 + 4,
        y: base + 10,
        w: slot - 8,
        h: 56,
        size: 20,
        min: 14,
        align: "center",
        valign: "top",
        color: "ink-soft",
        multiline: true,
      });
    });

    // Big key figure on the right with a small tag
    text({
      key: "hv",
      text: slide.data.highlightValue,
      path: ["data", "highlightValue"],
      x: 1010,
      y: 350,
      w: 420,
      h: 120,
      size: 96,
      min: 40,
      align: "center",
      valign: "bottom",
      multiline: false,
    });
    tag(api, { key: "hl", text: slide.data.highlightLabel, path: ["data", "highlightLabel"], cx: 1220, cy: 512, maxW: 420 });
  });
  return <Scene layout={layout} props={props} />;
}
