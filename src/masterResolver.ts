import { defaultBackground, defaultGrid } from "./defaultProject";
import type { BackgroundSettings, GridSettings, MasterSlide, PresentationProject, Slide, SlideElement } from "./types";

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => Number(value.toFixed(4))))).sort((a, b) => a - b);
}

export function masterChain(project: PresentationProject, masterId: string | null | undefined): MasterSlide[] {
  if (!masterId) return [];
  const byId = new Map(project.masters.map((master) => [master.id, master]));
  const result: MasterSlide[] = [];
  const seen = new Set<string>();
  let current = byId.get(masterId) ?? null;
  while (current && !seen.has(current.id)) {
    result.unshift(current);
    seen.add(current.id);
    current = current.parentMasterId ? byId.get(current.parentMasterId) ?? null : null;
  }
  return result;
}

export function inheritedMasterChain(project: PresentationProject, masterId: string | null | undefined): MasterSlide[] {
  const chain = masterChain(project, masterId);
  return chain.length > 1 ? chain.slice(0, -1) : [];
}

export function resolvedMasterElements(project: PresentationProject, masterId: string | null | undefined): SlideElement[] {
  return masterChain(project, masterId).flatMap((master) => master.elements);
}

export function inheritedMasterElements(project: PresentationProject, masterId: string | null | undefined): SlideElement[] {
  return inheritedMasterChain(project, masterId).flatMap((master) => master.elements);
}

export function resolvedSlideMasterElements(project: PresentationProject, slide: Slide): SlideElement[] {
  const overridden = new Set(slide.elements.map((element) => element.masterSourceId).filter((value): value is string => Boolean(value)));
  return resolvedMasterElements(project, slide.masterId).filter((element) => !overridden.has(element.id));
}

export function resolvedMasterGuides(project: PresentationProject, masterId: string | null | undefined) {
  const chain = masterChain(project, masterId);
  return {
    vertical: uniqueNumbers(chain.flatMap((master) => master.guides.vertical)),
    horizontal: uniqueNumbers(chain.flatMap((master) => master.guides.horizontal)),
  };
}

export function inheritedMasterGuides(project: PresentationProject, masterId: string | null | undefined) {
  const chain = inheritedMasterChain(project, masterId);
  return {
    vertical: uniqueNumbers(chain.flatMap((master) => master.guides.vertical)),
    horizontal: uniqueNumbers(chain.flatMap((master) => master.guides.horizontal)),
  };
}

export function resolvedMasterGrid(project: PresentationProject, masterId: string | null | undefined): GridSettings {
  const chain = masterChain(project, masterId);
  let resolved = defaultGrid();
  for (const master of chain) {
    if (master.grid.enabled) {
      resolved = { ...master.grid };
      continue;
    }
    if (master.inheritParentGrid === false) resolved = { ...master.grid };
  }
  return resolved;
}

export function resolvedSlideGrid(project: PresentationProject, slide: Slide): GridSettings {
  if (slide.grid.enabled || slide.inheritMasterGrid === false) return { ...slide.grid };
  return resolvedMasterGrid(project, slide.masterId);
}

export function resolvedMasterBackground(project: PresentationProject, masterId: string | null | undefined): BackgroundSettings {
  const chain = masterChain(project, masterId);
  let resolved: BackgroundSettings = defaultBackground(false);
  for (const master of chain) {
    if (!master.background.inherit || !master.parentMasterId) resolved = { ...master.background };
  }
  return resolved;
}

export function resolvedSlideBackground(project: PresentationProject, slide: Slide): BackgroundSettings {
  if (slide.background.inherit && slide.masterId) return resolvedMasterBackground(project, slide.masterId);
  return slide.background;
}

export function wouldCreateMasterCycle(project: PresentationProject, masterId: string, parentId: string | null): boolean {
  if (!parentId) return false;
  if (parentId === masterId) return true;
  const chain = masterChain(project, parentId);
  return chain.some((master) => master.id === masterId);
}
