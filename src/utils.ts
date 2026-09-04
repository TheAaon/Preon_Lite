import type { AssetKind, AssetRecord, Rect, SlideElement } from "./types";

export const APP_VERSION = "0.22.5";
export const APP_EDITION = "Lite 0.1.1";

export function newId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, precision = 0): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function isTauriRuntime(): boolean {
  return false;
}

export function assetUrl(asset?: AssetRecord): string {
  if (!asset) return "";
  if (asset.dataUrl) return asset.dataUrl;
  return asset.path ?? "";
}

export function detectAssetKind(name: string, mime = ""): AssetKind {
  const lower = name.toLowerCase();
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(lower)) return "video";
  if (mime === "model/gltf-binary" || mime === "model/gltf+json" || /\.(glb|gltf)$/.test(lower)) return "model3d";
  if (mime === "image/svg+xml" || lower.endsWith(".svg")) return "svg";
  if (mime === "image/gif" || lower.endsWith(".gif")) return "gif";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|avif|bmp)$/.test(lower)) return "image";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime === "text/html" || /\.html?$/.test(lower)) return "html";
  return "unknown";
}

export function safeFileName(name: string): string {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalized
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
}

export function elementBounds(elements: SlideElement[]): Rect {
  if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...elements.map((element) => element.x));
  const minY = Math.min(...elements.map((element) => element.y));
  const maxX = Math.max(...elements.map((element) => element.x + element.width));
  const maxY = Math.max(...elements.map((element) => element.y + element.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  return "application/octet-stream";
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("A fájl nem olvasható."));
    reader.readAsDataURL(file);
  });
}

export function downloadTextFile(name: string, contents: string, type = "application/json"): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBinaryFile(name: string, contents: BlobPart, type = "application/octet-stream"): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ") || "Névtelen prezentáció";
}

export function almostEqual(a: number, b: number, tolerance = 0.001): boolean {
  return Math.abs(a - b) <= tolerance;
}
