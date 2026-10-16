import { ICONS, type Slide } from "../shared/schema";
import { LIMITS } from "../shared/lint";
import type { IngestResult } from "./ingest";

/* ------------------------------------------------------------------ *
 * One system prompt for every call (outline, slides, repair,
 * regenerate). System prompt + source stay byte-identical, so the
 * prompt cache kicks in from the second call on.
 * ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You turn source material into a short series of very simple, hand-drawn explainer slides – like a sketched storyboard on a whiteboard. Your audience is smart but new to the topic.

# Principles
- Every slide makes exactly ONE point. If you have two points, make two slides.
- Few words, lots of white space. A slide is understood in 5 seconds.
- Concrete beats abstract: use the real names, steps, commands and numbers from the source.
- Never invent numbers, names, features or facts that are not in the source.
- Plain, friendly words and short sentences. No marketing language, no hype.
- No markdown, no emojis, no trailing periods in titles or labels.

# Storyline (in this order; a section may span several slides)
1. intro – exactly one title slide (template "title")
2. what – What is it? (1–3 slides)
3. why – Why does it matter? Which problem does it solve? (1–3)
4. how – How does it work? Parts, process, architecture (3–6)
5. examples – Concrete usage, examples, commands (2–4)
6. limits – Limitations, risks, trade-offs (1–3)
7. conclusion – The one thing to remember, next step (1–2)

# Templates (the only ones allowed)
- title: first slide only. data: subtitle
- flow: a process or sequence. data.steps: 3–5 × {label ≤3 words, note ≤5 words or ""}
- bars: compare 2–6 quantities. ONLY with real numbers from the source. data: caption, bars {label, value}, unit, highlightValue (big key figure), highlightLabel
- stat: one striking number. ONLY if it is in the source. data: value, label, note
- cards-grid: 4–6 parallel things (features, parts, types). data.cards: {icon, label ≤3 words, note ≤4 words or ""}
- before-after: a change; problem → solution. data.before/after: {heading ≤2 words, points: 1–3 × ≤6 words}
- compare: two things side by side (A vs. B, original vs. copy). data.left/right: {heading, lines: 1–3 × ≤5 words, caption}, relation (≤2 words, e.g. "vs.")
- checklist: 3–5 requirements, rules, pros or risks. data.items: {text ≤7 words, note ≤8 words or "", status "ok" | "warn"}
- prompt-list: 3–5 example prompts, commands, questions or quotes. data.prompts: strings ≤14 words
- hub: architecture – one central element with 3–5 connected parts. data: center, nodes {icon, label}

Variety: use at least 6 different templates per deck and never the same template more than twice in a row.
Icons (choose by meaning): ${ICONS.join(", ")}.

# Hard limits per slide
- title: max ${LIMITS.titleWords} words, phrased like a plain question or statement ("How it works", "Why it matters")
- takeaway: one closing line, max ${LIMITS.takeawayWords} words – states the slide's one point in plain words
- all other slide text together: max about ${LIMITS.bodyWords} words (prompt-list may use a bit more)
- labels inside boxes, cards and nodes: max 3 words

# Language
Write ALL slide text in English – also when the source is written in another language.`;

/** First content block of every request: the source (cached). */
export function sourceBlock(src: IngestResult): string {
  const kind = { text: "text", github: "GitHub repository", local: "local project folder" }[src.kind];
  return `<source kind="${kind}" label="${src.label.replace(/"/g, "'")}">
${src.text}
</source>`;
}

export function targetSlideCount(src: IngestResult): number {
  const words = src.text.split(/\s+/).length;
  if (src.kind !== "text") return 16;
  if (words < 500) return 12;
  if (words < 1600) return 15;
  if (words < 4000) return 18;
  return 21;
}

export function outlineTask(target: number): string {
  return `Task 1 of 2 – plan the storyline.
Create the outline for a deck of ${LIMITS.slidesMin}–${LIMITS.slidesMax} slides; aim for about ${target}.
For each slide give: section, the one-sentence core message, the best-fitting template, and "content" – terse notes with the concrete facts, names, numbers or steps from the source that the slide should show.
The first slide is the title slide; the last slide is a conclusion.`;
}

export function slidesTask(outlineJson: string): string {
  return `Task 2 of 2 – write the slides.
Turn every outline entry into exactly one slide, in the same order (ids "s1", "s2", …). Keep the planned template unless the content clearly does not fit it; never switch to "bars" or "stat" without real numbers from the source.
Fill "data" exactly as the template requires and respect all word limits.

<outline>
${outlineJson}
</outline>`;
}

export function repairTask(items: { slide: Slide; issues: string[] }[]): string {
  const list = items
    .map(({ slide, issues }) => `<slide>\n${JSON.stringify(slide)}\n<issues>\n- ${issues.join("\n- ")}\n</issues>\n</slide>`)
    .join("\n");
  return `Some slides break the rules. Rewrite ONLY these slides so that every issue is fixed; keep their ids, their message and (if possible) their template. Shorten rather than drop content.

${list}`;
}

export function regenerateTask(opts: {
  deckTitle: string;
  slide: Slide;
  prev: Slide | null;
  next: Slide | null;
  template: string | null;
  hint: string;
}): string {
  const ctx = (label: string, s: Slide | null) => (s ? `<${label}>${JSON.stringify({ title: s.title, takeaway: s.takeaway })}</${label}>` : "");
  return `Rewrite one slide of the deck "${opts.deckTitle}". Make a fresh, clearer version of the same point – different wording, and a better visual idea if possible.
${opts.template ? `Use the template "${opts.template}".` : "Keep the template unless another one clearly fits better."}
${opts.hint ? `Wish of the author: ${opts.hint}` : ""}
Keep the id "${opts.slide.id}". Respect all word limits.

<current_slide>
${JSON.stringify(opts.slide)}
</current_slide>
${ctx("previous_slide", opts.prev)}
${ctx("next_slide", opts.next)}`;
}
