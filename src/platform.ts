import type { ExportAssetItem, FontFileRecord, ImportedAssetResult, LocalShareResult } from "./types";
import { downloadTextFile } from "./utils";

export async function chooseMediaFiles(_kind: "image" | "video" | "model" | "any" = "any"): Promise<string[]> { return []; }
export async function chooseHtmlAppFolder(): Promise<string | null> { return null; }
export async function chooseProjectFile(): Promise<string | null> { return null; }
export async function chooseWorkspaceFile(): Promise<string | null> { return null; }
export async function chooseSaveProjectPath(_defaultName: string): Promise<string | null> { return null; }
export async function chooseSavePdfPath(_defaultName: string): Promise<string | null> { return null; }
export async function chooseSaveWorkspacePath(_defaultName: string): Promise<string | null> { return null; }
export async function chooseExportFolder(): Promise<string | null> { return null; }

function desktopOnly(name: string): never {
  throw new Error(`${name} nem érhető el a Pre'on Lite webes kiadásban.`);
}

export async function importAsset(_sourcePath: string): Promise<ImportedAssetResult> { return desktopOnly("Natív asset import"); }
export async function deleteImportedAsset(_path: string): Promise<void> { /* browser assets are embedded in project data */ }
export async function importHtmlApp(_sourceDir: string): Promise<ImportedAssetResult> { return desktopOnly("HTML app mappa import"); }
export async function readBinaryFile(_path: string): Promise<number[]> { return desktopOnly("Natív fájlolvasás"); }
export async function outlineText(_args: {
  path: string; text: string; fontSize: number; lineHeight: number; letterSpacing: number; width: number; height: number; padding: number; textAlign: string; verticalAlign: string; color: string;
}): Promise<string> { return desktopOnly("Szöveg outline"); }
export async function startLocalShare(_html: string, _assets: ExportAssetItem[], _liveReloadToken?: string): Promise<LocalShareResult> { return desktopOnly("LAN megosztás"); }
export async function readTextFile(_path: string): Promise<string> { return desktopOnly("Natív fájlolvasás"); }
export async function writeTextFile(_path: string, _contents: string): Promise<void> { desktopOnly("Natív fájlmentés"); }
export async function writeBinaryFile(_path: string, _bytes: Uint8Array): Promise<void> { desktopOnly("Natív fájlmentés"); }
export async function exportHtmlBundle(_directory: string, _folderName: string, _html: string, _presenterHtml: string, _assets: ExportAssetItem[]): Promise<string> { return desktopOnly("Natív HTML csomag export"); }
export async function revealInFolder(_path: string): Promise<void> { /* unavailable on web */ }
export async function openPath(_path: string): Promise<void> { /* unavailable on web */ }
export async function saveTextFallback(name: string, contents: string): Promise<void> {
  const type = name.toLowerCase().endsWith(".html") ? "text/html;charset=utf-8" : "application/json;charset=utf-8";
  downloadTextFile(name, contents, type);
}

export interface NativeDropPayload { paths: string[]; clientX?: number; clientY?: number; }
export async function listenForNativeDrops(_handler: (payload: NativeDropPayload) => void): Promise<(() => void) | null> { return null; }

const BASIC_BROWSER_FONTS = ["Arial", "Arial Black", "Courier New", "Georgia", "Helvetica", "Times New Roman", "Trebuchet MS", "Verdana"];

type LocalFontDataLike = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob: () => Promise<Blob>;
};

type LocalFontWindow = Window & {
  queryLocalFonts?: (options?: { postscriptNames?: string[] }) => Promise<LocalFontDataLike[]>;
};

let localFontDataCache: LocalFontDataLike[] | null = null;
let localFontQueryPromise: Promise<LocalFontDataLike[]> | null = null;
const loadedLocalFontFaces = new Set<string>();

