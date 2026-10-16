import { ingestGithub, parseGithubUrl } from "./github";
import { ingestLocal, looksLikePath } from "./local";
import { ingestText } from "./text";
import type { IngestResult } from "./types";

export type { IngestResult } from "./types";

export function detectKind(input: string): "github" | "local" | "text" {
  const s = input.trim();
  if (!s.includes("\n") && parseGithubUrl(s)) return "github";
  if (looksLikePath(s)) return "local";
  return "text";
}

export async function ingest(input: string, budget: number): Promise<IngestResult> {
  switch (detectKind(input)) {
    case "github":
      return ingestGithub(input, budget);
    case "local":
      return ingestLocal(input, budget);
    default:
      return ingestText(input, budget);
  }
}
