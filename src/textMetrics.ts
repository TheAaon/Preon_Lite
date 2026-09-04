import type { TextElement } from "./types";

let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

function sharedMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext;
  if (typeof document === "undefined") return null;
  measureCanvas = measureCanvas ?? document.createElement("canvas");
  measureContext = measureCanvas.getContext("2d");
  return measureContext;
}

export function textContentBounds(element: TextElement): { width: number; height: number } {
  const source = element.textTransform === "uppercase" ? (element.text || " ").toUpperCase() : (element.text || " ");
  const lines = source.split(/\r?\n/);
  const context = sharedMeasureContext();
  const family = element.fontFamily || "sans-serif";
  const baselineScale = element.baselineMode === "super" || element.baselineMode === "sub" ? 0.72 : 1;
  const effectiveFontSize = element.fontSize * baselineScale;
  if (context) context.font = `${element.fontStyle ?? "normal"} ${element.fontWeight || 400} ${effectiveFontSize}px ${family}`;

  let maxWidth = 1;
  let maxAscent = effectiveFontSize * 0.82;
  let maxDescent = effectiveFontSize * 0.24;
  for (const line of lines) {
    const metrics = context?.measureText(line || " ");
    const measured = metrics?.width ?? (line.length * effectiveFontSize * 0.55);
    const tracking = Math.max(0, line.length - 1) * (element.letterSpacingAuto ? 0 : (element.letterSpacing || 0));
    maxWidth = Math.max(maxWidth, measured + tracking);
    if (metrics) {
      maxAscent = Math.max(maxAscent, metrics.actualBoundingBoxAscent || 0);
      maxDescent = Math.max(maxDescent, metrics.actualBoundingBoxDescent || 0);
    }
  }

  const lineAdvance = Math.max(effectiveFontSize * (element.lineHeightAuto ? 1.2 : (element.lineHeight || 1.2)), maxAscent + maxDescent);
  const textHeight = lines.length <= 1
    ? maxAscent + maxDescent
    : (lines.length - 1) * lineAdvance + maxAscent + maxDescent;

  return {
    width: Math.ceil(maxWidth + element.padding * 2 + Math.max(0, element.firstLineIndent ?? 0) + 2),
    height: Math.ceil(textHeight + element.padding * 2 + (element.paragraphSpacingBefore ?? 0) + (element.paragraphSpacingAfter ?? 0) + 2),
  };
}
