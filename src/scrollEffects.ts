import type { ElementScrollBehavior, ElementScrollMotion, PresentationProject, SlideElement } from "./types";
import type { LongformSectionLayout } from "./longformLayout";
import { clamp } from "./utils";

export const DEFAULT_SCROLL_SCREENS = 2;

export const DEFAULT_SCROLL_MOTION: ElementScrollMotion = {
  enabled: false,
  opacityFrom: 0,
  opacityTo: 1,
  scaleFrom: 0.96,
  scaleTo: 1,
  offsetXFrom: 0,
  offsetXTo: 0,
  offsetYFrom: 60,
  offsetYTo: 0,
};

export function normalizedScrollMotion(raw: ElementScrollMotion | undefined): ElementScrollMotion {
  return {
    enabled: Boolean(raw?.enabled),
    opacityFrom: clamp(Number.isFinite(Number(raw?.opacityFrom)) ? Number(raw?.opacityFrom) : DEFAULT_SCROLL_MOTION.opacityFrom, 0, 1),
    opacityTo: clamp(Number.isFinite(Number(raw?.opacityTo)) ? Number(raw?.opacityTo) : DEFAULT_SCROLL_MOTION.opacityTo, 0, 1),
    scaleFrom: clamp(Number.isFinite(Number(raw?.scaleFrom)) ? Number(raw?.scaleFrom) : DEFAULT_SCROLL_MOTION.scaleFrom, 0.1, 4),
    scaleTo: clamp(Number.isFinite(Number(raw?.scaleTo)) ? Number(raw?.scaleTo) : DEFAULT_SCROLL_MOTION.scaleTo, 0.1, 4),
    offsetXFrom: clamp(Number.isFinite(Number(raw?.offsetXFrom)) ? Number(raw?.offsetXFrom) : DEFAULT_SCROLL_MOTION.offsetXFrom, -5000, 5000),
    offsetXTo: clamp(Number.isFinite(Number(raw?.offsetXTo)) ? Number(raw?.offsetXTo) : DEFAULT_SCROLL_MOTION.offsetXTo, -5000, 5000),
    offsetYFrom: clamp(Number.isFinite(Number(raw?.offsetYFrom)) ? Number(raw?.offsetYFrom) : DEFAULT_SCROLL_MOTION.offsetYFrom, -5000, 5000),
    offsetYTo: clamp(Number.isFinite(Number(raw?.offsetYTo)) ? Number(raw?.offsetYTo) : DEFAULT_SCROLL_MOTION.offsetYTo, -5000, 5000),
  };
}

export function normalizedScrollBehavior(element: SlideElement): ElementScrollBehavior {
  const raw = element.scrollBehavior;
  const screens = Number(raw?.screens ?? DEFAULT_SCROLL_SCREENS);
  return {
    mode: raw?.mode === "sticky" ? "sticky" : "normal",
    pinBehavior: "hard",
    rangeMode: raw?.rangeMode === "until-section" ? "until-section" : "screens",
    screens: Number.isFinite(screens) ? clamp(screens, 0.25, 12) : DEFAULT_SCROLL_SCREENS,
    targetSlideId: raw?.targetSlideId,
    motion: normalizedScrollMotion(raw?.motion),
  };
}

export interface ElementScrollMetrics {
  start: number;
  end: number;
  duration: number;
  progress: number;
  offset: number;
  active: boolean;
}

export interface ElementScrollMotionValues {
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * clamp(progress, 0, 1);
}

export function scrollMotionValues(element: SlideElement, progress: number): ElementScrollMotionValues {
  const motion = normalizedScrollMotion(element.scrollBehavior?.motion);
  if (!motion.enabled) return { opacity: 1, scale: 1, offsetX: 0, offsetY: 0 };
  return {
    opacity: lerp(motion.opacityFrom, motion.opacityTo, progress),
    scale: lerp(motion.scaleFrom, motion.scaleTo, progress),
    offsetX: lerp(motion.offsetXFrom, motion.offsetXTo, progress),
    offsetY: lerp(motion.offsetYFrom, motion.offsetYTo, progress),
  };
}

export function elementScrollMetrics(
  project: PresentationProject,
  layout: LongformSectionLayout[],
  sourceSlideId: string,
  element: SlideElement,
  scrollY: number,
  viewportHeight: number,
): ElementScrollMetrics {
  const behavior = normalizedScrollBehavior(element);
  const source = layout.find((item) => item.slide.id === sourceSlideId);
  const fallbackStart = source?.top ?? 0;
  const safeViewport = Math.max(1, viewportHeight || project.height);
  let end = fallbackStart + behavior.screens * safeViewport;

  if (behavior.rangeMode === "until-section" && behavior.targetSlideId) {
    const target = layout.find((item) => item.slide.id === behavior.targetSlideId);
    if (target && source && target.index > source.index) end = target.top;
  }

  if (!Number.isFinite(end) || end <= fallbackStart) end = fallbackStart + behavior.screens * safeViewport;
  const duration = Math.max(1, end - fallbackStart);
  const progress = clamp((scrollY - fallbackStart) / duration, 0, 1);
  const offset = behavior.mode === "sticky" ? clamp(scrollY - fallbackStart, 0, duration) : 0;
  return {
    start: fallbackStart,
    end: fallbackStart + duration,
    duration,
    progress,
    offset,
    active: scrollY >= fallbackStart && scrollY <= fallbackStart + duration,
  };
}

export function elementUsesScrollRange(element: SlideElement): boolean {
  const behavior = normalizedScrollBehavior(element);
  return behavior.mode === "sticky"
    || Boolean(behavior.motion?.enabled)
    || (element.type === "video" && element.playbackMode === "scroll")
    || (element.type === "model3d" && element.interaction === "scroll");
}

export function requiredLongformScrollHeight(
  project: PresentationProject,
  layout: LongformSectionLayout[],
  viewportHeight: number,
): number {
  const baseHeight = layout.length > 0 ? layout[layout.length - 1].bottom : 0;
  const safeViewport = Math.max(1, viewportHeight || project.height);
  let requiredHeight = baseHeight;

  for (const section of layout) {
    for (const element of section.slide.elements) {
      if (!elementUsesScrollRange(element)) continue;
      const metrics = elementScrollMetrics(project, layout, section.slide.id, element, Number.POSITIVE_INFINITY, safeViewport);
      requiredHeight = Math.max(requiredHeight, metrics.end + safeViewport);
    }
  }
  return requiredHeight;
}
