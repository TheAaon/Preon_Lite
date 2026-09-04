import type { PresentationProject, Slide } from "./types";

export const MIN_LONGFORM_HEIGHT_SCALE = 0.25;
export const MAX_LONGFORM_HEIGHT_SCALE = 6;

export function normalizedLongformHeightScale(slide: Slide): number {
  const raw = Number(slide.longformHeightScale ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(MAX_LONGFORM_HEIGHT_SCALE, Math.max(MIN_LONGFORM_HEIGHT_SCALE, raw));
}

export function longformSectionHeight(project: PresentationProject, slide: Slide): number {
  return project.height * normalizedLongformHeightScale(slide);
}

export interface LongformSectionLayout {
  slide: Slide;
  index: number;
  top: number;
  height: number;
  bottom: number;
}

export function longformLayout(project: PresentationProject, slides: Slide[] = project.slides): LongformSectionLayout[] {
  let top = 0;
  return slides.map((slide, index) => {
    const height = longformSectionHeight(project, slide);
    const item = { slide, index, top, height, bottom: top + height };
    top += height;
    return item;
  });
}

export function longformTotalHeight(project: PresentationProject, slides: Slide[] = project.slides): number {
  const layout = longformLayout(project, slides);
  return layout.length ? layout[layout.length - 1].bottom : 0;
}

export function longformLayoutForSlide(project: PresentationProject, slideId: string, slides: Slide[] = project.slides): LongformSectionLayout | undefined {
  return longformLayout(project, slides).find((item) => item.slide.id === slideId);
}

export function longformSectionAtY(project: PresentationProject, y: number, slides: Slide[] = project.slides): LongformSectionLayout | undefined {
  if (!Number.isFinite(y) || y < 0) return undefined;
  const layout = longformLayout(project, slides);
  return layout.find((item, index) => y >= item.top && (y < item.bottom || (index === layout.length - 1 && y <= item.bottom)));
}

export function longformPageCount(project: PresentationProject, slides: Slide[] = project.slides): number {
  return Math.max(1, Math.ceil(longformTotalHeight(project, slides) / Math.max(1, project.height)));
}
