import type { PresentationProject, Slide } from "./types";
import { deepClone } from "./utils";

/** Slides that participate in presentation/export. Hidden variants stay in the project but never leave it. */
export function outputSlides(project: PresentationProject): Slide[] {
  return project.slides.filter((slide) => !slide.hidden);
}

/** A detached export snapshot so HTML/LAN/PDF share the same slide filtering rules. */
export function projectForOutput(project: PresentationProject): PresentationProject {
  const clone = deepClone(project);
  clone.slides = clone.slides.filter((slide) => !slide.hidden);
  // Presenter notes are private editor/presenter data. Audience-facing
  // HTML/LAN payloads must neither render nor embed them.
  clone.slides.forEach((slide) => {
    slide.notes = "";
    delete slide.notesHtml;
    delete slide.notesBoard;
  });
  return clone;
}
