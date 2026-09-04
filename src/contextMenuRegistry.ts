import type { ContextMenuProfile } from "./types";

export type ContextMenuCommandId =
  | "separator"
  | "undo" | "redo"
  | "copy" | "cut" | "paste" | "duplicate" | "delete" | "selectAll"
  | "lockToggle" | "group" | "ungroup"
  | "arrange" | "bringFront" | "bringForward" | "sendBackward" | "sendBack"
  | "align" | "alignLeft" | "alignCenter" | "alignRight" | "alignTop" | "alignMiddle" | "alignBottom" | "distributeHorizontal" | "distributeVertical"
  | "copyStyle" | "pasteStyle" | "selectSame" | "selectSameType" | "selectSameColor" | "selectSameStyle" | "selectSameFont" | "selectSameSize"
  | "eyedropperColor" | "eyedropperFormat" | "editText" | "toggleResizeMode"
  | "replaceImage" | "frameFit" | "fitContain" | "fitCover"
  | "add" | "addText" | "addShape" | "addImage" | "addSlideshow" | "addVideo" | "addModel3d" | "addWeb" | "addSlideNumber"
  | "addSlide" | "duplicateSlide" | "hideSlide" | "renameSlide" | "createSection" | "deleteSlide"
  | "openProperties" | "openTextOverview" | "openLayers" | "openAssets"
  | "present" | "exportHtml" | "exportPdf"
  | "newProject" | "openProject" | "save" | "saveAs" | "workspaceSettings";

export interface ContextMenuDefinition {
  id: ContextMenuCommandId;
  label: string;
  shortcut?: string;
  children?: ContextMenuCommandId[];
}

export const contextMenuDefinitions: ContextMenuDefinition[] = [
  { id: "undo", label: "Visszavonás", shortcut: "⌘Z" },
  { id: "redo", label: "Újra", shortcut: "⇧⌘Z" },
  { id: "copy", label: "Másolás", shortcut: "⌘C" },
  { id: "cut", label: "Kivágás", shortcut: "⌘X" },
  { id: "paste", label: "Beillesztés", shortcut: "⌘V" },
  { id: "duplicate", label: "Duplikálás", shortcut: "⌘D" },
  { id: "delete", label: "Törlés", shortcut: "⌫" },
  { id: "selectAll", label: "Összes kijelölése", shortcut: "⌘A" },
  { id: "lockToggle", label: "Zárolás / feloldás" },
  { id: "group", label: "Csoportosítás", shortcut: "⌘G" },
  { id: "ungroup", label: "Csoport felbontása", shortcut: "⇧⌘G" },
  { id: "arrange", label: "Sorrend", children: ["bringFront", "bringForward", "sendBackward", "sendBack"] },
  { id: "bringFront", label: "Legelőre" },
  { id: "bringForward", label: "Előrébb" },
  { id: "sendBackward", label: "Hátrébb" },
  { id: "sendBack", label: "Leghátra" },
  { id: "align", label: "Igazítás", children: ["alignLeft", "alignCenter", "alignRight", "alignTop", "alignMiddle", "alignBottom", "distributeHorizontal", "distributeVertical"] },
  { id: "alignLeft", label: "Balra" },
  { id: "alignCenter", label: "Középre" },
  { id: "alignRight", label: "Jobbra" },
  { id: "alignTop", label: "Felülre" },
  { id: "alignMiddle", label: "Függőlegesen középre" },
  { id: "alignBottom", label: "Alulra" },
  { id: "distributeHorizontal", label: "Vízszintes elosztás" },
  { id: "distributeVertical", label: "Függőleges elosztás" },
  { id: "copyStyle", label: "Stílus másolása", shortcut: "⌥⌘C" },
  { id: "pasteStyle", label: "Stílus beillesztése", shortcut: "⌥⌘V" },
  { id: "selectSame", label: "Azonos kijelölése", children: ["selectSameType", "selectSameColor", "selectSameStyle", "selectSameFont", "selectSameSize"] },
  { id: "selectSameType", label: "Objektumtípus" },
  { id: "selectSameColor", label: "Szín" },
  { id: "selectSameStyle", label: "Stílus" },
  { id: "selectSameFont", label: "Betűtípus" },
  { id: "selectSameSize", label: "Betűméret" },
  { id: "eyedropperColor", label: "Színpipetta" },
  { id: "eyedropperFormat", label: "Formázáspipetta" },
  { id: "editText", label: "Szöveg szerkesztése" },
  { id: "toggleResizeMode", label: "Box / Text Resize váltás" },
  { id: "replaceImage", label: "Kép cseréje" },
  { id: "frameFit", label: "Kép illesztése", children: ["fitContain", "fitCover"] },
  { id: "fitContain", label: "Kép a keretbe" },
  { id: "fitCover", label: "Keret kitöltése" },
  { id: "add", label: "Hozzáadás", children: ["addText", "addShape", "addImage", "addSlideshow", "addVideo", "addModel3d", "addWeb", "addSlideNumber"] },
  { id: "addText", label: "Szöveg hozzáadása" },
  { id: "addShape", label: "Alakzat hozzáadása" },
  { id: "addImage", label: "Kép hozzáadása" },
  { id: "addSlideshow", label: "Slideshow hozzáadása" },
  { id: "addVideo", label: "Videó hozzáadása" },
  { id: "addModel3d", label: "3D modell hozzáadása" },
  { id: "addWeb", label: "Webtartalom hozzáadása" },
  { id: "addSlideNumber", label: "Oldalszám hozzáadása" },
  { id: "addSlide", label: "Új dia" },
  { id: "duplicateSlide", label: "Dia duplikálása" },
  { id: "hideSlide", label: "Dia elrejtése / visszakapcsolása" },
  { id: "renameSlide", label: "Dia átnevezése" },
  { id: "createSection", label: "Új szekció létrehozása" },
  { id: "deleteSlide", label: "Dia törlése" },
  { id: "openProperties", label: "Tulajdonságok megnyitása" },
  { id: "openTextOverview", label: "Szövegek megnyitása" },
  { id: "openLayers", label: "Rétegek megnyitása" },
  { id: "openAssets", label: "Assetek megnyitása" },
  { id: "present", label: "Prezentálás", shortcut: "⌘↵" },
  { id: "exportHtml", label: "HTML csomag export" },
  { id: "exportPdf", label: "PDF export · slide méret" },
  { id: "newProject", label: "Új projekt", shortcut: "⌘N" },
  { id: "openProject", label: "Megnyitás", shortcut: "⌘O" },
  { id: "save", label: "Mentés", shortcut: "⌘S" },
  { id: "saveAs", label: "Mentés másként", shortcut: "⇧⌘S" },
  { id: "workspaceSettings", label: "Beállítások" },
];

