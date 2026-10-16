import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import { InputPanel } from "./components/InputPanel";
import { Presenter } from "./components/Presenter";
import { ProgressPanel, type ProgressState } from "./components/ProgressPanel";
import { Storyboard } from "./components/Storyboard";
import { ApiError, generate } from "./lib/api";
import { deckReducer, loadStoredDeck, parseDeckFile, storeDeck } from "./lib/deck";
import { getTheme, THEMES, themeVars } from "./theme/themes";

// Export code (html-to-image, jsPDF) is only loaded when needed
const exporter = () => import("./lib/export");

type View = "input" | "progress" | "deck";
type UiError = { message: string; hint?: string };

const prefs = {
  get animate() {
    return localStorage.getItem("explainer.animate") !== "0";
  },
  set animate(v: boolean) {
    localStorage.setItem("explainer.animate", v ? "1" : "0");
  },
};

export function App() {
  const [deck, dispatch] = useReducer(deckReducer, null, loadStoredDeck);
  const [view, setView] = useState<View>(() => (deck ? "deck" : "input"));
  const [lastInput, setLastInput] = useState("");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [animate, setAnimate] = useState(prefs.animate);
  const [toast, setToast] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => storeDeck(deck), [deck]);
  useEffect(() => {
    prefs.animate = animate;
  }, [animate]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const theme = getTheme(deck?.theme);

  const run = useCallback(async (input: string) => {
    setLastInput(input);
    setError(null);
    setView("progress");
    const startedAt = Date.now();
    setProgress({ stage: "ingest", message: "Starting …", done: 0, total: 0, infos: [], startedAt });
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await generate(
        { input },
        (e) => {
          switch (e.type) {
            case "stage":
              setProgress((p) => p && { ...p, stage: e.stage, message: e.message });
              break;
            case "info":
              setProgress((p) => p && { ...p, infos: [...p.infos, e.message] });
              break;
            case "progress":
              setProgress((p) => p && { ...p, done: e.done, total: e.total });
              break;
            case "result":
              dispatch({ type: "set", deck: e.deck });
              setView("deck");
              setToast(`${e.deck.slides.length} slides in ${Math.round((Date.now() - startedAt) / 1000)} s.`);
              break;
            case "error":
              setError({ message: e.message, hint: e.hint });
              setView("input");
              break;
          }
        },
        ctrl.signal,
      );
    } catch (e) {
      if (ctrl.signal.aborted) {
        setView("input");
        return;
      }
      setError(e instanceof ApiError ? { message: e.message, hint: e.hint } : { message: "Unexpected error.", hint: String(e) });
      setView("input");
    } finally {
      abort.current = null;
    }
  }, []);

  const loadFile = async (file: File) => {
    try {
      const loaded = await parseDeckFile(file);
      dispatch({ type: "set", deck: loaded });
      setError(null);
      setView("deck");
      setToast(`Opened "${loaded.title}".`);
    } catch (e) {
      setError({ message: (e as Error).message, hint: 'Only files saved with "Save JSON" can be opened.' });
      setView("input");
    }
  };

  const withToast = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      setToast(`${label} failed: ${(e as Error).message}`);
    }
  };

  const exportPdf = () =>
    deck &&
    withToast("PDF export", () =>
      exporter().then((m) =>
        m.exportDeckPdf(deck, (done, total) => setToast(done < total ? `Creating PDF … slide ${done + 1} of ${total}` : "PDF saved.")),
      ),
    );
  const exportPng = (i: number) =>
    deck &&
    withToast("PNG export", async () => {
      setToast(`Creating PNG of slide ${i + 1} …`);
      await (await exporter()).exportSlidePng(deck, i);
      setToast(`Slide ${i + 1} saved as PNG.`);
    });

  return (
    <div className="app" style={themeVars(theme) as React.CSSProperties}>
      <header className="topbar">
        <button className="logo" onClick={() => deck && view !== "progress" && setView("deck")} title="Explainer">
          Explainer
          <svg viewBox="0 0 120 12" aria-hidden>
            <path d="M2 8 Q 30 4 60 7 T 118 6" />
          </svg>
        </button>
        {view === "deck" && deck && (
          <>
            <div className="deck-info">
              <strong>{deck.title}</strong>
              <span className="muted">
                {deck.slides.length} slides · {deck.source.label}
              </span>
            </div>
            <nav className="actions">
              <button className="btn" onClick={() => setView("input")}>
                New
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                Open
              </button>
              <button className="btn" onClick={() => exporter().then((m) => m.exportDeckJson(deck))}>
                Save JSON
              </button>
              <button className="btn" onClick={exportPdf}>
                PDF
              </button>
              <label className="toggle" title="Lines draw one after another, then the text fades in">
                <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
                Animate
              </label>
              <select value={deck.theme} onChange={(e) => dispatch({ type: "theme", theme: e.target.value })} aria-label="Style">
                {Object.values(THEMES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="btn primary" onClick={() => setPresenting(0)}>
                Present
              </button>
            </nav>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </header>

      {view === "input" && (
        <InputPanel
          initialInput={lastInput}
          error={error}
          hasDeck={!!deck}
          onSubmit={run}
          onLoadFile={loadFile}
          onBackToDeck={() => {
            setError(null);
            setView("deck");
          }}
        />
      )}

      {view === "progress" && progress && <ProgressPanel state={progress} onCancel={() => abort.current?.abort()} />}

      {view === "deck" && deck && (
        <Storyboard
          deck={deck}
          onOpen={setEditing}
          onPresent={setPresenting}
          onMove={(from, to) => dispatch({ type: "move", from, to })}
          onDelete={(id) => dispatch({ type: "delete", id })}
          onPng={exportPng}
        />
      )}

      {deck && editing !== null && presenting === null && editing < deck.slides.length && (
        <Editor
          deck={deck}
          index={editing}
          animate={animate}
          onIndex={setEditing}
          onClose={() => setEditing(null)}
          onEdit={(id, path, value) => dispatch({ type: "edit", id, path, value })}
          onReplace={(id, slide) => dispatch({ type: "replace", id, slide })}
          onDelete={(id) => dispatch({ type: "delete", id })}
          onPng={exportPng}
          onPresent={(i) => setPresenting(i)}
        />
      )}

      {deck && presenting !== null && (
        <Presenter
          deck={deck}
          start={presenting}
          animate={animate}
          onClose={(last) => {
            setPresenting(null);
            if (editing !== null) setEditing(last);
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
