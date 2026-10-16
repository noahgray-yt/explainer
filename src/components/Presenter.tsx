import { useCallback, useEffect, useRef, useState } from "react";
import type { Deck } from "../../shared/schema";
import { SlideView } from "./SlideView";

interface Props {
  deck: Deck;
  start: number;
  animate: boolean;
  onClose: (lastIndex: number) => void;
}

/** Full-screen presentation: arrow keys, space, swipe, click left/right. */
export function Presenter({ deck, start, animate, onClose }: Props) {
  const [index, setIndex] = useState(start);
  const [idle, setIdle] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = deck.slides.length;

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(n - 1, i))), [n]);
  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    onClose(index);
  }, [index, onClose]);

  const onCloseRef = useRef(close);
  onCloseRef.current = close;
  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => undefined);
    // If the browser leaves full screen (e.g. with Esc), the presentation ends too
    const onFs = () => !document.fullscreenElement && onCloseRef.current();
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(n - 1);
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, n, go, close]);

  // Hide the mouse pointer after a short idle time
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), 2000);
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2000);
    };
    window.addEventListener("mousemove", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", wake);
    };
  }, []);

  return (
    <div
      ref={root}
      className={`presenter${idle ? " idle" : ""}`}
      onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
        else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && e.pointerType === "mouse") {
          go(index + (e.clientX > window.innerWidth / 3 ? 1 : -1));
        }
      }}
    >
      <div className="presenter-stage">
        <SlideView key={deck.slides[index].id} deck={deck} index={index} animate={animate} />
      </div>
      <div className="presenter-bar">
        <div className="presenter-progress" style={{ width: `${((index + 1) / n) * 100}%` }} />
      </div>
      <div className="presenter-count">
        {index + 1} / {n}
      </div>
      <button className="presenter-close" onPointerDown={(e) => e.stopPropagation()} onClick={close} aria-label="End presentation">
        ✕
      </button>
    </div>
  );
}
