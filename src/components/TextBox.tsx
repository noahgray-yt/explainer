import { useCallback, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { useFontsReady } from "../lib/fonts";
import { useSlideEnv, type TextSpec } from "../templates/types";

export interface TextMetrics {
  /** Last line, relative to the box (for the underline) */
  left: number;
  top: number;
  width: number;
  height: number;
  /** End of the first line (for the sparkle) */
  firstRight: number;
  firstTop: number;
}

/** Line positions relative to the box, in unscaled design pixels. */
function lineMetrics(box: HTMLElement, inner: HTMLElement): TextMetrics {
  const fallback = {
    left: inner.offsetLeft,
    top: inner.offsetTop,
    width: inner.offsetWidth,
    height: inner.offsetHeight,
    firstRight: inner.offsetLeft + inner.offsetWidth,
    firstTop: inner.offsetTop,
  };
  const range = document.createRange();
  range.selectNodeContents(inner);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0);
  const outer = box.getBoundingClientRect();
  const scale = outer.width / (box.offsetWidth || 1);
  if (!rects.length || !scale) return fallback;
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const top = Math.min(...rects.map((r) => r.top));
  const last = rects.filter((r) => Math.abs(r.bottom - bottom) < 4);
  const first = rects.filter((r) => Math.abs(r.top - top) < 4);
  const left = Math.min(...last.map((r) => r.left));
  const right = Math.max(...last.map((r) => r.right));
  return {
    left: (left - outer.left) / scale,
    top: fallback.top,
    width: (right - left) / scale,
    height: (bottom - outer.top) / scale - fallback.top,
    firstRight: (Math.max(...first.map((r) => r.right)) - outer.left) / scale,
    firstTop: (top - outer.top) / scale,
  };
}

const overflows = (box: HTMLElement, inner: HTMLElement) =>
  inner.scrollHeight > box.clientHeight + 1 || inner.scrollWidth > box.clientWidth + 1;

/**
 * Positioned text that is guaranteed to fit its box:
 * 1. shrink the font step by step (down to `min`),
 * 2. then break long words,
 * 3. finally cut to the number of lines that fit (line-clamp).
 */
export function TextBox({ spec, onMetrics }: { spec: TextSpec; onMetrics?: (m: TextMetrics) => void }) {
  const { editable, onEdit } = useSlideEnv();
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fontsReady = useFontsReady();
  const lineHeight = spec.lineHeight ?? (spec.multiline === false ? 1.1 : 1.2);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const min = spec.min ?? Math.round(spec.size * 0.5);
    let size = spec.size;
    inner.classList.remove("clamped", "break");
    inner.style.removeProperty("-webkit-line-clamp");
    inner.style.fontSize = `${size}px`;
    while (size > min && overflows(box, inner)) {
      size = Math.max(min, size - Math.max(1, Math.round(size * 0.06)));
      inner.style.fontSize = `${size}px`;
    }
    const singleLine = spec.multiline === false;
    if (!singleLine && overflows(box, inner)) inner.classList.add("break");
    // Single-line fields end with "…" (CSS); multi-line ones are cut to whole lines
    if (!singleLine && overflows(box, inner)) {
      const lines = Math.max(1, Math.floor(box.clientHeight / (size * lineHeight)));
      inner.style.setProperty("-webkit-line-clamp", String(lines));
      inner.classList.add("clamped");
    }
    if (onMetrics) onMetrics(lineMetrics(box, inner));
  }, [spec.size, spec.min, spec.multiline, lineHeight, onMetrics]);

  useLayoutEffect(fit, [fit, spec.text, spec.w, spec.h, fontsReady]);

  const canEdit = editable && !!spec.path && !!onEdit;
  const commit = () => {
    const el = innerRef.current;
    if (!el || !spec.path || !onEdit) return;
    const value = el.innerText.replace(/\s*\n\s*/g, " ").trim();
    if (value !== spec.text) onEdit(spec.path, value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation(); // keep arrow keys etc. away from the slide navigation
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.currentTarget.innerText = spec.text;
      e.currentTarget.blur();
    }
  };

  const justify = { left: "flex-start", center: "center", right: "flex-end" }[spec.align ?? "left"];
  const alignItems = { top: "flex-start", middle: "center", bottom: "flex-end" }[spec.valign ?? "middle"];
  const style: CSSProperties = { left: spec.x, top: spec.y, width: spec.w, height: spec.h, justifyContent: justify, alignItems };

  return (
    <div ref={boxRef} className={`tbox ${spec.role === "title" ? "tx-title" : "tx-body"}`} style={style}>
      <div
        key={spec.text}
        ref={innerRef}
        className={`tinner w-${spec.weight ?? "body"} c-${spec.color ?? "ink"}${spec.multiline === false ? " nowrap" : ""}${canEdit ? " editable" : ""}`}
        style={{ textAlign: spec.align ?? "left", lineHeight }}
        contentEditable={canEdit ? "plaintext-only" : undefined}
        suppressContentEditableWarning
        spellCheck={canEdit}
        onBlur={canEdit ? commit : undefined}
        onInput={canEdit ? fit : undefined}
        onKeyDown={canEdit ? onKeyDown : undefined}
        title={canEdit ? "Click to edit" : undefined}
      >
        {spec.text}
      </div>
    </div>
  );
}