function uniqueFontFamilies(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function fontStyleMetadata(styleName: string): { weight: number; italic: boolean } {
  const style = (styleName || "Regular").toLocaleLowerCase();
  let weight = 400;
  if (/thin|hairline/.test(style)) weight = 100;
  else if (/extra\s*light|ultra\s*light/.test(style)) weight = 200;
  else if (/\blight\b/.test(style)) weight = 300;
  else if (/medium/.test(style)) weight = 500;
  else if (/semi\s*bold|demi\s*bold/.test(style)) weight = 600;
  else if (/extra\s*bold|ultra\s*bold/.test(style)) weight = 800;
  else if (/black|heavy/.test(style)) weight = 900;
  else if (/\bbold\b/.test(style)) weight = 700;
  const italic = /italic|oblique/.test(style);
  return { weight, italic };
}

function localFontRecord(entry: LocalFontDataLike): FontFileRecord {
  const meta = fontStyleMetadata(entry.style);
  return {
    family: entry.family,
    path: `localfont://${encodeURIComponent(entry.postscriptName || entry.fullName)}`,
    embeddable: false,
    format: "local",
    styleName: entry.style || "Regular",
    weight: meta.weight,
    italic: meta.italic,
  };
}

async function isLocalFontPermissionGranted(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: "local-fonts" } as never);
    return status.state === "granted";
  } catch {
    return false;
  }
}

async function queryLocalFontsNow(): Promise<LocalFontDataLike[]> {
  if (localFontDataCache) return localFontDataCache;
  const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts;
  if (!queryLocalFonts) return [];
  if (!localFontQueryPromise) {
    localFontQueryPromise = queryLocalFonts.call(window)
      .then((items) => {
        localFontDataCache = items.filter((item) => Boolean(item?.family?.trim()));
        return localFontDataCache;
      })
      .catch((error) => {
        localFontQueryPromise = null;
        throw error;
      });
  }
  return localFontQueryPromise;
}

export function supportsLocalFontAccess(): boolean {
  return typeof (window as LocalFontWindow).queryLocalFonts === "function";
}

export async function requestLocalFontsAccess(): Promise<string[]> {
  if (!supportsLocalFontAccess()) return BASIC_BROWSER_FONTS;
  const items = await queryLocalFontsNow();
  return uniqueFontFamilies([...BASIC_BROWSER_FONTS, ...items.map((item) => item.family)]);
}

export async function listSystemFonts(): Promise<string[]> {
  if (localFontDataCache?.length) return uniqueFontFamilies([...BASIC_BROWSER_FONTS, ...localFontDataCache.map((item) => item.family)]);
  if (!supportsLocalFontAccess() || !(await isLocalFontPermissionGranted())) return BASIC_BROWSER_FONTS;
  try {
    const items = await queryLocalFontsNow();
    return uniqueFontFamilies([...BASIC_BROWSER_FONTS, ...items.map((item) => item.family)]);
  } catch {
    return BASIC_BROWSER_FONTS;
  }
}

export async function listSystemFontFiles(): Promise<FontFileRecord[]> {
  if (localFontDataCache?.length) return localFontDataCache.map(localFontRecord);
  if (!supportsLocalFontAccess() || !(await isLocalFontPermissionGranted())) return [];
  try { return (await queryLocalFontsNow()).map(localFontRecord); } catch { return []; }
}

export async function activateLocalFontFamily(family: string, allVariants = true): Promise<void> {
  if (!supportsLocalFontAccess()) return;
  let items = localFontDataCache;
  if (!items) {
    if (!(await isLocalFontPermissionGranted())) return;
    try { items = await queryLocalFontsNow(); } catch { return; }
  }
  const matches = items.filter((item) => item.family.toLocaleLowerCase() === family.trim().toLocaleLowerCase());
  if (!matches.length) return;
  const regular = matches.find((item) => /regular|book|normal/i.test(item.style) && !/italic|oblique/i.test(item.style)) ?? matches[0];
  const selected = allVariants ? matches : [regular];
  await Promise.all(selected.map(async (entry) => {
    const meta = fontStyleMetadata(entry.style);
    const faceKey = `${entry.postscriptName || entry.fullName}:${meta.weight}:${meta.italic}`;
    if (loadedLocalFontFaces.has(faceKey)) return;
    try {
      const blob = await entry.blob();
      const url = URL.createObjectURL(blob);
      try {
        const face = new FontFace(entry.family, `url(${JSON.stringify(url)})`, {
          weight: String(meta.weight),
          style: meta.italic ? "italic" : "normal",
          display: "swap",
        });
        await face.load();
        (document.fonts as FontFaceSet & { add: (font: FontFace) => void }).add(face);
        loadedLocalFontFaces.add(faceKey);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      // The browser can still fall back to its own local-font resolution.
    }
  }));
}

export async function setAppFullscreen(fullscreen: boolean): Promise<void> {
  if (fullscreen) {
    await document.documentElement.requestFullscreen?.();
  } else if (document.fullscreenElement) {
    await document.exitFullscreen?.();
  }
}
