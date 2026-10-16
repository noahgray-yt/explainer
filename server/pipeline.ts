import { randomUUID } from "node:crypto";
import { coerceSlide, lintSlide } from "../shared/lint";
import type { Deck, GenerateRequest, ProgressEvent, RegenerateRequest, Slide } from "../shared/schema";
import { ingest, type IngestResult } from "./ingest";
import { createOutline, createSlides, regenerateSlide, repairSlides } from "./llm";
import { mockOutline, mockRegenerate, mockSlides } from "./mock";
import { activeProvider, mapApiError } from "./providers";

const budget = () => Number(process.env.MAX_INPUT_CHARS) || 60_000;
const fmt = (n: number) => n.toLocaleString("en-US");

/** Sources of the latest decks – so "regenerate this slide" knows the context. */
const sources = new Map<string, IngestResult>();
function remember(id: string, src: IngestResult) {
  sources.set(id, src);
  while (sources.size > 20) sources.delete(sources.keys().next().value!);
}

const shortId = () => randomUUID().slice(0, 8);

export async function generateDeck(req: GenerateRequest, emit: (e: ProgressEvent) => void, signal?: AbortSignal): Promise<Deck> {
  const t0 = Date.now();
  const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
  const mock = activeProvider() === "mock";

  emit({ type: "stage", stage: "ingest", message: "Reading the source …" });
  const src = await ingest(req.input, budget());
  const what = src.kind === "github" ? `Repo ${src.label}` : src.kind === "local" ? `Folder ${src.label}` : "Text";
  emit({ type: "info", message: `${what} read${src.fileCount ? ` (${src.fileCount} files)` : ""}: ${fmt(src.text.length)} characters.` });
  if (src.truncated) emit({ type: "info", message: `Note: the source was too long and was cut to ${fmt(budget())} characters.` });

  emit({ type: "stage", stage: "outline", message: "Planning the storyline …" });
  const outline = mock ? await mockOutline(src) : await createOutline(src, signal);
  const total = outline.slides.length;
  emit({ type: "info", message: `Outline ready: ${total} slides (${secs()}).` });

  emit({ type: "stage", stage: "slides", message: "Writing the slides …" });
  emit({ type: "progress", done: 0, total });
  const onProgress = (started: number) => emit({ type: "progress", done: Math.max(0, Math.min(total, started - 1)), total });
  let slides = mock ? await mockSlides(src, outline, onProgress) : await createSlides(src, outline, onProgress, signal);
  emit({ type: "progress", done: slides.length, total: slides.length });

  // Check the content rules; send broken slides back once for a targeted fix
  const broken = slides.map((slide) => ({ slide, issues: lintSlide(slide) })).filter((x) => x.issues.length);
  if (broken.length && !mock) {
    emit({ type: "stage", stage: "repair", message: `Polishing ${broken.length} slide(s) …` });
    try {
      const fixed = await repairSlides(src, broken, signal);
      const byId = new Map(fixed.map((s) => [s.id, s]));
      slides = slides.map((s) => byId.get(s.id) ?? s);
    } catch (e) {
      if (signal?.aborted) throw e;
      // The repair is optional – coerceSlide trims mechanically if needed
      console.warn("[pipeline] repair failed:", (e as Error).message);
    }
  }

  const deckId = shortId();
  const deck: Deck = {
    version: 1,
    id: deckId,
    title: outline.deckTitle,
    theme: "paper",
    createdAt: new Date().toISOString(),
    source: { kind: src.kind, label: src.label },
    outline,
    slides: slides.map((s) => ({ ...coerceSlide(s), id: shortId() })),
  };
  remember(deckId, src);
  emit({ type: "stage", stage: "done", message: `Done: ${deck.slides.length} slides in ${secs()}.` });
  return deck;
}

export async function regenerate(req: RegenerateRequest): Promise<Slide> {
  try {
    const slide =
      activeProvider() === "mock" ? await mockRegenerate(req.slide) : await regenerateSlide({ ...req, src: sources.get(req.deckId) ?? null });
    return { ...coerceSlide(slide), id: req.slide.id };
  } catch (e) {
    throw mapApiError(e);
  }
}
