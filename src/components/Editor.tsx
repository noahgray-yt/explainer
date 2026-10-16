import { useEffect, useState } from "react";
import { LIMITS } from "../../shared/lint";
import { bodyTexts, countWords, TEMPLATE_LABELS, TEMPLATES, type Deck, type Slide, type TemplateName } from "../../shared/schema";
import { ApiError, regenerateSlide } from "../lib/api";
import type { EditPath } from "../templates/types";
import { SlideView } from "./SlideView";

interface Props {
  deck: Deck;
  index: number;
  animate: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onEdit: (id: string, path: EditPath, value: string) => void;
  onReplace: (id: string, slide: Slide) => void;
  onDelete: (id: string) => void;
  onPng: (index: number) => void;
  onPresent: (index: number) => void;
}

function WordCount({ label, n, max }: { label: string; n: number; max: number }) {
  return (
    <span className={n > max ? "over" : ""}>
      {label} {n}/{max}
    </span>
  );
}

export function Editor({ deck, index, animate, onIndex, onClose, onEdit, onReplace, onDelete, onPng, onPresent }: Props) {
  const slide = deck.slides[index];
  const [template, setTemplate] = useState<TemplateName | "">("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    setTemplate("");
    setHint("");
    setError(null);
  }, [slide?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < deck.slides.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, deck.slides.length, onClose, onIndex]);

  if (!slide) return null;

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const fresh = await regenerateSlide({
        deckId: deck.id,
        deckTitle: deck.title,
        slide,
        prev: deck.slides[index - 1] ?? null,
        next: deck.slides[index + 1] ?? null,
        template: template || null,
        hint,
      });
      onReplace(slide.id, { ...fresh, id: slide.id });
      setReplay((r) => r + 1);
    } catch (e) {
      setError(e instanceof ApiError ? { message: e.message, hint: e.hint } : { message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const bodyWords = bodyTexts(slide).reduce((n, t) => n + countWords(t), 0);

  return (
    <div className="modal" role="dialog" aria-modal aria-label={`Edit slide ${index + 1}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="editor">
        <div className="editor-stage">
          <SlideView
            key={`${slide.id}-${replay}`}
            deck={deck}
            index={index}
            editable={!busy}
            animate={animate && replay > 0}
            onEdit={(path, value) => onEdit(slide.id, path, value)}
            className={busy ? "busy" : ""}
          />
          <p className="muted center small">Click any text on the slide to change it · Enter saves, Esc cancels</p>
        </div>

        <aside className="editor-side">
          <div className="side-head">
            <button className="btn small" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous slide">
              ←
            </button>
            <strong>
              Slide {index + 1} of {deck.slides.length}
            </strong>
            <button className="btn small" disabled={index === deck.slides.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next slide">
              →
            </button>
            <button className="btn small ghost close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <p className="words">
            <WordCount label="Title" n={countWords(slide.title)} max={LIMITS.titleWords} /> ·{" "}
            <WordCount label="Closing line" n={countWords(slide.takeaway)} max={LIMITS.takeawayWords} /> ·{" "}
            <WordCount label="Body" n={bodyWords} max={slide.template === "prompt-list" ? LIMITS.bodyWords + 15 : LIMITS.bodyWords} />
          </p>

          <fieldset className="regen">
            <legend>Regenerate this slide</legend>
            <label>
              Template
              <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateName | "")} disabled={busy}>
                <option value="">Keep ({TEMPLATE_LABELS[slide.template]})</option>
                {TEMPLATES.filter((t) => t !== slide.template).map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Wish (optional)
              <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder='e.g. "simpler", "add an example"' maxLength={300} disabled={busy} />
            </label>
            <button className="btn primary" onClick={regenerate} disabled={busy}>
              {busy ? "Regenerating …" : "Regenerate this slide"}
            </button>
            {error && (
              <div className="error-box small" role="alert">
                <strong>{error.message}</strong>
                {error.hint && <span>{error.hint}</span>}
              </div>
            )}
          </fieldset>

          <div className="side-actions">
            <button className="btn" onClick={() => setReplay((r) => r + 1)} disabled={!animate} title={animate ? "" : "Drawing animation is turned off"}>
              Replay animation
            </button>
            <button className="btn" onClick={() => onPresent(index)}>
              Present from here
            </button>
            <button className="btn" onClick={() => onPng(index)}>
              Save as PNG
            </button>
            <button
              className="btn danger"
              disabled={deck.slides.length <= 1}
              onClick={() => {
                if (confirm(`Delete slide ${index + 1}?`)) {
                  onDelete(slide.id);
                  onIndex(Math.max(0, index - 1));
                }
              }}
            >
              Delete slide
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
