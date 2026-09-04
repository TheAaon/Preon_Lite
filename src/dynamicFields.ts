import type { PresentationProject, Slide, TextElement } from "./types";

function formatNumber(value: number, format: TextElement["numberFormat"]): string {
  const digits = format === "001" ? 3 : format === "01" ? 2 : 1;
  return digits > 1 ? String(value).padStart(digits, "0") : String(value);
}

export function visibleSlidePosition(project: PresentationProject, slide: Slide): { current: number | null; total: number } {
  const visible = project.slides.filter((candidate) => !candidate.hidden);
  const index = visible.findIndex((candidate) => candidate.id === slide.id);
  return { current: index >= 0 ? index + 1 : null, total: visible.length };
}

export function resolvedDynamicText(project: PresentationProject, slide: Slide, element: TextElement): string {
  if (!element.dynamicField || element.dynamicField === "none") return element.text;
  const { current, total } = visibleSlidePosition(project, slide);
  const currentText = current == null ? "–" : formatNumber(current, element.numberFormat ?? "1");
  const totalText = formatNumber(total, element.numberFormat ?? "1");
  let value = currentText;
  if (element.dynamicField === "total-slides") value = totalText;
  if (element.dynamicField === "slide-number-total") value = `${currentText} / ${totalText}`;
  return `${element.dynamicPrefix ?? ""}${value}${element.dynamicSuffix ?? ""}`;
}

export function withResolvedDynamicText(project: PresentationProject, slide: Slide, element: TextElement): TextElement {
  if (!element.dynamicField || element.dynamicField === "none") return element;
  return { ...element, text: resolvedDynamicText(project, slide, element) };
}
