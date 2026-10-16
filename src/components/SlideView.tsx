import { useLayoutEffect, useRef, useState } from "react";
import type { Deck } from "../../shared/schema";
import { SlideContent } from "../templates/registry";
import { SlideEnvContext, W, type EditPath } from "../templates/types";
import { getTheme } from "../theme/themes";

interface Props {
  deck: Deck;
  index: number;
  editable?: boolean;
  animate?: boolean;
  onEdit?: (path: EditPath, value: string) => void;
  className?: string;
}

/** Scales the 1600×900 slide to the available width. */
export function SlideView({ deck, index, editable = false, animate = false, onEdit, className = "" }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slide = deck.slides[index];
  if (!slide) return null;
  return (
    <div ref={outer} className={`slide-view ${className}`}>
      {scale > 0 && (
        <div className="slide-scale" style={{ transform: `scale(${scale})` }}>
          <SlideEnvContext.Provider value={{ editable, animate, onEdit }}>
            <SlideContent slide={slide} theme={getTheme(deck.theme)} index={index} total={deck.slides.length} />
          </SlideEnvContext.Provider>
        </div>
      )}
    </div>
  );
}
