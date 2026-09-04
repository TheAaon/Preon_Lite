import type { IconName } from "./components/Icon";

export interface ToolbarDefinition {
  id: string;
  label: string;
  icon?: IconName;
  category: "Eszközök" | "Média" | "Szerkesztés" | "Elrendezés";
}

export const toolbarDefinitions: ToolbarDefinition[] = [
  { id: "select", label: "Kijelölés", icon: "select", category: "Eszközök" },
  { id: "hand", label: "Kéz / vászon mozgatása", icon: "hand", category: "Eszközök" },
  { id: "text", label: "Szöveg", icon: "text", category: "Eszközök" },
  { id: "shape", label: "Alakzat", icon: "rect", category: "Eszközök" },
  { id: "imageFrame", label: "Képkeret rajzolása", icon: "imageFrame", category: "Eszközök" },
  { id: "image", label: "Kép / SVG / GIF", icon: "image", category: "Média" },
  { id: "slideshow", label: "Slideshow", icon: "slideshow", category: "Média" },
  { id: "video", label: "Videó", icon: "video", category: "Média" },
  { id: "model3d", label: "3D modell (GLB / glTF)", icon: "model3d", category: "Média" },
  { id: "slideNumber", label: "Dinamikus oldalszám", icon: "slideNumber", category: "Elrendezés" },
  { id: "web", label: "Weboldal beágyazása", icon: "web", category: "Média" },
  { id: "undo", label: "Visszavonás", icon: "undo", category: "Szerkesztés" },
  { id: "redo", label: "Újra", icon: "redo", category: "Szerkesztés" },
  { id: "duplicate", label: "Duplikálás", icon: "duplicate", category: "Szerkesztés" },
  { id: "delete", label: "Törlés", icon: "delete", category: "Szerkesztés" },
  { id: "align", label: "Igazítás", icon: "alignCenter", category: "Elrendezés" },
  { id: "group", label: "Csoport / felbontás", icon: "group", category: "Elrendezés" },
];

export const toolbarById = new Map(toolbarDefinitions.map((item) => [item.id, item]));
