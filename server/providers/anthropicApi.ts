import Anthropic from "@anthropic-ai/sdk";
import { UserError } from "../errors";
import { SYSTEM_PROMPT } from "../prompts";
import { FormatError, logCall, settings, type LlmCall } from "./types";

/* ------------------------------------------------------------------ *
 * Provider "api": Anthropic SDK with ANTHROPIC_API_KEY.
 * Streams every answer (long outputs, progress) and constrains it to
 * the JSON schema via structured outputs.
 * ------------------------------------------------------------------ */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    try {
      client = new Anthropic();
    } catch (e) {
      throw new UserError("The Anthropic client could not start.", `Set ANTHROPIC_API_KEY in .env and restart. (${(e as Error).message})`, 500);
    }
  }
  return client;
}

/** Turns false if the API rejects the schema as structured output; the schema then goes into the prompt. */
let structuredOutputs = true;

export async function callAnthropicApi(call: LlmCall): Promise<unknown> {
  const { source, task, schema, maxTokens, label, onText, signal } = call;
  const content: Anthropic.Beta.BetaTextBlockParam[] = [];
  if (source) content.push({ type: "text", text: source, cache_control: { type: "ephemeral" } });
  content.push({
    type: "text",
    text: structuredOutputs ? task : `${task}\n\nAnswer with JSON only, matching this JSON schema:\n${JSON.stringify(schema)}`,
  });

  const started = Date.now();
  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = getClient().beta.messages.stream(
      {
        model: settings.model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        output_config: {
          ...(settings.effort ? { effort: settings.effort } : {}),
          ...(structuredOutputs ? { format: { type: "json_schema", schema } } : {}),
        },
        // If the model declines for safety reasons, a fallback model takes over server-side.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    );
    if (onText) stream.on("text", (_delta, snapshot) => onText(snapshot));
    message = await stream.finalMessage();
  } catch (e) {
    if (structuredOutputs && e instanceof Anthropic.BadRequestError && /schema|output_config|format/i.test(e.message)) {
      console.warn(`[llm] structured output rejected, falling back to schema-in-prompt: ${e.message}`);
      structuredOutputs = false;
      return callAnthropicApi(call);
    }
    throw mapApiError(e);
  }

  const u = message.usage;
  logCall(
    label,
    started,
    `api model=${message.model}, in=${u.input_tokens}, cache_read=${u.cache_read_input_tokens ?? 0}, out=${u.output_tokens}, stop=${message.stop_reason}`,
  );

  if (message.stop_reason === "refusal") {
    throw new UserError("The model declined this request.", "Check the content or try a different text.", 422);
  }
  if (message.stop_reason === "max_tokens") throw new FormatError("the answer was cut off (too long) – be more concise");

  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return JSON.parse(structuredOutputs ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    throw new FormatError("the answer was not valid JSON");
  }
}

export function mapApiError(e: unknown): Error {
  if (e instanceof UserError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new UserError("Cancelled.");
  if (e instanceof Anthropic.AuthenticationError) {
    return new UserError("The Anthropic API key is missing or invalid.", "Check ANTHROPIC_API_KEY in .env and restart the server.", 401);
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return new UserError(`No access to the model "${settings.model}".`, "Check ANTHROPIC_MODEL in .env.", 403);
  }
  if (e instanceof Anthropic.NotFoundError) {
    return new UserError(`Model "${settings.model}" not found.`, "Check ANTHROPIC_MODEL in .env.", 404);
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new UserError("Anthropic API rate limit reached.", "Wait a moment and try again.", 429);
  }
  if (e instanceof Anthropic.BadRequestError) {
    return new UserError("The Anthropic API rejected the request.", e.message, 400);
  }
  if (e instanceof Anthropic.InternalServerError) {
    return new UserError("The Anthropic API is overloaded or down.", "Try again in a minute.", 503);
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new UserError("The Anthropic API is not reachable.", "Check your internet connection and try again.", 502);
  }
  if (e instanceof Anthropic.APIError) {
    return new UserError(`Anthropic API error (${e.status ?? "?"}).`, e.message, 502);
  }
  if (e instanceof Anthropic.AnthropicError) {
    // Not an API error but a client error – usually missing credentials.
    if (/auth|api.?key/i.test(e.message)) {
      return new UserError("No Anthropic API key found.", "Set ANTHROPIC_API_KEY in .env (see .env.example) and restart – or use your Claude subscription via Claude Code.", 401);
    }
    return new UserError("The Anthropic client reported an error.", e.message, 500);
  }
  return e instanceof Error ? e : new Error(String(e));
}
