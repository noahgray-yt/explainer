import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GenerateRequestSchema, RegenerateRequestSchema, type Health, type ProgressEvent } from "../shared/schema";
import { UserError } from "./errors";
import { generateDeck, regenerate } from "./pipeline";
import { activeProvider, mapApiError, refreshSubscriptionStatus, settings, subscriptionLoggedIn } from "./providers";

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const HOST = "127.0.0.1";

// Local requests only (also guards against DNS rebinding – the server can read local folders)
app.use((req, res, next) => {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    res.status(403).json({ error: "Only local requests are allowed." });
    return;
  }
  next();
});
app.use(express.json({ limit: "4mb" }));

const describeError = (e: unknown) => {
  const err = mapApiError(e);
  if (err instanceof UserError) return { status: err.status, message: err.message, hint: err.hint };
  console.error(err);
  return { status: 500, message: "Unexpected server error.", hint: err.message };
};

app.get("/api/health", async (_req, res) => {
  let provider = activeProvider();
  if (provider === "subscription") {
    const login = subscriptionLoggedIn() ?? (await refreshSubscriptionStatus());
    if (!login) provider = "none";
  }
  const body: Health = { ok: true, provider, model: settings.model, github: Boolean(process.env.GITHUB_TOKEN) };
  res.json(body);
});

/** Generation as server-sent events: stage/info/progress … result | error */
app.post("/api/generate", async (req, res) => {
  const parsed = GenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // If the browser cancels, stop the model calls too (saves usage)
  const abort = new AbortController();
  let finished = false;
  res.on("close", () => !finished && abort.abort());
  const emit = (e: ProgressEvent) => {
    if (!abort.signal.aborted) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };
  // Heartbeat keeps proxies from closing the connection during long model calls
  const beat = setInterval(() => !abort.signal.aborted && res.write(": ping\n\n"), 10_000);

  try {
    const deck = await generateDeck(parsed.data, emit, abort.signal);
    emit({ type: "result", deck });
  } catch (e) {
    if (abort.signal.aborted) {
      console.log("[generate] cancelled by the client");
    } else {
      const { message, hint } = describeError(e);
      console.warn(`[generate] ${message}${hint ? ` – ${hint}` : ""}`);
      emit({ type: "error", message, hint });
    }
  } finally {
    finished = true;
    clearInterval(beat);
    res.end();
  }
});

app.post("/api/regenerate", async (req, res) => {
  const parsed = RegenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request.", hint: parsed.error.issues[0]?.message });
    return;
  }
  try {
    res.json({ slide: await regenerate(parsed.data) });
  } catch (e) {
    const { status, message, hint } = describeError(e);
    res.status(status).json({ error: message, hint });
  }
});

// Production: serve the built frontend
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const { status, message, hint } = describeError(err);
  res.status(status).json({ error: message, hint });
});

app.listen(PORT, HOST, async () => {
  console.log(`Explainer server running on http://${HOST}:${PORT}`);
  const provider = activeProvider();
  const how = {
    api: "Anthropic API (ANTHROPIC_API_KEY)",
    subscription: "Claude subscription via Claude Code",
    mock: "demo mode, no model calls",
    none: "not configured",
  }[provider];
  console.log(`Model: ${settings.model} · ${how}`);
  if (provider === "subscription" && !(await refreshSubscriptionStatus())) {
    console.warn("⚠ Claude Code is installed but not logged in – run `claude` once and log in.");
  }
  if (provider === "none") {
    console.warn("⚠ No model access: log in to Claude Code (`claude`) or set ANTHROPIC_API_KEY in .env. LLM_PROVIDER=mock starts a demo.");
  }
});
