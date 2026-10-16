/* Text width in design pixels – used to size tags and pills to their text. */

let ctx: CanvasRenderingContext2D | null = null;

export function measureText(text: string, size: number, family: string, weight = 400): number {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * size * 0.5;
  ctx.font = `${weight} ${size}px ${family}`;
  return ctx.measureText(text).width;
}
