import { useEffect, useState } from "react";

export type Stage = "ingest" | "outline" | "slides" | "repair" | "done";

export interface ProgressState {
  stage: Stage;
  message: string;
  done: number;
  total: number;
  infos: string[];
  startedAt: number;
}

const STEPS: { stage: Stage; label: string }[] = [
  { stage: "ingest", label: "Read the source" },
  { stage: "outline", label: "Plan the storyline" },
  { stage: "slides", label: "Write the slides" },
  { stage: "repair", label: "Polish" },
];
const ORDER: Stage[] = ["ingest", "outline", "slides", "repair", "done"];

export function ProgressPanel({ state, onCancel }: { state: ProgressState; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const current = ORDER.indexOf(state.stage);
  const secs = Math.floor((now - state.startedAt) / 1000);
  const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
  const steps = STEPS.filter((s) => s.stage !== "repair" || state.stage === "repair");
  const width = state.stage === "slides" ? Math.max(12, 12 + pct * 0.86) : state.stage === "ingest" ? 3 : state.stage === "outline" ? 8 : 100;

  return (
    <main className="input-page">
      <section className="card progress-card" aria-live="polite">
        <h1 className="hand-title">Sketching your slides …</h1>
        <ol className="steps">
          {steps.map((s) => {
            const i = ORDER.indexOf(s.stage);
            const status = i < current ? "done" : i === current ? "active" : "todo";
            return (
              <li key={s.stage} className={status}>
                <span className="dot" aria-hidden>
                  {status === "done" ? "✓" : ""}
                </span>
                {s.label}
                {s.stage === "slides" && state.total > 0 && (status === "active" || status === "done") && (
                  <span className="count">
                    {status === "done" ? state.total : state.done} / {state.total}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="bar" aria-hidden>
          <div className="bar-fill" style={{ width: `${width}%` }} />
        </div>
        <p className="muted">
          {state.message} · {secs} s
        </p>
        <ul className="infos">
          {state.infos.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </section>
    </main>
  );
}
