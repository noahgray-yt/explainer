import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Shared data model for the server (LLM output) and the client
 * (rendering). The .describe() texts end up in the JSON schema and
 * guide the model, so keep them short and concrete.
 * ------------------------------------------------------------------ */

export const TEMPLATES = [
  "title",
  "flow",
  "bars",
  "cards-grid",
  "before-after",
  "compare",
  "checklist",
  "prompt-list",
  "stat",
  "hub",
] as const;
export const TemplateSchema = z.enum(TEMPLATES);
export type TemplateName = z.infer<typeof TemplateSchema>;

export const ICONS = [
  "idea",
  "gear",
  "document",
  "user",
  "users",
  "cloud",
  "database",
  "lock",
  "bolt",
  "chart",
  "clock",
  "globe",
  "code",
  "chat",
  "search",
  "check",
  "warning",
  "rocket",
  "folder",
  "mail",
  "heart",
  "star",
  "puzzle",
  "key",
  "terminal",
  "book",
  "money",
  "target",
  "link",
  "eye",
] as const;
export const IconSchema = z.enum(ICONS).describe("Name of a small hand-drawn icon");
export type IconName = z.infer<typeof IconSchema>;

const words = (n: number, what: string) => z.string().describe(`${what}, max ${n} words`);
const optional = (n: number, what: string) => z.string().describe(`${what}, max ${n} words, or ""`);

/* ----------------------------- Template data ----------------------------- */

export const TitleDataSchema = z.object({
  subtitle: words(10, "One-line subtitle"),
});

export const FlowDataSchema = z.object({
  steps: z
    .array(z.object({ label: words(3, "Step name"), note: optional(5, "Small note under the box") }))
    .describe("3-5 process steps in order"),
});

export const BarsDataSchema = z.object({
  caption: optional(6, 'Small caption above the chart, e.g. "new stars per day"'),
  bars: z
    .array(z.object({ label: words(3, "Category"), value: z.number().describe("Non-negative number from the source") }))
    .describe("2-6 bars; only real numbers from the source"),
  unit: z.string().describe('Unit for the values, e.g. "%", "ms", "k" or ""'),
  highlightValue: z.string().describe('The big key figure, e.g. "66.8K" or "3x"'),
  highlightLabel: words(5, "What the key figure means (shown as a small tag)"),
});

export const CardsGridDataSchema = z.object({
  cards: z
    .array(z.object({ icon: IconSchema, label: words(3, "Card label"), note: optional(4, "Small grey line under the label") }))
    .describe("4-6 cards"),
});

const SideSchema = z.object({
  heading: words(2, "Column heading"),
  points: z.array(words(6, "Point")).describe("1-3 short points"),
});

export const BeforeAfterDataSchema = z.object({
  before: SideSchema,
  after: SideSchema,
});

const WindowSchema = z.object({
  heading: words(3, "Window title"),
  lines: z.array(words(5, "Line inside the window")).describe("1-3 short lines"),
  caption: optional(5, "Small grey caption under the window"),
});

export const CompareDataSchema = z.object({
  left: WindowSchema,
  right: WindowSchema,
  relation: words(2, 'Word on the arrow between the windows, e.g. "copies" or "vs."'),
});

export const ChecklistDataSchema = z.object({
  items: z
    .array(
      z.object({
        text: words(7, "Item"),
        note: optional(8, "Small grey explanation"),
        status: z.enum(["ok", "warn"]).describe('"ok" = check mark, "warn" = warning sign'),
      }),
    )
    .describe("3-5 items"),
});

export const PromptListDataSchema = z.object({
  prompts: z.array(words(14, "Example prompt, command or question")).describe("3-5 speech bubbles"),
});

export const StatDataSchema = z.object({
  value: z.string().describe('The big number, e.g. "73%", "12k", "2x"'),
  label: words(6, "What it measures"),
  note: optional(6, "Source or context, shown as a small tag"),
});

export const HubDataSchema = z.object({
  center: words(3, "Central element"),
  nodes: z.array(z.object({ icon: IconSchema, label: words(3, "Connected element") })).describe("3-5 connected elements"),
});

export const TEMPLATE_DATA = {
  title: TitleDataSchema,
  flow: FlowDataSchema,
  bars: BarsDataSchema,
  "cards-grid": CardsGridDataSchema,
  "before-after": BeforeAfterDataSchema,
  compare: CompareDataSchema,
  checklist: ChecklistDataSchema,
  "prompt-list": PromptListDataSchema,
  stat: StatDataSchema,
  hub: HubDataSchema,
} as const satisfies Record<TemplateName, z.ZodTypeAny>;

/* --------------------------------- Slides --------------------------------- */

const slideVariant = <T extends TemplateName>(template: T) =>
  z.object({
    id: z.string().describe('Slide id like "s1"'),
    title: words(6, "Short slide title"),
    takeaway: words(12, "Closing line that states the single key message"),
    template: z.literal(template),
    data: TEMPLATE_DATA[template],
  });

