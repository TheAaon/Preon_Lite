import type { AppTheme, WorkspaceConfig } from "./types";
import { clamp } from "./utils";

export interface AppearancePrefs {
  theme: AppTheme;
  darkBrightness?: number;
  /** Legacy compatibility only. Light mode now keeps its designed fixed palette. */
  lightBrightness?: number;
}

type Palette = Record<string, string>;

const DARK: Palette = {
  "--bg": "#17181b",
  "--panel": "#202226",
  "--panel-soft": "#25272c",
  "--panel-hover": "#2c2f35",
  "--border": "#34373e",
  "--border-soft": "#2b2d32",
  "--ui-topbar": "#1e2024",
  "--ui-canvas": "#141518",
  "--ui-tabs": "#1f2125",
  "--ui-inspector-title": "#23252a",
  "--ui-inspector-summary": "#212328",
  "--ui-field-bg": "#181a1e",
  "--ui-ruler": "#24262b",
  "--ui-resizer": "#151619",
  "--ui-dropdown": "#25272c",
};

const LIGHT: Palette = {
  "--bg": "#f1ecdf",
  "--panel": "#fbf8f0",
  "--panel-soft": "#f4efe4",
  "--panel-hover": "#e9e4d9",
  "--border": "#d6d0c3",
  "--border-soft": "#e2dccf",
  "--ui-topbar": "#faf6ed",
  "--ui-canvas": "#dfd8ca",
  "--ui-tabs": "#f6f1e7",
  "--ui-inspector-title": "#f5f0e6",
  "--ui-inspector-summary": "#f5f0e6",
  "--ui-field-bg": "#fffdf8",
  "--ui-ruler": "#ece6da",
  "--ui-resizer": "#e2dccf",
  "--ui-dropdown": "#fffaf2",
};

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

function mix(base: string, target: string, amount: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(target);
  const t = clamp(amount, 0, 1);
  return rgbToHex([
    br + (tr - br) * t,
    bg + (tg - bg) * t,
    bb + (tb - bb) * t,
  ]);
}

function adjustedPalette(theme: "dark" | "light", brightness: number): Palette {
  const base = theme === "light" ? LIGHT : DARK;
  const normalized = (clamp(brightness, 0, 100) - 50) / 50;
  const target = normalized >= 0 ? "#ffffff" : "#000000";
  const maxMix = theme === "dark"
    ? (normalized >= 0 ? 0.30 : 0.18)
    : (normalized >= 0 ? 0.12 : 0.20);
  const amount = Math.abs(normalized) * maxMix;
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, mix(value, target, amount)]));
}

export function resolveWorkspaceTheme(theme: AppTheme): "dark" | "light" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

export function applyWorkspaceAppearance(workspace: AppearancePrefs | WorkspaceConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = resolveWorkspaceTheme(workspace.theme);
  // Light mode intentionally stays at the authored Pre'on cream palette so the
  // text/background contrast cannot be broken by a brightness slider.
  const brightness = theme === "dark" ? (workspace.darkBrightness ?? 50) : 50;
  root.dataset.themePreference = workspace.theme;
  root.dataset.theme = theme;
  const palette = adjustedPalette(theme, brightness);
  Object.entries(palette).forEach(([key, value]) => root.style.setProperty(key, value));
}
