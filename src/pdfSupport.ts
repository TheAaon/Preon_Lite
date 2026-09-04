import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readBinaryFile } from "./platform";
import type { AssetRecord, PdfElement, PresentationProject, SlideElement } from "./types";
import { deepClone } from "./utils";

let pdfRuntimePromise: Promise<{ getDocument: typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"] }> | null = null;

async function getPdfRuntime() {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(([runtime, worker]) => {
      runtime.GlobalWorkerOptions.workerSrc = worker.default;
      return { getDocument: runtime.getDocument };
    });
  }
  return pdfRuntimePromise;
}

const documentCache = new Map<string, Promise<PDFDocumentProxy>>();
const renderCache = new Map<string, Promise<string>>();

export function releasePdfAsset(assetId: string): void {
  const cachedDocument = documentCache.get(assetId);
  documentCache.delete(assetId);
  for (const key of Array.from(renderCache.keys())) {
    if (key.startsWith(`${assetId}:`)) renderCache.delete(key);
  }
  if (cachedDocument) {
    void cachedDocument.then((pdfDocument) => pdfDocument.destroy()).catch(() => undefined);
  }
}

export function clearPdfCaches(): void {
  const cachedDocuments = Array.from(documentCache.values());
  documentCache.clear();
  renderCache.clear();
  cachedDocuments.forEach((cachedDocument) => {
    void cachedDocument.then((pdfDocument) => pdfDocument.destroy()).catch(() => undefined);
  });
}

function dataUrlToBytes(value: string): Uint8Array {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("Érvénytelen PDF data URL.");
  const header = value.slice(0, comma);
  const body = value.slice(comma + 1);
  if (/;base64/i.test(header)) {
    const raw = atob(body);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(body));
}

async function assetBytes(asset: AssetRecord): Promise<Uint8Array> {
  if (asset.dataUrl) return dataUrlToBytes(asset.dataUrl);
  if (asset.path) return new Uint8Array(await readBinaryFile(asset.path));
  throw new Error(`A PDF fájl nem található: ${asset.name}`);
}

async function loadPdf(asset: AssetRecord): Promise<PDFDocumentProxy> {
  const cached = documentCache.get(asset.id);
  if (cached) return cached;
  const task = (async () => {
    const [bytes, runtime] = await Promise.all([assetBytes(asset), getPdfRuntime()]);
    return runtime.getDocument({ data: bytes }).promise;
  })();
  documentCache.set(asset.id, task);
  try {
    return await task;
  } catch (error) {
    documentCache.delete(asset.id);
    throw error;
  }
}

export async function getPdfPageCount(asset: AssetRecord): Promise<number> {
  const pdfDocument = await loadPdf(asset);
  return Math.max(1, pdfDocument.numPages);
}

export async function getPdfPageAspect(asset: AssetRecord, pageNumber = 1): Promise<number> {
  const pdfDocument = await loadPdf(asset);
  const safePage = Math.max(1, Math.min(pdfDocument.numPages, Math.round(pageNumber)));
  const page = await pdfDocument.getPage(safePage);
  const viewport = page.getViewport({ scale: 1 });
  return viewport.width / Math.max(1, viewport.height);
}

/**
 * Renders one PDF page to a PNG data URL. The cache is keyed by a rounded target width so
 * editor previews stay light while PDF/HTML export can request a sharper raster.
 */
export async function renderPdfPageToDataUrl(
  asset: AssetRecord,
  pageNumber: number,
  targetPixelWidth = 1200,
  options: { cache?: boolean } = {},
): Promise<string> {
  const pdfDocument = await loadPdf(asset);
  const safePage = Math.max(1, Math.min(pdfDocument.numPages, Math.round(pageNumber || 1)));
  const roundedWidth = Math.max(320, Math.min(3200, Math.round(targetPixelWidth / 100) * 100));
  const key = `${asset.id}:${safePage}:${roundedWidth}`;
  const useCache = options.cache !== false;
  if (useCache) {
    const cached = renderCache.get(key);
    if (cached) return cached;
  }

  const task = (async () => {
    const page = await pdfDocument.getPage(safePage);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = roundedWidth / Math.max(1, baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("A PDF oldal nem renderelhető canvasra.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/png");
  })();
  if (useCache) {
    renderCache.set(key, task);
    // Editor/thumbnail previews are intentionally bounded. Export renders bypass this cache,
    // so a large imported PDF does not leave dozens of high-resolution page rasters in memory.
    while (renderCache.size > 18) {
      const oldestKey = renderCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      renderCache.delete(oldestKey);
    }
  }
  try {
    return await task;
  } catch (error) {
    if (useCache) renderCache.delete(key);
    throw error;
  }
}

function collectPdfElements(project: PresentationProject): PdfElement[] {
  const result: PdfElement[] = [];
  const collect = (elements: SlideElement[]) => {
    elements.forEach((element) => {
      if (element.type === "pdf") result.push(element);
    });
  };
  project.slides.forEach((slide) => collect(slide.elements));
  project.masters.forEach((master) => collect(master.elements));
  return result;
}

/**
 * Builds an export-only clone whose PDF elements already contain high-resolution PNG rasters.
 * The original PDF remains the single editable source in the project; the raster exists only
 * in the generated HTML/LAN snapshot, so .preon files do not grow with duplicate page images.
 */
export async function withRenderedPdfPages(
  project: PresentationProject,
  targetPixelWidth = 2400,
  onlyElementIds?: ReadonlySet<string>,
): Promise<PresentationProject> {
  const clone = deepClone(project);
  const assetById = new Map(clone.assets.map((asset) => [asset.id, asset]));
  for (const element of collectPdfElements(clone)) {
    if (onlyElementIds && !onlyElementIds.has(element.id)) continue;
    const asset = assetById.get(element.assetId);
    if (!asset) continue;
    try {
      const pageCount = asset.pageCount ?? await getPdfPageCount(asset);
      asset.pageCount = pageCount;
      element.pageCount = pageCount;
      element.page = Math.max(1, Math.min(pageCount, Math.round(element.page || 1)));
      element.renderedDataUrl = await renderPdfPageToDataUrl(asset, element.page, targetPixelWidth, { cache: false });
    } catch {
      element.renderedDataUrl = undefined;
    }
  }
  return clone;
}
