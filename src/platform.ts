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
export async function listSystemFontFiles(): Promise<FontFileRecord[]> { return []; }
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

export async function listSystemFonts(): Promise<string[]> {
  return ["Arial", "Arial Black", "Courier New", "Georgia", "Helvetica", "Times New Roman", "Trebuchet MS", "Verdana"];
}

export async function setAppFullscreen(fullscreen: boolean): Promise<void> {
  if (fullscreen) {
    await document.documentElement.requestFullscreen?.();
  } else if (document.fullscreenElement) {
    await document.exitFullscreen?.();
  }
}
