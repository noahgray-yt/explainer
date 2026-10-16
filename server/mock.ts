import { ICONS, type IconName, type Outline, type Slide, type TemplateName } from "../shared/schema";
import { clampWords } from "../shared/lint";
import type { IngestResult } from "./ingest";

/* ------------------------------------------------------------------ *
 * Demo mode (LLM_PROVIDER=mock): builds a deck from snippets of the
 * source without calling a model. Good for testing the UI, rendering
 * and export – the content only roughly fits.
 * ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pieces(src: IngestResult) {
  const lines = src.text.split("\n").map((l) => l.trim());
  const headings = lines
    .filter((l) => /^#{1,3}\s+/.test(l))
    .map((l) => l.replace(/^#+\s*/, "").replace(/[`*_]/g, ""))
    .filter((h) => !/^(file tree|repository)/i.test(h) && !h.includes("/"));
  const sentences = src.text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>|]/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.split(" ").length >= 4 && s.split(" ").length <= 40);
  const words = [...new Set(src.text.match(/\b[A-Za-z]{6,}\b/g) ?? [])].map((w) => w[0].toUpperCase() + w.slice(1));
  const numbers = (src.text.match(/\b\d{1,4}(?:[.,]\d+)?\b/g) ?? []).map((n) => Number(n.replace(",", "."))).filter((n) => n > 0 && n < 10000);
  let si = 0;
  let wi = 0;
  let hi = 0;
  return {
    sentence: (n: number) => clampWords(sentences[si++ % Math.max(1, sentences.length)] ?? "A short sentence that explains it", n),
    word: () => words[wi++ % Math.max(1, words.length)] ?? "Thing",
    heading: (fallback: string) => clampWords(headings[hi++] ?? fallback, 5),
    numbers,
  };
}

const icon = (i: number): IconName => ICONS[(i * 7) % ICONS.length];

const PLAN: { section: Outline["slides"][number]["section"]; template: TemplateName }[] = [
  { section: "intro", template: "title" },
  { section: "what", template: "cards-grid" },
  { section: "what", template: "stat" },
  { section: "why", template: "before-after" },
  { section: "why", template: "checklist" },
  { section: "how", template: "flow" },
  { section: "how", template: "hub" },
  { section: "how", template: "compare" },
  { section: "how", template: "bars" },
  { section: "examples", template: "prompt-list" },
  { section: "examples", template: "cards-grid" },
  { section: "examples", template: "flow" },
  { section: "limits", template: "checklist" },
  { section: "limits", template: "compare" },
  { section: "conclusion", template: "stat" },
  { section: "conclusion", template: "before-after" },
];

export async function mockOutline(src: IngestResult): Promise<Outline> {
  await sleep(600);
  const p = pieces(src);
  return {
    deckTitle: clampWords(src.label, 6),
    subtitle: "Demo deck without AI",
    slides: PLAN.map((x) => ({ ...x, message: p.sentence(12), content: p.sentence(20) })),
  };
}

export async function mockSlides(src: IngestResult, outline: Outline, onProgress: (n: number) => void): Promise<Slide[]> {
  const p = pieces(src);
  const nums = p.numbers.length >= 4 ? p.numbers : [12, 30, 18, 42];
  const slides: Slide[] = [];
  for (const [i, o] of outline.slides.entries()) {
    await sleep(120);
    onProgress(i + 1);
    const id = `s${i + 1}`;
    const title = i === 0 ? outline.deckTitle : p.heading(p.word());
    const takeaway = p.sentence(10);
    const w = () => p.word();
    switch (o.template) {
      case "title":
        slides.push({ id, title, takeaway: outline.subtitle, template: "title", data: { subtitle: p.sentence(8) } });
        break;
      case "flow":
        slides.push({
          id,
          title,
          takeaway,
          template: "flow",
          data: { steps: [0, 1, 2, 3].map((k) => ({ label: w(), note: k % 2 ? p.sentence(4) : "" })) },
        });
        break;
      case "bars":
        slides.push({
          id,
          title,
          takeaway,
          template: "bars",
          data: {
            caption: "values from the text",
            bars: nums.slice(0, 5).map((value) => ({ label: w(), value })),
            unit: "",
            highlightValue: `${Math.max(...nums.slice(0, 5))}`,
            highlightLabel: "highest value",
          },
        });
        break;
      case "cards-grid":
        slides.push({
          id,
          title,
          takeaway,
          template: "cards-grid",
          data: { cards: [0, 1, 2, 3, 4, 5].slice(0, 4 + (i % 3)).map((k) => ({ icon: icon(i + k), label: w(), note: k % 2 ? "" : p.sentence(3) })) },
        });
        break;
      case "before-after":
        slides.push({
          id,
          title,
          takeaway,
          template: "before-after",
          data: {
            before: { heading: "Before", points: [p.sentence(5), p.sentence(5)] },
            after: { heading: "After", points: [p.sentence(5), p.sentence(5)] },
          },
        });
        break;
      case "compare":
        slides.push({
          id,
          title,
          takeaway,
          template: "compare",
          data: {
            left: { heading: w(), lines: [p.sentence(4), p.sentence(3)], caption: "the original" },
            right: { heading: w(), lines: [p.sentence(4), p.sentence(3)], caption: "the copy" },
            relation: "vs.",
          },
        });
        break;
      case "checklist":
        slides.push({
          id,
          title,
          takeaway,
          template: "checklist",
          data: { items: [0, 1, 2, 3].map((k) => ({ text: p.sentence(6), note: k % 2 ? p.sentence(6) : "", status: k === 3 ? "warn" : "ok" })) },
        });
        break;
      case "prompt-list":
        slides.push({ id, title, takeaway, template: "prompt-list", data: { prompts: [0, 1, 2, 3].map(() => p.sentence(11)) } });
        break;
      case "stat":
        slides.push({
          id,
          title,
          takeaway,
          template: "stat",
          data: { value: `${nums[i % nums.length]}`, label: p.sentence(5), note: "demo value" },
        });
        break;
      case "hub":
        slides.push({
          id,
          title,
          takeaway,
          template: "hub",
          data: { center: w(), nodes: [0, 1, 2, 3].map((k) => ({ icon: icon(i + k + 3), label: w() })) },
        });
        break;
    }
  }
  return slides;
}

export async function mockRegenerate(slide: Slide): Promise<Slide> {
  await sleep(500);
  return { ...slide, takeaway: slide.takeaway.split(" ").reverse().join(" ") };
}
