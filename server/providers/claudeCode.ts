import { spawn } from "node:child_process";
import { accessSync, constants, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { UserError } from "../errors";
import { SYSTEM_PROMPT } from "../prompts";
import { FormatError, logCall, settings, type LlmCall } from "./types";

/* ------------------------------------------------------------------ *
 * Provider "subscription": runs the locally installed Claude Code CLI
 * in headless mode (`claude -p`). It uses the Claude.ai login of
 * Claude Code, so no API key is needed – calls count towards your
 * Claude plan's usage limits.
 * ------------------------------------------------------------------ */

const TIMEOUT_MS = 6 * 60_000;

/** Looks for the `claude` binary: CLAUDE_CLI_PATH, PATH, then the usual install locations. */
export function findClaudeCli(): string | null {
  const home = os.homedir();
  const candidates = [
    process.env.CLAUDE_CLI_PATH,
    ...(process.env.PATH ?? "").split(path.delimiter).map((d) => d && path.join(d, "claude")),
    path.join(home, ".claude", "local", "claude"),
    path.join(home, ".local", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      accessSync(c, constants.X_OK);
      return c;
    } catch {
      /* not here */
    }
  }
  return null;
}

/**
 * Environment for the child process: without the API key (so the
 * subscription login is used) and without the markers of a surrounding
 * Claude Code session (the server may itself be started from one).
 */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_AGENT_SDK)/.test(key)) delete env[key];
  }
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

/** Empty working directory, so no project files or CLAUDE.md get picked up. */
function workDir(): string {
  const dir = path.join(os.tmpdir(), "explainer-claude");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Is Claude Code logged in? Runs the local, free `claude auth status`. */
export function checkClaudeLogin(cli: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cli, ["auth", "status"], { env: childEnv(), cwd: workDir() });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => resolve(false));
    child.on("close", () => {
      try {
        resolve(Boolean(JSON.parse(out).loggedIn));
      } catch {
        resolve(/logged in/i.test(out) && !/not logged in/i.test(out));
      }
    });
  });
}

function explain(message: string): UserError {
  if (/not logged in|log ?in|\/login|authenticat|credential|oauth/i.test(message)) {
    return new UserError("Claude Code is not logged in.", "Run `claude` once in a terminal and log in with your Claude account.", 401);
  }
  if (/(session|usage|weekly|rate) limit|limit reached|hit your .*limit|quota|overloaded/i.test(message)) {
    const reset = message.match(/resets?\s+([^·\n]+)/i)?.[1]?.trim();
    return new UserError(
      "Your Claude plan's usage limit is reached for now.",
      `${reset ? `It resets ${reset}. ` : ""}Wait until then, or set ANTHROPIC_API_KEY in .env to use the API instead.`,
      429,
    );
  }
  if (/model/i.test(message) && /not (found|available|supported)|invalid/i.test(message)) {
    return new UserError(`Model "${settings.model}" is not available in Claude Code.`, "Set ANTHROPIC_MODEL in .env (e.g. claude-sonnet-5-5 or sonnet).", 400);
  }
  return new UserError("Claude Code reported an error.", message.slice(0, 400), 502);
}

export function callClaudeCode(call: LlmCall, cli: string): Promise<unknown> {
  const { source, task, schema, label, onText, signal } = call;
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    settings.model,
    "--system-prompt",
    SYSTEM_PROMPT,
    "--json-schema",
    JSON.stringify(schema),
    // Plain text-in / JSON-out: no tools, no MCP servers, no settings, no saved session
    "--tools",
    "",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--no-session-persistence",
  ];
  if (settings.effort) args.push("--effort", settings.effort);
  const prompt = source ? `${source}\n\n${task}` : task;

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(cli, args, { env: childEnv(), cwd: workDir(), stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    let partial = "";
    let stderr = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onAbort = () => {
      child.kill("SIGTERM");
      finish(() => reject(new UserError("Cancelled.")));
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => reject(new UserError("Claude Code took too long to answer.", "Try a shorter text or try again.", 504)));
    }, TIMEOUT_MS);
    signal?.addEventListener("abort", onAbort);

    const handle = (line: string) => {
      if (!line.trim()) return;
      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "stream_event") {
        const delta = event.event?.delta;
        const piece = delta?.type === "input_json_delta" ? delta.partial_json : delta?.type === "text_delta" ? delta.text : "";
        if (piece) {
          partial += piece;
          onText?.(partial);
        }
        return;
      }
      if (event.type !== "result") return;
      const usage = event.usage ?? {};
      logCall(
        label,
        started,
        `subscription model=${settings.model}, in=${usage.input_tokens ?? "?"}, cache_read=${usage.cache_read_input_tokens ?? 0}, out=${usage.output_tokens ?? "?"}, turns=${event.num_turns}`,
      );
      if (event.is_error || event.subtype !== "success") {
        finish(() => reject(explain(String(event.result ?? event.subtype ?? "unknown error"))));
        return;
      }
      if (event.structured_output !== undefined && event.structured_output !== null) {
        finish(() => resolve(event.structured_output));
        return;
      }
      try {
        const text = String(event.result ?? "");
        finish(() => resolve(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1))));
      } catch {
        finish(() => reject(new FormatError("the answer was not valid JSON")));
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e: NodeJS.ErrnoException) =>
      finish(() =>
        reject(
          e.code === "ENOENT"
            ? new UserError("Claude Code was not found.", "Install Claude Code and log in, or set ANTHROPIC_API_KEY in .env.", 500)
            : new UserError("Claude Code could not be started.", e.message, 500),
        ),
      ),
    );
    child.on("close", (code) => {
      if (buffer) handle(buffer);
      finish(() => reject(explain(stderr.trim() || `Claude Code exited with code ${code} without an answer.`)));
    });
    child.stdin.end(prompt);
  });
}
