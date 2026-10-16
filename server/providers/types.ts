/** One model call: system prompt + (cached) source + task, answered as JSON matching `schema`. */
export interface LlmCall {
  source: string | null;
  task: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  label: string;
  /** Receives the growing raw output – used to count finished slides. */
  onText?: (snapshot: string) => void;
  signal?: AbortSignal;
}

/** The answer was not valid JSON or got cut off – triggers the one retry. */
export class FormatError extends Error {}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const settings = {
  get model() {
    return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
  },
  get effort(): Effort | null {
    const e = (process.env.ANTHROPIC_EFFORT?.trim() || "low") as Effort | "default";
    // Haiku 4.5 has no effort parameter
    if (e === "default" || /haiku/.test(this.model)) return null;
    return e;
  },
};

/** Logs duration and token usage of a finished call. */
export function logCall(label: string, startedAt: number, details: string) {
  console.log(`[llm] ${label}: ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ${details}`);
}