export const contextMenuById = new Map(contextMenuDefinitions.map((item) => [item.id, item]));

export const contextMenuProfileLabels: Record<ContextMenuProfile, string> = {
  canvas: "Vászon",
  element: "Általános objektum",
  text: "Szöveg",
  shape: "Alakzat",
  media: "Kép / média",
  multi: "Több kijelölt elem",
  slide: "Dia bélyegkép",
};

export const defaultContextMenuItems: Record<ContextMenuProfile, string[]> = {
  canvas: ["undo", "redo", "separator", "paste", "selectAll", "separator", "add", "separator", "present"],
  element: ["copy", "cut", "paste", "duplicate", "delete", "separator", "lockToggle", "arrange", "separator", "copyStyle", "pasteStyle", "selectSame"],
  text: ["editText", "toggleResizeMode", "separator", "copy", "cut", "paste", "duplicate", "delete", "separator", "eyedropperColor", "eyedropperFormat", "copyStyle", "pasteStyle", "separator", "arrange", "selectSame"],
  shape: ["copy", "cut", "paste", "duplicate", "delete", "separator", "eyedropperColor", "copyStyle", "pasteStyle", "separator", "arrange", "selectSame"],
  media: ["copy", "cut", "paste", "duplicate", "delete", "separator", "replaceImage", "frameFit", "separator", "copyStyle", "pasteStyle", "arrange", "selectSame"],
  multi: ["copy", "cut", "duplicate", "delete", "separator", "group", "ungroup", "align", "arrange", "separator", "copyStyle", "pasteStyle"],
  slide: ["addSlide", "duplicateSlide", "hideSlide", "renameSlide", "separator", "createSection", "deleteSlide"],
};

export function normalizeContextMenuItems(value: unknown): Record<ContextMenuProfile, string[]> {
  const valid = new Set<string>(["separator", ...contextMenuDefinitions.map((item) => item.id)]);
  const source = value && typeof value === "object" ? value as Partial<Record<ContextMenuProfile, unknown>> : {};
  const result = {} as Record<ContextMenuProfile, string[]>;
  (Object.keys(defaultContextMenuItems) as ContextMenuProfile[]).forEach((profile) => {
    const hasSavedList = Array.isArray(source[profile]);
    const raw = hasSavedList ? source[profile] as unknown[] : defaultContextMenuItems[profile];
    const filtered = raw.filter((id): id is string => typeof id === "string" && valid.has(id));
    result[profile] = hasSavedList ? filtered : [...defaultContextMenuItems[profile]];
  });
  return result;
}
