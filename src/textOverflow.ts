import type { CSSProperties } from "react";
import type { TextElement } from "./types";

const OVERFLOW_TOLERANCE_PX = 2.5;

export function textVisualStyle(element: TextElement): CSSProperties {
  const baselineScale = element.baselineMode === "super" || element.baselineMode === "sub" ? 0.72 : 1;
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent:
      element.verticalAlign === "middle"
        ? "center"
        : element.verticalAlign === "bottom"
          ? "flex-end"
          : "flex-start",
    fontFamily: element.fontFamily,
    fontSize: element.fontSize * baselineScale,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle ?? "normal",
    textDecoration: [
      element.textDecoration === "underline" ? "underline" : "",
      element.strikethrough ? "line-through" : "",
    ].filter(Boolean).join(" ") || "none",
    textTransform: element.textTransform === "uppercase" ? "uppercase" : "none",
    fontVariantCaps: element.fontVariantCaps === "small-caps" ? "small-caps" : "normal",
    fontFeatureSettings: element.ligatures === false ? '"liga" 0, "clig" 0' : '"liga" 1, "clig" 1',
    lineHeight: element.lineHeightAuto ? "normal" : element.lineHeight,
    letterSpacing: element.letterSpacingAuto ? "normal" : element.letterSpacing,
    color: element.color,
    textAlign: element.textAlign,
    textIndent: element.firstLineIndent ?? 0,
    background: element.background,
    paddingLeft: element.padding,
    paddingRight: element.padding,
    paddingBottom: element.padding + (element.paragraphSpacingAfter ?? 0),
    paddingTop: element.padding + (element.paragraphSpacingBefore ?? 0),
    position: "relative",
    top: (element.baselineMode === "super" ? -element.fontSize * 0.28 : element.baselineMode === "sub" ? element.fontSize * 0.18 : 0) - (element.baselineShift ?? 0),
    whiteSpace: "pre-wrap",
    overflow: "visible",
    outline: "none",
  };
}

function applyMeasureStyle(node: HTMLDivElement, element: TextElement): void {
  const style = textVisualStyle(element);
  node.style.cssText = "";
  node.style.position = "fixed";
  node.style.left = "-100000px";
  node.style.top = "0";
  node.style.visibility = "hidden";
  node.style.pointerEvents = "none";
  node.style.zIndex = "-1";
  node.style.width = `${Math.max(0, element.width)}px`;
  node.style.height = "auto";
  node.style.minHeight = "0";
  node.style.boxSizing = "border-box";
  node.style.display = "block";
  node.style.fontFamily = String(style.fontFamily ?? "sans-serif");
  node.style.fontSize = `${Number(style.fontSize ?? element.fontSize)}px`;
  node.style.fontWeight = String(style.fontWeight ?? element.fontWeight);
  node.style.fontStyle = String(style.fontStyle ?? "normal");
  node.style.textDecoration = String(style.textDecoration ?? "none");
  node.style.textTransform = String(style.textTransform ?? "none");
  node.style.fontVariantCaps = String(style.fontVariantCaps ?? "normal");
  node.style.fontFeatureSettings = String(style.fontFeatureSettings ?? "normal");
  node.style.lineHeight = typeof style.lineHeight === "number" ? String(style.lineHeight) : String(style.lineHeight ?? "normal");
  node.style.letterSpacing = typeof style.letterSpacing === "number" ? `${style.letterSpacing}px` : String(style.letterSpacing ?? "normal");
  node.style.textAlign = String(style.textAlign ?? "left") as typeof node.style.textAlign;
  node.style.textIndent = `${Number(style.textIndent ?? 0)}px`;
  node.style.paddingLeft = `${element.padding}px`;
  node.style.paddingRight = `${element.padding}px`;
  node.style.paddingBottom = `${element.padding + (element.paragraphSpacingAfter ?? 0)}px`;
  node.style.paddingTop = `${element.padding + (element.paragraphSpacingBefore ?? 0)}px`;
  node.style.whiteSpace = "pre-wrap";
  node.style.wordBreak = "normal";
  node.style.overflowWrap = "normal";
  node.style.overflow = "visible";
}

export function measureTextOverflow(element: TextElement, node?: HTMLDivElement): boolean {
  if (typeof document === "undefined") return false;
  const probe = node ?? document.createElement("div");
  const ownsNode = !node;
  if (ownsNode) document.body.appendChild(probe);
  applyMeasureStyle(probe, element);
  probe.textContent = element.text || "";

  const requiredHeight = probe.getBoundingClientRect().height;
  const availableHeight = Math.max(0, element.height);
  const verticalOverflow = requiredHeight > availableHeight + OVERFLOW_TOLERANCE_PX;
  const horizontalOverflow = probe.scrollWidth > probe.clientWidth + OVERFLOW_TOLERANCE_PX;

  if (ownsNode) probe.remove();
  return verticalOverflow || horizontalOverflow;
}

export function measureTextOverflowBatch(elements: TextElement[]): boolean[] {
  if (typeof document === "undefined") return elements.map(() => false);
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  try {
    return elements.map((element) => measureTextOverflow(element, probe));
  } finally {
    probe.remove();
  }
}
