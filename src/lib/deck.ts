import { DeckSchema, type Deck, type Slide } from "../../shared/schema";
import type { EditPath } from "../templates/types";

export type DeckAction =
  | { type: "set"; deck: Deck | null }
  | { type: "edit"; id: string; path: EditPath; value: string }
  | { type: "replace"; id: string; slide: Slide }
  | { type: "move"; from: number; to: number }
  | { type: "delete"; id: string }
  | { type: "theme"; theme: string };

/** Immutably sets a value along a path. Number fields stay numbers. */
function setIn<T>(obj: T, path: EditPath, value: string): T {
  if (!path.length) return obj;
  const [head, ...rest] = path;
  const container = (Array.isArray(obj) ? [...obj] : { ...(obj as object) }) as Record<string | number, unknown>;
  if (rest.length) {
    container[head] = setIn(container[head], rest, value);
  } else if (typeof container[head] === "number") {
    const n = parseFloat(value.replace(/['’\s]/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) container[head] = Math.max(0, n);
  } else {
    container[head] = value;
  }
  return container as T;
}

export function deckReducer(deck: Deck | null, action: DeckAction): Deck | null {
  if (action.type === "set") return action.deck;
  if (!deck) return deck;
  switch (action.type) {
    case "edit": {
      const value = action.value;
      const slides = deck.slides.map((s) => (s.id === action.id ? setIn(s, action.path, value) : s));
      // The title of the first slide is also the deck title
      const title = action.path[0] === "title" && deck.slides[0]?.id === action.id ? value : deck.title;
      return { ...deck, title, slides };
    }
    case "replace":
      return { ...deck, slides: deck.slides.map((s) => (s.id === action.id ? action.slide : s)) };
    case "move": {
      const slides = [...deck.slides];
      const [moved] = slides.splice(action.from, 1);
      slides.splice(action.to, 0, moved);
      return { ...deck, slides };
    }
    case "delete":
      return deck.slides.length > 1 ? { ...deck, slides: deck.slides.filter((s) => s.id !== action.id) } : deck;
    case "theme":
      return { ...deck, theme: action.theme };
  }
}

/* -------------------------------- Storage -------------------------------- */

const KEY = "explainer.deck.v2";

export function loadStoredDeck(): Deck | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = DeckSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function storeDeck(deck: Deck | null) {
  try {
    if (deck) localStorage.setItem(KEY, JSON.stringify(deck));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked – not critical */
  }
}

/** Reads a deck JSON file and validates it. */
export async function parseDeckFile(file: File): Promise<Deck> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  const parsed = DeckSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`This file is not an Explainer deck (${issue?.path.join(".") || "root"}: ${issue?.message}).`);
  }
  return parsed.data;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "deck";
