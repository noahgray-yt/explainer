import { useEffect, useMemo, useRef, useState } from "react";
import type { Health } from "../../shared/schema";
import sample from "../../examples/sample.md?raw";
import { fetchHealth } from "../lib/api";

interface Props {
  initialInput: string;
  error: { message: string; hint?: string } | null;
  hasDeck: boolean;
  onSubmit: (input: string) => void;
  onLoadFile: (file: File) => void;
  onBackToDeck: () => void;
}

function detect(input: string): { kind: "github" | "local" | "text" | "empty"; label: string } {
  const s = input.trim();
  if (!s) return { kind: "empty", label: "" };
  if (!s.includes("\n") && /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+/i.test(s)) return { kind: "github", label: "GitHub repo" };
  if (!s.includes("\n") && /^(~|\/|\.{1,2}\/|[A-Za-z]:[\\/])/.test(s)) return { kind: "local", label: "Local folder" };
  return { kind: "text", label: `Text · ${s.split(/\s+/).length.toLocaleString("en-US")} words` };
}

const PROVIDER_LABEL: Record<Health["provider"], string> = {
  subscription: "your Claude subscription (Claude Code)",
  api: "Anthropic API key",
  mock: "demo mode – no AI",
  none: "not connected",
};

export function InputPanel({ initialInput, error, hasDeck, onSubmit, onLoadFile, onBackToDeck }: Props) {
  const [input, setInput] = useState(initialInput);
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const kind = useMemo(() => detect(input), [input]);

  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);

  const submit = () => kind.kind !== "empty" && onSubmit(input);

  return (
    <main className="input-page">
      <section className="card input-card">
        <h1 className="hand-title">What should we explain?</h1>
        <p className="muted">Paste text or Markdown, a GitHub URL or a local folder path. You get 12–25 simple sketch slides.</p>

        {error && (
          <div className="error-box" role="alert">
            <strong>{error.message}</strong>
            {error.hint && <span>{error.hint}</span>}
          </div>
        )}

        <textarea
          className="source-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={"e.g.\n• an article or notes (Markdown)\n• https://github.com/owner/repo\n• /Users/you/projects/my-tool"}
          spellCheck={false}
          autoFocus
        />

        <div className="input-row">
          <span className={`badge badge-${kind.kind}`}>{kind.kind === "empty" ? "Empty" : `Detected: ${kind.label}`}</span>
          <span className="muted small">⌘/Ctrl + Enter to start</span>
        </div>

        <div className="input-actions">
          <button className="btn primary" disabled={kind.kind === "empty"} onClick={submit}>
            Create slides
          </button>
          <button className="btn" onClick={() => setInput(sample)}>
            Use sample text
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Open deck (JSON)
          </button>
          {hasDeck && (
            <button className="btn ghost" onClick={onBackToDeck}>
              Back to current deck →
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onLoadFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <p className="status-line">
          {health === undefined && "Connecting to the server …"}
          {health === null && <span className="warn">Server not reachable – is `npm run dev` running?</span>}
          {health && (
            <>
              <span className={`dot-status ${health.provider === "none" ? "off" : "on"}`} />
              Model <code>{health.model}</code> via {PROVIDER_LABEL[health.provider]}
              {health.provider === "none" && (
                <span className="warn"> – run `claude` once and log in, or set ANTHROPIC_API_KEY in .env</span>
              )}
              {!health.github && <span className="muted"> · GitHub without token (60 requests/hour)</span>}
            </>
          )}
        </p>
      </section>
    </main>
  );
}
