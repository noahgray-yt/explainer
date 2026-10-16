import { bodyTexts, countWords, type Slide, type TemplateName } from "./schema";

/* ------------------------------------------------------------------ *
 * Content rules beyond the plain structure: word limits and item
 * counts. lintSlide() returns findings for the repair request,
 * coerceSlide() enforces the limits mechanically as a last resort.
 * ------------------------------------------------------------------ */

export const LIMITS = {
  titleWords: 6,
  takeawayWords: 12,
  bodyWords: 30,
  labelWords: 4,
  slidesMin: 12,
  slidesMax: 25,
} as const;

/** Allowed number of items per template [min, max]. */
export const ITEM_RANGE: Partial<Record<TemplateName, [number, number]>> = {
  flow: [3, 5],
  bars: [2, 6],
  "cards-grid": [4, 6],
  checklist: [3, 5],
  "prompt-list": [3, 5],
  hub: [3, 5],
};

export function itemCount(slide: Slide): number | null {
  switch (slide.template) {
    case "flow":
      return slide.data.steps.length;
    case "bars":
      return slide.data.bars.length;
    case "cards-grid":
      return slide.data.cards.length;
    case "checklist":
      return slide.data.items.length;
    case "prompt-list":
      return slide.data.prompts.length;
    case "hub":
      return slide.data.nodes.length;
    default:
      return null;
  }
}

/** Short labels (boxes, cards, nodes) that must fit into small shapes. */
function shortLabels(slide: Slide): string[] {
  switch (slide.template) {
    case "flow":
      return slide.data.steps.map((s) => s.label);
    case "cards-grid":
      return slide.data.cards.map((c) => c.label);
    case "hub":
      return [slide.data.center, ...slide.data.nodes.map((n) => n.label)];
    case "bars":
      return slide.data.bars.map((b) => b.label);
    default:
      return [];
  }
}

export function lintSlide(slide: Slide): string[] {
  const issues: string[] = [];
  const tw = countWords(slide.title);
  if (tw === 0) issues.push("title is empty");
  if (tw > LIMITS.titleWords + 1) issues.push(`title has ${tw} words (max ${LIMITS.titleWords})`);
  const kw = countWords(slide.takeaway);
  if (kw === 0) issues.push("takeaway is empty");
  if (kw > LIMITS.takeawayWords) issues.push(`takeaway has ${kw} words (max ${LIMITS.takeawayWords})`);

  const bw = bodyTexts(slide).reduce((n, t) => n + countWords(t), 0);
  // Example prompts are naturally a bit longer
  const bodyMax = slide.template === "prompt-list" ? LIMITS.bodyWords + 20 : LIMITS.bodyWords + 5;
  if (bw > bodyMax) issues.push(`slide body has ${bw} words (max about ${bodyMax - 5})`);

  for (const l of shortLabels(slide)) {
    if (countWords(l) > LIMITS.labelWords) issues.push(`label "${l}" is too long (max ${LIMITS.labelWords} words)`);
  }

  const range = ITEM_RANGE[slide.template];
  const n = itemCount(slide);
  if (range && n !== null && (n < range[0] || n > range[1])) {
    issues.push(`template "${slide.template}" needs ${range[0]}-${range[1]} items, got ${n}`);
  }

  if (slide.template === "bars" && slide.data.bars.some((b) => !Number.isFinite(b.value) || b.value < 0)) {
    issues.push("bar values must be non-negative numbers");
  }
  if (slide.template === "before-after" || slide.template === "compare") {
    const sides =
      slide.template === "before-after"
        ? [slide.data.before.points, slide.data.after.points]
        : [slide.data.left.lines, slide.data.right.lines];
    if (sides.some((p) => p.length < 1 || p.length > 3)) issues.push("each side needs 1-3 points");
  }
  return issues;
}

/** Cuts a string down to n words. */
export function clampWords(s: string, n: number): string {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= n) return s.trim();
  return parts.slice(0, n).join(" ").replace(/[,;:–-]+$/, "");
}

/** Enforces the limits mechanically if the model still misses them after the repair. */
export function coerceSlide(slide: Slide): Slide {
  const s: Slide = structuredClone(slide);
  s.title = clampWords(s.title, LIMITS.titleWords + 1);
  s.takeaway = clampWords(s.takeaway, LIMITS.takeawayWords);
  const max = ITEM_RANGE[s.template]?.[1] ?? Infinity;
  switch (s.template) {
    case "flow":
      s.data.steps = s.data.steps.slice(0, max);
      break;
    case "bars":
      s.data.bars = s.data.bars.slice(0, max).map((b) => ({ ...b, value: Math.max(0, Number(b.value) || 0) }));
      break;
    case "cards-grid":
      s.data.cards = s.data.cards.slice(0, max);
      break;
    case "checklist":
      s.data.items = s.data.items.slice(0, max);
      break;
    case "prompt-list":
      s.data.prompts = s.data.prompts.slice(0, max);
      break;
    case "hub":
      s.data.nodes = s.data.nodes.slice(0, max);
      break;
    case "before-after":
      s.data.before.points = s.data.before.points.slice(0, 3);
      s.data.after.points = s.data.after.points.slice(0, 3);
      break;
    case "compare":
      s.data.left.lines = s.data.left.lines.slice(0, 3);
      s.data.right.lines = s.data.right.lines.slice(0, 3);
      break;
  }
  for (const key of ["steps", "cards", "nodes"] as const) {
    const arr = (s.data as Record<string, unknown>)[key];
    if (Array.isArray(arr)) {
      for (const item of arr as { label: string }[]) item.label = clampWords(item.label, LIMITS.labelWords);
    }
  }
  return s;
}