export const SLIDE_VARIANTS = {
  title: slideVariant("title"),
  flow: slideVariant("flow"),
  bars: slideVariant("bars"),
  "cards-grid": slideVariant("cards-grid"),
  "before-after": slideVariant("before-after"),
  compare: slideVariant("compare"),
  checklist: slideVariant("checklist"),
  "prompt-list": slideVariant("prompt-list"),
  stat: slideVariant("stat"),
  hub: slideVariant("hub"),
} as const;

export const SlideSchema = z.discriminatedUnion("template", [
  SLIDE_VARIANTS.title,
  SLIDE_VARIANTS.flow,
  SLIDE_VARIANTS.bars,
  SLIDE_VARIANTS["cards-grid"],
  SLIDE_VARIANTS["before-after"],
  SLIDE_VARIANTS.compare,
  SLIDE_VARIANTS.checklist,
  SLIDE_VARIANTS["prompt-list"],
  SLIDE_VARIANTS.stat,
  SLIDE_VARIANTS.hub,
]);
export type Slide = z.infer<typeof SlideSchema>;
export type SlideOf<T extends TemplateName> = Extract<Slide, { template: T }>;

export const SlidesOutputSchema = z.object({
  slides: z.array(SlideSchema).describe("All slides in presentation order"),
});

/* --------------------------------- Outline --------------------------------- */

export const SECTIONS = ["intro", "what", "why", "how", "examples", "limits", "conclusion"] as const;

export const OutlineSchema = z.object({
  deckTitle: words(6, "Title of the whole deck"),
  subtitle: words(10, "Subtitle of the deck"),
  slides: z
    .array(
      z.object({
        section: z.enum(SECTIONS),
        message: z.string().describe("The ONE core statement of this slide, one sentence"),
        template: TemplateSchema,
        content: z.string().describe("Concrete facts, names, numbers or steps from the source to show on this slide"),
      }),
    )
    .describe("12-25 slides following the storyline"),
});
export type Outline = z.infer<typeof OutlineSchema>;

/* ---------------------------------- Deck ---------------------------------- */

export const SourceKindSchema = z.enum(["text", "github", "local"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const DeckSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  title: z.string(),
  theme: z.string().default("paper"),
  createdAt: z.string(),
  source: z.object({ kind: SourceKindSchema, label: z.string() }),
  outline: OutlineSchema.optional(),
  slides: z.array(SlideSchema).min(1),
});
export type Deck = z.infer<typeof DeckSchema>;

/* ------------------------------ API contracts ------------------------------ */

export const GenerateRequestSchema = z.object({
  input: z.string().trim().min(1, "Please enter text, a GitHub URL or a folder path."),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const RegenerateRequestSchema = z.object({
  deckId: z.string(),
  deckTitle: z.string(),
  slide: SlideSchema,
  prev: SlideSchema.nullable(),
  next: SlideSchema.nullable(),
  template: TemplateSchema.nullable(),
  hint: z.string().max(500).default(""),
});
export type RegenerateRequest = z.infer<typeof RegenerateRequestSchema>;

/** Events the server streams while generating (SSE). */
export type ProgressEvent =
  | { type: "stage"; stage: "ingest" | "outline" | "slides" | "repair" | "done"; message: string }
  | { type: "info"; message: string }
  | { type: "progress"; done: number; total: number }
  | { type: "result"; deck: Deck }
  | { type: "error"; message: string; hint?: string };

/** Where the model calls go: API key, Claude subscription (via Claude Code) or demo mode. */
export type Provider = "api" | "subscription" | "mock" | "none";

export interface Health {
  ok: boolean;
  provider: Provider;
  model: string;
  github: boolean;
}

/* --------------------------------- Helpers --------------------------------- */

export const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** All visible texts of a slide except title and takeaway. */
export function bodyTexts(slide: Slide): string[] {
  switch (slide.template) {
    case "title":
      return [slide.data.subtitle];
    case "flow":
      return slide.data.steps.flatMap((s) => [s.label, s.note]);
    case "bars":
      return [slide.data.caption, ...slide.data.bars.map((b) => b.label), slide.data.highlightValue, slide.data.highlightLabel];
    case "cards-grid":
      return slide.data.cards.flatMap((c) => [c.label, c.note]);
    case "before-after":
      return [slide.data.before, slide.data.after].flatMap((s) => [s.heading, ...s.points]);
    case "compare":
      return [slide.data.left, slide.data.right].flatMap((w) => [w.heading, ...w.lines, w.caption]).concat(slide.data.relation);
    case "checklist":
      return slide.data.items.flatMap((i) => [i.text, i.note]);
    case "prompt-list":
      return slide.data.prompts;
    case "stat":
      return [slide.data.value, slide.data.label, slide.data.note];
    case "hub":
      return [slide.data.center, ...slide.data.nodes.map((n) => n.label)];
  }
}

export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  title: "Title",
  flow: "Flow",
  bars: "Bars",
  "cards-grid": "Cards",
  "before-after": "Before / after",
  compare: "Compare",
  checklist: "Checklist",
  "prompt-list": "Prompts",
  stat: "Stat",
  hub: "Hub",
};
