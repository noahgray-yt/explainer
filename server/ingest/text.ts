import type { IngestResult } from "./types";

export function ingestText(input: string, budget: number): IngestResult {
  const text = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "Text";
  const label = firstLine.replace(/^#+\s*/, "").slice(0, 60);
  if (text.length <= budget) return { kind: "text", label, text, truncated: false };
  return { kind: "text", label, text: text.slice(0, budget) + "\n[… truncated]", truncated: true };
}
