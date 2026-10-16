import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { TemplateName } from "../../shared/schema";
import { TextBox, type TextMetrics } from "../components/TextBox";
import { useFontsReady } from "../lib/fonts";
import { measureText } from "../lib/measure";
import { SketchBuilder, type Stroke } from "../sketch/builder";
import { themeVars } from "../theme/themes";
import { FRAME, H, W, useSlideEnv, type LayoutApi, type TemplateProps, type TextSpec } from "./types";

export interface SceneLayout {
  strokes: Stroke[];
  steps: number;
  texts: TextSpec[];
}

/**
 * Builds the layout of a slide: template drawing + standard frame
 * (centered title on top, closing line at the bottom). The title slide
 * draws its own frame. Recomputed only when slide, theme or fonts change.
 */
export function useLayout<T extends TemplateName>(
  props: TemplateProps<T>,
  draw: (api: LayoutApi, slide: TemplateProps<T>["slide"]) => void,
  opts: { frame?: boolean } = {},
): SceneLayout {
  const { slide, theme } = props;
  const fontsReady = useFontsReady();
  return useMemo(() => {
    const frame = opts.frame ?? true;
    const b = new SketchBuilder(theme, `${slide.id}:${slide.template}`);
    const texts: TextSpec[] = [];
    const api: LayoutApi = {
      b,
      theme,
      text: (t) => texts.push(t),
      measure: (text, size) => measureText(text, size, theme.font.family, theme.font.body),
    };
    if (frame) {
      texts.push({
        key: "title",
        text: slide.title,
        path: ["title"],
        ...FRAME.title,
        min: 34,
        align: "center",
        valign: "bottom",
        weight: "title",
        role: "title",
        multiline: false,
      });
    }
    draw(api, slide);
    if (frame) {
      texts.push({ key: "takeaway", text: slide.takeaway, path: ["takeaway"], ...FRAME.takeaway, min: 20, align: "center", multiline: true });
    }
    return { strokes: b.strokes, steps: b.steps, texts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, theme, fontsReady]);
}

/** Renders the strokes and texts of a slide on the 1600×900 grid. */
export function Scene<T extends TemplateName>({ layout, props }: { layout: SceneLayout; props: TemplateProps<T> }) {
  const { slide, theme, index } = props;
  const { animate } = useSlideEnv();
  const [titleBox, setTitleBox] = useState<TextMetrics | null>(null);
  const onTitleMetrics = useCallback(
    (m: TextMetrics) =>
      setTitleBox((prev) =>
        prev && Math.abs(prev.width - m.width) < 1 && Math.abs(prev.top - m.top) < 1 && Math.abs(prev.left - m.left) < 1 ? prev : m,
      ),
    [],
  );

  // Thin colored underline under the (last line of the) title; the color changes from slide to slide
  const titleSpec = layout.texts.find((t) => t.key === "title");
  const decor = useMemo(() => {
    if (!titleSpec || !titleBox) return [];
    const b = new SketchBuilder(theme, `${slide.id}:underline`);
    const color = theme.underlines[index % theme.underlines.length];
    const y = titleSpec.y + titleBox.top + titleBox.height + 2;
    const [from, to] = titleSpec.partialUnderline ? [0.22, 0.8] : [0, 1];
    const x = titleSpec.x + titleBox.left + titleBox.width * from;
    b.underline(x, y, Math.max(60, titleBox.width * (to - from)), color);
    if (titleSpec.sparkle) b.sparkle(titleSpec.x + titleBox.firstRight + 26, titleSpec.y + titleBox.firstTop + 30, 28, { sameStep: true });
    return b.strokes;
  }, [titleSpec, titleBox, theme, slide.id, index]);

  const m = theme.motion;
  const lead = 0.4;
  const stagger = Math.min(m.stagger, 2.2 / Math.max(1, layout.steps));
  const textDelay = lead + layout.steps * stagger + m.stroke * 0.6;

  const style = {
    ...themeVars(theme),
    width: W,
    height: H,
    "--text-delay": `${textDelay}s`,
    "--stroke-dur": `${m.stroke}s`,
    "--text-dur": `${m.text}s`,
  } as CSSProperties;

  const pathEl = (s: Stroke, i: number, delay: number, prefix: string) => (
    <path
      key={`${prefix}${i}`}
      d={s.d}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
      fill={s.fill}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      className={s.fill !== "none" && s.stroke === "none" ? "fillin" : "draw"}
      style={animate ? { animationDelay: `${delay.toFixed(2)}s` } : undefined}
    />
  );

  return (
    <div className={`slide${animate ? " anim" : ""}`} style={style} lang="en" data-template={slide.template}>
      <svg className="sketch" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {decor.map((s, i) => pathEl(s, i, 0.25, "u"))}
        {layout.strokes.map((s, i) => pathEl(s, i, lead + s.order * stagger, "s"))}
      </svg>
      {layout.texts.map((t) => (
        <TextBox key={t.key} spec={t} onMetrics={t.key === "title" ? onTitleMetrics : undefined} />
      ))}
    </div>
  );
}
