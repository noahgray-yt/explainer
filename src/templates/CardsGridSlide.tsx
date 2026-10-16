import { drawIcon } from "../sketch/icons";
import { row } from "./helpers";
import { Scene, useLayout } from "./Scene";
import { FRAME, type TemplateProps } from "./types";

export function CardsGridSlide(props: TemplateProps<"cards-grid">) {
  const layout = useLayout(props, ({ b, text }, slide) => {
    const cards = slide.data.cards;
    const n = Math.max(1, cards.length);
    const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const gapX = 32;
    const cardW = Math.min(cols === 2 ? 360 : 330, (FRAME.body.w - (cols - 1) * gapX) / cols);
    const cardH = Math.min(104, (FRAME.body.h - (rows - 1) * 30) / rows);
    const gapY = 30;
    const top = FRAME.body.y + (FRAME.body.h - (rows * cardH + (rows - 1) * gapY)) / 2;

    for (let r = 0; r < rows; r++) {
      const items = cards.slice(r * cols, (r + 1) * cols);
      const xs = row(items.length, cardW, gapX, FRAME.body.x, FRAME.body.w);
      items.forEach((card, j) => {
        const i = r * cols + j;
        const x = xs[j];
        const y = top + r * (cardH + gapY);
        const cy = y + cardH / 2;
        b.roundRect(x, y, cardW, cardH, 10, { fill: "paper" });
        drawIcon(b, card.icon, x + 50, cy, 46, b.tone(i));
        const hasNote = card.note.trim().length > 0;
        text({
          key: `c${i}`,
          text: card.label,
          path: ["data", "cards", i, "label"],
          x: x + 92,
          y: hasNote ? y + 14 : y + 10,
          w: cardW - 106,
          h: hasNote ? 44 : cardH - 20,
          size: 28,
          min: 16,
          valign: hasNote ? "bottom" : "middle",
          multiline: !hasNote,
        });
        if (hasNote) {
          text({
            key: `n${i}`,
            text: card.note,
            path: ["data", "cards", i, "note"],
            x: x + 92,
            y: y + 58,
            w: cardW - 106,
            h: 32,
            size: 20,
            min: 14,
            valign: "top",
            color: "ink-soft",
            multiline: false,
          });
        }
      });
    }
  });
  return <Scene layout={layout} props={props} />;
}
