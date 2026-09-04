import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import type { PresentationProject, SlideElement } from "./types";
import { outputSlides } from "./outputProject";
import { SceneBackground, StaticScene } from "./components/Scene";
import { resolvedSlideBackground, resolvedSlideMasterElements } from "./masterResolver";
import { withRenderedPdfPages } from "./pdfSupport";
import { longformLayout, longformPageCount } from "./longformLayout";


function longformElementOverlapsPage(
  element: SlideElement,
  sectionTop: number,
  pageIndex: number,
  pageHeight: number,
): boolean {
  if (!element.visible) return false;
  const pageTop = pageIndex * pageHeight;
  const pageBottom = pageTop + pageHeight;
  const centerY = sectionTop + element.y + element.height / 2;
  // Conservative rotated AABB radius: never drops a rotated element that can reach this page.
  const radiusY = Math.hypot(element.width, element.height) / 2;
  return centerY + radiusY >= pageTop && centerY - radiusY <= pageBottom;
}


function LongformPdfPage({
  project,
  slides,
  pageIndex,
}: {
  project: PresentationProject;
  slides: ReturnType<typeof outputSlides>;
  pageIndex: number;
}) {
  const layout = longformLayout(project, slides);
  const pageTop = pageIndex * project.height;
  const pageBottom = pageTop + project.height;
  return (
    <div
      className="longform-pdf-page"
      style={{
        position: "relative",
        width: project.width,
        height: project.height,
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {layout.map(({ slide: section, top, height }, sectionIndex) => {
        if (top >= pageBottom || top + height <= pageTop) return null;
        return (
          <div
            key={`pdf-longform-bg-${section.id}`}
            style={{
              position: "absolute",
              left: 0,
              top: top - pageTop - (sectionIndex > 0 ? 0.5 : 0),
              width: project.width,
              height: height + (sectionIndex > 0 ? 1 : 0.5),
              overflow: "hidden",
              zIndex: sectionIndex,
            }}
          >
            <SceneBackground
              project={project}
              background={resolvedSlideBackground(project, section)}
              mode="thumbnail"
            />
          </div>
        );
      })}
      {layout.map(({ slide: section, top, height }, sectionIndex) => {
        const filter = (element: SlideElement) =>
          longformElementOverlapsPage(element, top, pageIndex, project.height);
        const hasOverlap = section.elements.some(filter)
          || resolvedSlideMasterElements(project, section).some(filter);
        if (!hasOverlap) return null;
        return (
          <div
            key={`pdf-longform-${section.id}`}
            style={{
              position: "absolute",
              left: 0,
              top: top - pageTop,
              width: project.width,
              height,
              overflow: "visible",
              zIndex: 1000 + sectionIndex,
            }}
          >
            <StaticScene
              project={project}
              slide={section}
              mode="thumbnail"
              showBackground={false}
              allowOverflow
              sceneHeight={height}
              elementFilter={filter}
            />
          </div>
        );
      })}
    </div>
  );
}


async function settleRender(node: HTMLElement) {
  await document.fonts?.ready.catch(() => undefined);
  const waitStarted = performance.now();
  while (node.querySelector('[data-pdf-render-status="loading"]') && performance.now() - waitStarted < 6000) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  }
  await Promise.all(Array.from(node.querySelectorAll("img")).map(async (image) => {
    if (image.complete) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      window.setTimeout(done, 1800);
    });
  }));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Direct PDF writer: no browser print dialog and no A4/A3 page model.
 * Each non-hidden slide is rasterized by the same React scene renderer. In One Slide mode,
 * the shared longform canvas is sliced into normal project-height PDF pages. Variable-height
 * sections may therefore span multiple PDF pages, but Pre'on never creates one giant PDF page.
 * This preserves the user's crash-safe page-based export rule while allowing flexible sections.
 */
export async function buildDirectPdf(
  project: PresentationProject,
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const slides = outputSlides(project);
  if (!slides.length) throw new Error("Nincs exportálható dia. A rejtett diák nem kerülnek PDF-be.");

  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${project.width}px`,
    height: `${project.height}px`,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "-999999",
  });
  document.body.append(host);
  const root = createRoot(host);
  const pdf = await PDFDocument.create();

  try {
    const totalPages = project.presentationMode === "longform" ? longformPageCount(project, slides) : slides.length;
    for (let index = 0; index < totalPages; index += 1) {
      const slide = slides[Math.min(index, slides.length - 1)];
      const pdfElementIds = new Set<string>();
      if (project.presentationMode === "longform") {
        const layout = longformLayout(project, slides);
        layout.forEach(({ slide: section, top }) => {
          const collect = (element: SlideElement) => {
            if (element.type === "pdf" && longformElementOverlapsPage(element, top, index, project.height)) {
              pdfElementIds.add(element.id);
            }
          };
          section.elements.forEach(collect);
          resolvedSlideMasterElements(project, section).forEach(collect);
        });
      } else {
        slide.elements.forEach((element) => { if (element.type === "pdf") pdfElementIds.add(element.id); });
        resolvedSlideMasterElements(project, slide).forEach((element) => { if (element.type === "pdf") pdfElementIds.add(element.id); });
      }

      // Render only the PDF pages that can actually appear on the current output page.
      // In One Slide mode even a 300% section is sliced into normal slide-sized pages, so
      // no giant intermediate raster/PDF page is ever created.
      const pageProject = pdfElementIds.size
        ? await withRenderedPdfPages(project, 2400, pdfElementIds)
        : project;
      const pageSlides = pageProject === project ? slides : outputSlides(pageProject);
      const pageSlide = pageSlides[Math.min(index, pageSlides.length - 1)];

      if (pageProject.presentationMode === "longform") {
        root.render(<LongformPdfPage project={pageProject} slides={pageSlides} pageIndex={index} />);
      } else {
        root.render(<StaticScene project={pageProject} slide={pageSlide} mode="thumbnail" />);
      }
      await settleRender(host);
      const scene = host.querySelector<HTMLElement>(
        pageProject.presentationMode === "longform" ? ".longform-pdf-page" : ".static-scene",
      );
      if (!scene) throw new Error(`A(z) ${slide?.name ?? index + 1} oldal nem renderelhető.`);
      const pngDataUrl = await toPng(scene, {
        width: pageProject.width,
        height: pageProject.height,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: "#ffffff",
        skipAutoScale: true,
      });
      const png = await pdf.embedPng(pngDataUrl);
      const page = pdf.addPage([pageProject.width, pageProject.height]);
      page.drawImage(png, { x: 0, y: 0, width: pageProject.width, height: pageProject.height });
      onProgress?.(index + 1, totalPages);
    }
    pdf.setTitle(project.name);
    pdf.setCreator("Pre'on");
    pdf.setProducer("Pre'on direct slide PDF exporter");
    return await pdf.save({ useObjectStreams: true });
  } finally {
    root.unmount();
    host.remove();
  }
}
