import type { Provider } from "../../shared/schema";
import { UserError } from "../errors";
import { callAnthropicApi } from "./anthropicApi";
import { callClaudeCode, checkClaudeLogin, findClaudeCli } from "./claudeCode";
import type { LlmCall } from "./types";

export { mapApiError } from "./anthropicApi";
export { FormatError, settings, type LlmCall } from "./types";

/* ------------------------------------------------------------------ *
 * Which way do model calls go?
 *   LLM_PROVIDER=auto (default): API key if set, else Claude Code login
 *   LLM_PROVIDER=api | subscription | mock
 * ------------------------------------------------------------------ */

const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());

export function activeProvider(): Provider {
  const wanted = (process.env.LLM_PROVIDER?.trim().toLowerCase() || "auto") as Provider | "auto";
  if (wanted === "mock" || process.env.MOCK_LLM === "1") return "mock";
  if (wanted === "api") return "api";
  if (wanted === "subscription") return "subscription";
  if (hasApiKey()) return "api";
  return findClaudeCli() ? "subscription" : "none";
}

/** Result of the (free, local) login check – refreshed in the background. */
let subscriptionLogin: boolean | null = null;
export async function refreshSubscriptionStatus(): Promise<boolean | null> {
  const cli = findClaudeCli();
  subscriptionLogin = cli ? await checkClaudeLogin(cli) : false;
  return subscriptionLogin;
}
export const subscriptionLoggedIn = () => subscriptionLogin;

export async function callModel(call: LlmCall): Promise<unknown> {
  switch (activeProvider()) {
    case "api":
      return callAnthropicApi(call);
    case "subscription": {
      const cli = findClaudeCli();
      if (!cli) {
        throw new UserError("Claude Code was not found.", "Install Claude Code and log in, set CLAUDE_CLI_PATH, or set ANTHROPIC_API_KEY.", 500);
      }
      return callClaudeCode(call, cli);
    }
    default:
      throw new UserError(
        "No way to reach Claude is set up.",
        "Either log in to Claude Code with your Claude subscription (run `claude` once), or set ANTHROPIC_API_KEY in .env. LLM_PROVIDER=mock starts a demo mode.",
        401,
      );
  }
}
