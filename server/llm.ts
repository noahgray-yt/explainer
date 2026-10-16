import { z } from "zod";
import { LIMITS } from "../shared/lint";
import { OutlineSchema, SLIDE_VARIANTS, SlideSchema, SlidesOutputSchema, type Outline, type Slide, type TemplateName } from "../shared/schema";
import { UserError } from "./errors";
import type { IngestResult } from "./ingest";
import { toOutputSchema } from "./jsonSchema";
import { outlineTask, regenerateTask, repairTask, slidesTask, sourceBlock, targetSlideCount } from "./prompts";
import { callModel, FormatError, type LlmCall } from "./providers";

/* ------------------------------------------------------------------ *
 * The four model tasks. Every answer is checked with Zod; on invalid
 * data the request is repeated exactly once, with the problem as a hint.
 * ------------------------------------------------------------------ */

type Request = Omit<LlmCall, "schema" | "source"> & { src: IngestResult | null; schema: z.ZodType };

async function requestValidated<T>(req: Request, validate: (raw: unknown) => T | string): Promise<T> {
  const { src, schema, ...rest } = req;
  const base = { ...rest, source: src ? sourceBlock(src) : null, schema: toOutputSchema(schema) };
  let task = req.task;
  let problem = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = validate(await callModel({ ...base, task, label: `${req.label}${attempt > 1 ? " (retry)" : ""}` }));
      if (typeof result !== "string") return result;
      problem = result;
    } catch (e) {
      if (!(e instanceof FormatError)) throw e;
      problem = e.message;
    }
    console.warn(`[llm] ${req.label}: invalid answer (${problem.slice(0, 300)})`);
    task = `${req.task}\n\nYour previous answer was rejected: ${problem}\nAnswer again and follow the schema and limits exactly.`;
  }
  throw new UserError("The model returned invalid slides twice.", "Just try again – or shorten the text.", 502);
}

const zodProblem = (err: z.ZodError) =>
  err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");

export async function createOutline(src: IngestResult, signal?: AbortSignal): Promise<Outline> {
  return requestValidated(
    { src, task: outlineTask(targetSlideCount(src)), schema: OutlineSchema, maxTokens: 16000, label: "outline", signal },
    (raw) => {
      const parsed = OutlineSchema.safeParse(raw);
      if (!parsed.success) return zodProblem(parsed.error);
      const n = parsed.data.slides.length;
      if (n < LIMITS.slidesMin) return `only ${n} slides – plan at least ${LIMITS.slidesMin}`;
      if (n > LIMITS.slidesMax + 3) return `${n} slides – plan at most ${LIMITS.slidesMax}`;
      return parsed.data;
    },
  );
}

export async function createSlides(
  src: IngestResult,
  outline: Outline,
  onProgress: (started: number) => void,
  signal?: AbortSignal,
): Promise<Slide[]> {
  let last = 0;
  return requestValidated(
    {
      src,
      task: slidesTask(JSON.stringify(outline, null, 1)),
      schema: SlidesOutputSchema,
      maxTokens: 32000,
      label: "slides",
      signal,
      onText: (snapshot) => {
        // Every slide has exactly one "template" key → rough progress
        const n = snapshot.match(/"template"\s*:/g)?.length ?? 0;
        if (n !== last) onProgress((last = n));
      },
    },
    (raw) => {
      const parsed = SlidesOutputSchema.safeParse(raw);
      if (!parsed.success) return zodProblem(parsed.error);
      if (parsed.data.slides.length < Math.min(LIMITS.slidesMin, outline.slides.length)) {
        return `only ${parsed.data.slides.length} slides – write one slide per outline entry (${outline.slides.length})`;
      }
      return parsed.data.slides;
    },
  );
}

export async function repairSlides(src: IngestResult, items: { slide: Slide; issues: string[] }[], signal?: AbortSignal): Promise<Slide[]> {
  return requestValidated(
    { src, task: repairTask(items), schema: SlidesOutputSchema, maxTokens: 16000, label: `repair (${items.length})`, signal },
    (raw) => {
      const parsed = SlidesOutputSchema.safeParse(raw);
      return parsed.success ? parsed.data.slides : zodProblem(parsed.error);
    },
  );
}

export async function regenerateSlide(opts: {
  src: IngestResult | null;
  deckTitle: string;
  slide: Slide;
  prev: Slide | null;
  next: Slide | null;
  template: TemplateName | null;
  hint: string;
}): Promise<Slide> {
  const schema = z.object({ slide: opts.template ? SLIDE_VARIANTS[opts.template] : SlideSchema });
  return requestValidated(
    { src: opts.src, task: regenerateTask(opts), schema, maxTokens: 8000, label: "regenerate" },
    (raw) => {
      const parsed = schema.safeParse(raw);
      return parsed.success ? (parsed.data.slide as Slide) : zodProblem(parsed.error);
    },
  );
}
