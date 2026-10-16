import type { GenerateRequest, Health, ProgressEvent, RegenerateRequest, Slide } from "../../shared/schema";

export class ApiError extends Error {
  constructor(
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}

const OFFLINE = new ApiError("The Explainer server is not reachable.", "Is `npm run dev` running? The backend starts on port 8787.");

async function errorFrom(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  if (body?.error) return new ApiError(body.error, body.hint);
  if (res.status >= 500) return OFFLINE;
  return new ApiError(`Request failed (${res.status}).`);
}

export async function fetchHealth(): Promise<Health | null> {
  try {
    const res = await fetch("/api/health");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Starts the generation and reports every server event (SSE over fetch). */
export async function generate(req: GenerateRequest, onEvent: (e: ProgressEvent) => void, signal: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (e) {
    if (signal.aborted) throw e;
    throw OFFLINE;
  }
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const event = JSON.parse(line.slice(5)) as ProgressEvent;
        if (event.type === "result" || event.type === "error") finished = true;
        onEvent(event);
      }
    }
  }
  if (!finished) throw new ApiError("The connection to the server was interrupted.", "Please try again.");
}

export async function regenerateSlide(req: RegenerateRequest): Promise<Slide> {
  let res: Response;
  try {
    res = await fetch("/api/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    throw OFFLINE;
  }
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()).slide as Slide;
}
