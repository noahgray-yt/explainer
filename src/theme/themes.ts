/* ------------------------------------------------------------------ *
 * Central theme definition. Every color, the font, the rough.js
 * settings and the animation timing live here – templates only use
 * these values (in JS via the theme object, in CSS via --variables).
 * ------------------------------------------------------------------ */

export type FillStyle = "solid" | "zigzag" | "cross-hatch" | "hachure";

/** Pastel tones: a light fill with a matching, darker outline. */
export const TONES = ["blue", "yellow", "purple", "green", "pink", "orange"] as const;
export type Tone = (typeof TONES)[number];

export interface Theme {
  id: string;
  name: string;
  colors: {
    /** App background around the slides */
    page: string;
    /** Slide background */
    surface: string;
    /** Lines and text */
    ink: string;
    /** Small grey annotations */
    inkSoft: string;
    /** Fill of neutral shapes (cards, windows, nodes) */
    paper: string;
    /** Highlight text (e.g. the "after" heading) */
    accent: string;
  };
  tones: Record<Tone, { fill: string; stroke: string }>;
  /** Order in which tones are handed out to boxes */
  toneOrder: Tone[];
  /** Title underline colors, cycling from slide to slide */
  underlines: string[];
  font: { family: string; title: number; body: number };
  rough: {
    roughness: number;
    bowing: number;
    strokeWidth: number;
    fillStyle: FillStyle;
    hachureGap: number;
    fillWeight: number;
    /** Draw every line twice, slightly offset (sketchier) */
    doubleStroke: boolean;
  };
  /** Draw animation timing in seconds */
  motion: { stroke: number; stagger: number; text: number };
}

export const paper: Theme = {
  id: "paper",
  name: "Paper",
  colors: {
    page: "#ECECEA",
    surface: "#FFFFFF",
    ink: "#1E1E1E",
    inkSoft: "#8A8A8A",
    paper: "#FFFFFF",
    accent: "#E8735A",
  },
  tones: {
    blue: { fill: "#D6E7FB", stroke: "#4F8ED8" },
    yellow: { fill: "#FFEDAD", stroke: "#D9A520" },
    purple: { fill: "#E0D7FA", stroke: "#8A72D8" },
    green: { fill: "#D5EFD5", stroke: "#5BA866" },
    pink: { fill: "#FBD7DE", stroke: "#DC6B80" },
    orange: { fill: "#FFDFC2", stroke: "#E38B45" },
  },
  toneOrder: ["blue", "yellow", "purple", "green", "pink", "orange"],
  underlines: ["#E8735A", "#8A72D8", "#5BA866", "#E38B45", "#4F8ED8"],
  font: { family: "'Kalam', cursive", title: 400, body: 400 },
  rough: { roughness: 0.85, bowing: 0.7, strokeWidth: 1.7, fillStyle: "solid", hachureGap: 8, fillWeight: 1.2, doubleStroke: false },
  motion: { stroke: 0.5, stagger: 0.06, text: 0.4 },
};

/** Second theme to show that styles are swappable: chalk on a blackboard. */
export const chalkboard: Theme = {
  id: "chalkboard",
  name: "Chalkboard",
  colors: {
    page: "#1B2420",
    surface: "#2A3631",
    ink: "#F2EFE7",
    inkSoft: "#A3AEA8",
    paper: "#2A3631",
    accent: "#F4A08C",
  },
  tones: {
    blue: { fill: "#34506A", stroke: "#9CC6F2" },
    yellow: { fill: "#5A5130", stroke: "#F2D06B" },
    purple: { fill: "#463F66", stroke: "#C7BCF0" },
    green: { fill: "#34563C", stroke: "#A9D8B0" },
    pink: { fill: "#5C3A42", stroke: "#F2A9B6" },
    orange: { fill: "#5E4430", stroke: "#F5BC8A" },
  },
  toneOrder: ["blue", "yellow", "purple", "green", "pink", "orange"],
  underlines: ["#F4A08C", "#C7BCF0", "#A9D8B0", "#F5BC8A", "#9CC6F2"],
  font: { family: "'Kalam', cursive", title: 400, body: 400 },
  rough: { roughness: 1.3, bowing: 1, strokeWidth: 1.9, fillStyle: "hachure", hachureGap: 7, fillWeight: 1.4, doubleStroke: true },
  motion: { stroke: 0.5, stagger: 0.06, text: 0.4 },
};

export const THEMES: Record<string, Theme> = { paper, chalkboard };

export const getTheme = (id: string | undefined): Theme => THEMES[id ?? ""] ?? paper;

/** CSS variables for a slide or the whole app. */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--page": t.colors.page,
    "--surface": t.colors.surface,
    "--ink": t.colors.ink,
    "--ink-soft": t.colors.inkSoft,
    "--paper": t.colors.paper,
    "--accent": t.colors.accent,
    "--tone-yellow": t.tones.yellow.fill,
    "--tone-yellow-line": t.tones.yellow.stroke,
    "--tone-blue": t.tones.blue.fill,
    "--tone-blue-line": t.tones.blue.stroke,
    "--font": t.font.family,
    "--w-title": String(t.font.title),
    "--w-body": String(t.font.body),
  };
}
