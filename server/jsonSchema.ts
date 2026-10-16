import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Zod → JSON schema for structured outputs. Keeps enum/const (the SDK
 * helper moves them into the description) and only moves unsupported
 * constraints (lengths, number ranges) into the description, so the
 * model still sees them.
 * ------------------------------------------------------------------ */

const UNSUPPORTED = ["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "maxItems", "pattern"];

type Json = Record<string, unknown>;

function strict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strict);
  if (!node || typeof node !== "object") return node;
  const src = { ...(node as Json) };
  delete src.$schema;
  if (src.oneOf) {
    src.anyOf = src.oneOf;
    delete src.oneOf;
  }
  const hints: string[] = [];
  for (const key of UNSUPPORTED) {
    if (key in src) {
      hints.push(`${key}: ${JSON.stringify(src[key])}`);
      delete src[key];
    }
  }
  if (typeof src.minItems === "number" && src.minItems > 1) {
    hints.push(`minItems: ${src.minItems}`);
    delete src.minItems;
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = k === "properties" || k === "$defs"
      ? Object.fromEntries(Object.entries(v as Json).map(([pk, pv]) => [pk, strict(pv)]))
      : strict(v);
  }
  if (out.type === "object") out.additionalProperties = false;
  if (hints.length) out.description = [out.description, `{${hints.join(", ")}}`].filter(Boolean).join("\n\n");
  return out;
}

export function toOutputSchema(schema: z.ZodType): Json {
  return strict(z.toJSONSchema(schema, { reused: "ref", io: "output" })) as Json;
}
