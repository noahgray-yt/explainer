import { useState } from "react";
import type { Deck } from "../../shared/schema";
import { SlideView } from "./SlideView";

interface Props {
  deck: Deck;
  onOpen: (index: number) => void;
  onPresent: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDelete: (id: string) => void;
  onPng: (index: number) => void;
}

/** All slides as a storyboard grid, reorderable by drag & drop. */
export function Storyboard({ deck, onOpen, onPresent, onMove, onDelete, onPng }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<{ index: number; after: boolean } | null>(null);

  const finishDrop = () => {
    if (dragFrom !== null && dropAt) {
      let to = dropAt.index + (dropAt.after ? 1 : 0);
      if (dragFrom < to) to -= 1;
      if (to !== dragFrom) onMove(dragFrom, to);
    }
    setDragFrom(null);
    setDropAt(null);
  };

  return (
    <main className="board">
      <ol className="grid">
        {deck.slides.map((slide, i) => {
          const marker = dropAt?.index === i && dragFrom !== null && dragFrom !== i ? (dropAt.after ? "drop-after" : "drop-before") : "";
          return (
            <li
              key={slide.id}
              className={`tile ${dragFrom === i ? "dragging" : ""} ${marker}`}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientX > r.left + r.width / 2;
                if (dropAt?.index !== i || dropAt.after !== after) setDropAt({ index: i, after });
              }}
              onDrop={(e) => {
                e.preventDefault();
                finishDrop();
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
            >
              <button className="tile-slide" onClick={() => onOpen(i)} title="Edit slide">
                <SlideView deck={deck} index={i} />
              </button>
              <div className="tile-actions">
                <span className="tile-no">{i + 1}</span>
                <button onClick={() => onPresent(i)} title="Present from here">
                  Present
                </button>
                <button onClick={() => onPng(i)} title="Save as PNG">
                  PNG
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete slide ${i + 1} "${slide.title}"?`)) onDelete(slide.id);
                  }}
                  title="Delete slide"
                  disabled={deck.slides.length <= 1}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="muted board-hint">Drag slides to reorder · click a slide to edit it</p>
    </main>
  );
}
