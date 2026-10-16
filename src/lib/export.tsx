import { getFontEmbedCSS, toJpeg, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Deck } from "../../shared/schema";
import { SlideContent } from "../templates/registry";
import { H, SlideEnvContext, W } from "../templates/types";
import { getTheme } from "../theme/themes";
import { slug } from "./deck";
import { fontsLoaded } from "./fonts";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Renders a slide invisibly at full size (1600×900), without animation. */
async function renderOffscreen(deck: Deck, index: number) {
  const host = document.createElement("div");
  host.className = "export-host";
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      <SlideEnvContext.Provider value={{ editable: false, animate: false }}>
        <SlideContent slide={deck.slides[index]} theme={getTheme(deck.theme)} index={index} total={deck.slides.length} />
      </SlideEnvContext.Provider>,
    ),
  );
  await fontsLoaded();
  await nextFrame();
  await nextFrame();
  const node = host.firstElementChild as HTMLElement;
  return {
    node,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

let fontCss: Promise<string> | null = null;
const embedFonts = (node: HTMLElement) => (fontCss ??= getFontEmbedCSS(node));

export async function exportSlidePng(deck: Deck, index: number) {
  const { node, cleanup } = await renderOffscreen(deck, index);
  try {
    const url = await toPng(node, { width: W, height: H, pixelRatio: 2, fontEmbedCSS: await embedFonts(node) });
    download(url, `${slug(deck.title)}-${String(index + 1).padStart(2, "0")}.png`);
  } finally {
    cleanup();
  }
}

export async function exportDeckPdf(deck: Deck, onProgress: (done: number, total: number) => void) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H], hotfixes: ["px_scaling"], compress: true });
  for (let i = 0; i < deck.slides.length; i++) {
    onProgress(i, deck.slides.length);
    const { node, cleanup } = await renderOffscreen(deck, i);
    try {
      const url = await toJpeg(node, { width: W, height: H, pixelRatio: 1.5, quality: 0.92, fontEmbedCSS: await embedFonts(node) });
      if (i > 0) pdf.addPage([W, H], "landscape");
      pdf.addImage(url, "JPEG", 0, 0, W, H, undefined, "FAST");
    } finally {
      cleanup();
    }
  }
  onProgress(deck.slides.length, deck.slides.length);
  pdf.save(`${slug(deck.title)}.pdf`);
}

export function exportDeckJson(deck: Deck) {
  const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, `${slug(deck.title)}.explainer.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
