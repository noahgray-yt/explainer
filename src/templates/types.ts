import { createContext, useContext } from "react";
import type { SlideOf, TemplateName } from "../../shared/schema";
import type { SketchBuilder } from "../sketch/builder";
import type { Theme } from "../theme/themes";

/** Slide size in design pixels (16:9). Everything is laid out on this grid and scaled. */
export const W = 1600;
export const H = 900;

export const FRAME = {
  title: { x: 150, y: 58, w: 1300, h: 92, size: 54 },
  body: { x: 100, y: 200, w: 1400, h: 560 },
  takeaway: { x: 200, y: 776, w: 1200, h: 72, size: 30 },
} as const;

export type EditPath = (string | number)[];

export interface TextSpec {
  key: string;
  text: string;
  /** Path in the slide object for inline editing, e.g. ["data", "steps", 0, "label"] */
  path?: EditPath;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Maximum font size; shrinks until the text fits */
  size: number;
  min?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  weight?: "title" | "body";
  color?: "ink" | "ink-soft" | "accent";
  /** Allow line breaks (otherwise a single line that shrinks, then ends with "…") */
  multiline?: boolean;
  /** Animation: the title appears first, everything else after the lines */
  role?: "title" | "body";
  lineHeight?: number;
  /** Draw a small sparkle at the end of the first line (title slide) */
  sparkle?: boolean;
  /** Underline only the middle part of the last line (title slide) */
  partialUnderline?: boolean;
}

export interface LayoutApi {
  b: SketchBuilder;
  theme: Theme;
  text: (spec: TextSpec) => void;
  /** Width of a text in design pixels, in the slide font */
  measure: (text: string, size: number) => number;
}

export interface TemplateProps<T extends TemplateName = TemplateName> {
  slide: SlideOf<T>;
  theme: Theme;
  index: number;
  total: number;
}

/** Environment of a rendered slide: editing and animation. */
export interface SlideEnv {
  editable: boolean;
  animate: boolean;
  onEdit?: (path: EditPath, value: string) => void;
}

export const SlideEnvContext = createContext<SlideEnv>({ editable: false, animate: false });
export const useSlideEnv = () => useContext(SlideEnvContext);
