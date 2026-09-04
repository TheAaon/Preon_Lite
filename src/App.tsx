import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { EditorProvider, useEditor } from "./EditorContext";
import { createImageElement, createSlideshowElement, createPdfElement, createVideoElement, createWebElement, createModel3DElement, createTextElement, createShapeElement } from "./elementFactory";
import { migrateProject } from "./projectMigration";
import {
  chooseExportFolder,
  chooseHtmlAppFolder,
  chooseMediaFiles,
  chooseProjectFile,
  chooseSaveProjectPath,
  chooseSavePdfPath,
  chooseSaveWorkspacePath,
  chooseWorkspaceFile,
  exportHtmlBundle,
  importAsset,
  importHtmlApp,
  listenForNativeDrops,
  readTextFile,
  readBinaryFile,
  startLocalShare,
  openPath,
  revealInFolder,
  saveTextFallback,
  writeTextFile,
  writeBinaryFile,
  activateLocalFontFamily,
} from "./platform";
import type { AssetRecord, ContextMenuProfile, PresentationProject, Slide, SlideElement, WorkspaceConfig } from "./types";
import {
  deepClone,
  detectAssetKind,
  downloadBinaryFile,
  getMimeFromName,
  isTauriRuntime,
  newId,
  readFileAsDataUrl,
  safeFileName,
} from "./utils";
import { applyWorkspaceAppearance } from "./theme";
import { applyColorToElement, applyElementStyleSnapshot, createElementStyleSnapshot, elementStyleSignature, primaryElementColor, primaryFontFamily, type ElementStyleSnapshot } from "./elementAppearance";
import { EditorCanvas } from "./components/EditorCanvas";
import { PresentMode } from "./components/PresentMode";
import { RightPanel } from "./components/RightPanel";
import { SlidesPanel } from "./components/SlidesPanel";
import { TopBar } from "./components/TopBar";
import { WebEmbedDialog } from "./components/WebEmbedDialog";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { AboutDialog } from "./components/AboutDialog";
import { tr } from "./i18n";
import { Icon } from "./components/Icon";
import { ContextMenu } from "./components/ContextMenu";
import { type ContextMenuCommandId } from "./contextMenuRegistry";
import { defaultBackground, defaultGrid, defaultNotesBoard } from "./defaultProject";
import { clearPdfCaches, getPdfPageCount, withRenderedPdfPages } from "./pdfSupport";


function cloneForPaste(elements: SlideElement[]): SlideElement[] {
  const groupMap = new Map<string, string>();
  return elements.map((element) => {
    const clone = deepClone(element);
    clone.id = newId(element.type);
    clone.x += 24;
    clone.y += 24;
    if (clone.groupId) {
      if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, newId("group"));
      clone.groupId = groupMap.get(clone.groupId);
    }
    return clone;
  });
}

function normalizeLoadedProject(value: unknown): PresentationProject {
  return migrateProject(value);
}

type ContextMenuTarget =
  | { kind: "canvas" }
  | { kind: "element"; elementId: string; profile: ContextMenuProfile }
  | { kind: "slide"; slideId: string };

interface OpenContextMenu {
  x: number;
  y: number;
  profile: ContextMenuProfile;
  target: ContextMenuTarget;
}

function bytesToBase64(bytes: number[]): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

const glbDataUrlCache = new Map<string, string>();

type BrowserWritable = {
  write: (data: Blob | string | Uint8Array) => Promise<void>;
  close: () => Promise<void>;
};

type BrowserFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<BrowserWritable>;
};

type BrowserPickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>;
};

async function writeBrowserHandle(handle: BrowserFileHandle, data: string | Uint8Array): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}


async function withFileSafeGlbAssets(project: PresentationProject): Promise<PresentationProject> {
  const clone = deepClone(project);
  const usedModelIds = new Set<string>();
  clone.slides.forEach((slide) => slide.elements.forEach((element) => { if (element.type === "model3d") usedModelIds.add(element.assetId); }));
  clone.masters.forEach((master) => master.elements.forEach((element) => { if (element.type === "model3d") usedModelIds.add(element.assetId); }));
  for (const asset of clone.assets) {
    if (!usedModelIds.has(asset.id) || asset.dataUrl || !asset.path || !asset.name.toLowerCase().endsWith(".glb")) continue;
    const cached = glbDataUrlCache.get(asset.path);
    if (cached) { asset.dataUrl = cached; continue; }
    const bytes = await readBinaryFile(asset.path);
    asset.dataUrl = `data:model/gltf-binary;base64,${bytesToBase64(bytes)}`;
    glbDataUrlCache.set(asset.path, asset.dataUrl);
  }
  return clone;
}

function StudioApp() {
  const {
    state,
    activeContainer,
    selectedElements,
    setSelection,
    setSlideSelection,
    setTool,
    setStatus,
    updateWorkspace,
    replaceWorkspace,
    replaceProject,
    newProject,
    updateProject,
    updateElements,
    addAsset,
    addElement,
    markSaved,
    undo,
    redo,
    deleteSelection,
    duplicateSelection,
    duplicateSlides,
    deleteSlides,
    addSlide,
    groupSelection,
    ungroupSelection,
    alignSelection,
    reorderElement,
    setPresentMode,
  } = useEditor();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [webDialogOpen, setWebDialogOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<OpenContextMenu | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clipboardRef = useRef<SlideElement[]>([]);
  const styleClipboardRef = useRef<ElementStyleSnapshot | null>(null);
  const browserProjectHandleRef = useRef<BrowserFileHandle | null>(null);
  const lanShareActiveRef = useRef(false);
  const lanPublishRevisionRef = useRef(0);
  const t = useCallback((text: string) => tr(state.workspace.language, text), [state.workspace.language]);

  useEffect(() => {
    applyWorkspaceAppearance(state.workspace);
    document.documentElement.lang = state.workspace.language === "en" ? "en" : "hu";
    if (state.workspace.theme !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = () => applyWorkspaceAppearance(state.workspace);
    media.addEventListener?.("change", handleSystemTheme);
    return () => media.removeEventListener?.("change", handleSystemTheme);
  }, [state.workspace.language, state.workspace.theme, state.workspace.darkBrightness]);

  useEffect(() => {
    const families = new Set<string>();
    const collect = (elements: SlideElement[]) => elements.forEach((element) => {
      if (element.type === "text") families.add(primaryFontFamily(element.fontFamily));
    });
    state.project.slides.forEach((slide) => { collect(slide.elements); collect(slide.notesBoard?.elements ?? []); });
    state.project.masters.forEach((master) => collect(master.elements));
    state.project.textStyles.forEach((style) => families.add(primaryFontFamily(style.fontFamily)));
    families.forEach((family) => { void activateLocalFontFamily(family, true); });
  }, [state.project.id]);

  const notify = useCallback((message: string) => {
    setStatus(message);
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, [setStatus]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;

      const slideNode = target.closest<HTMLElement>("[data-slide-id]");
      if (slideNode?.dataset.slideId) {
        event.preventDefault();
        const slideId = slideNode.dataset.slideId;
        if (!state.slideSelection.includes(slideId)) setSlideSelection([slideId], slideId);
        setContextMenu({ x: event.clientX, y: event.clientY, profile: "slide", target: { kind: "slide", slideId } });
        return;
      }

      const elementNode = target.closest<HTMLElement>("[data-element-id]");
      if (elementNode?.dataset.elementId) {
        event.preventDefault();
        const elementId = elementNode.dataset.elementId;
        const clicked = activeContainer.elements.find((element) => element.id === elementId);
        if (!clicked) return;
        const keepMulti = state.selection.includes(elementId) && state.selection.length > 1;
        if (!state.selection.includes(elementId)) setSelection([elementId]);
        const profile: ContextMenuProfile = keepMulti
          ? "multi"
          : clicked.type === "text"
            ? "text"
            : clicked.type === "shape"
              ? "shape"
              : ["image", "slideshow", "video", "pdf", "model3d"].includes(clicked.type)
                ? "media"
                : "element";
        setContextMenu({ x: event.clientX, y: event.clientY, profile, target: { kind: "element", elementId, profile } });
        return;
      }

      if (target.closest(".editor-viewport")) {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, profile: "canvas", target: { kind: "canvas" } });
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [activeContainer.elements, setSelection, setSlideSelection, state.selection, state.slideSelection]);

  const createAssetRecord = useCallback(async (path: string): Promise<AssetRecord> => {
    const imported = await importAsset(path);
    const kind = detectAssetKind(imported.name);
    const asset: AssetRecord = {
      id: newId("asset"),
      name: imported.name,
      path: imported.path,
      kind,
      mime: getMimeFromName(imported.name),
      size: imported.size,
      bundleRoot: kind === "model3d" && imported.name.toLowerCase().endsWith(".gltf")
        ? imported.path.replace(/[\\/][^\\/]+$/, "")
        : undefined,
      createdAt: new Date().toISOString(),
    };
    if (kind === "pdf") asset.pageCount = await getPdfPageCount(asset);
    return asset;
  }, []);

  const importPdfAsSlides = useCallback((asset: AssetRecord) => {
    if (asset.kind !== "pdf") return;
    const pageCount = Math.max(1, asset.pageCount ?? 1);
    const active = state.project.slides.find((slide) => slide.id === state.activeSlideId);
    const masterId = active?.masterId ?? state.project.masters[0]?.id ?? null;
    const sectionId = active?.sectionId;
    const width = state.project.width;
    const height = state.project.height;
    const created: Slide[] = Array.from({ length: pageCount }, (_, index) => {
      const element = createPdfElement(asset.id, pageCount, 0, 0);
      element.page = index + 1;
      element.name = `${asset.name} · ${index + 1}. oldal`;
      element.x = 0;
      element.y = 0;
      element.width = width;
      element.height = height;
      element.fit = "contain";
      element.radius = 0;
      return {
        id: newId("slide"),
        name: `${asset.name} · ${index + 1}`,
        hidden: false,
        masterId,
        sectionId,
        background: defaultBackground(true),
        guides: { vertical: [], horizontal: [] },
        grid: defaultGrid(),
        inheritMasterGrid: true,
        elements: [element],
        notes: "",
        notesBoard: defaultNotesBoard(),
        transition: "fade",
        longformHeightScale: 1,
        longformSticky: false,
      };
    });
    updateProject((project) => {
      if (!project.assets.some((candidate) => candidate.id === asset.id)) project.assets.push(asset);
      const activeIndex = project.slides.findIndex((slide) => slide.id === state.activeSlideId);
      const insertAt = activeIndex >= 0 ? activeIndex + 1 : project.slides.length;
      project.slides.splice(insertAt, 0, ...created);
    });
    window.setTimeout(() => setSlideSelection(created.map((slide) => slide.id), created[0]?.id), 0);
    notify(`${asset.name} · ${pageCount} PDF oldal külön diákként importálva`);
  }, [notify, setSlideSelection, state.activeSlideId, state.project.height, state.project.masters, state.project.slides, state.project.width, updateProject]);

  const addAssetAsElement = useCallback((asset: AssetRecord, offerPdfSlideImport = false) => {
    addAsset(asset);
    if (["image", "svg", "gif"].includes(asset.kind)) {
      addElement(createImageElement(asset.id, 240, 180));
      notify(`${asset.name} hozzáadva`);
      return;
    }
    if (asset.kind === "video") {
      addElement(createVideoElement(asset.id, 240, 180));
      notify(`${asset.name} hozzáadva`);
      return;
    }
    if (asset.kind === "pdf") {
      const pageCount = Math.max(1, asset.pageCount ?? 1);
      if (offerPdfSlideImport && !state.editingMasterId && !state.editingNotesBoard && pageCount > 1) {
        const asSlides = window.confirm(state.workspace.language === "en"
          ? `${asset.name} has ${pageCount} pages.\n\nOK: import every PDF page as a separate slide\nCancel: insert page 1 as an editable PDF element on the current slide`
          : `${asset.name} ${pageCount} oldalas.\n\nOK: minden PDF-oldal külön diaként\nMégse: az 1. oldal beszúrása szerkeszthető PDF-elemként az aktuális diára`);
        if (asSlides) {
          importPdfAsSlides(asset);
          return;
        }
      }
      const element = createPdfElement(asset.id, pageCount, 240, 120);
      element.name = asset.name;
      addElement(element);
      notify(`${asset.name} · PDF hozzáadva`);
      return;
    }
    if (asset.kind === "model3d") {
      addElement(createModel3DElement(asset.id, 260, 180));
      notify(`${asset.name} – 3D modell hozzáadva`);
      return;
    }
    if (asset.kind === "html" || asset.kind === "html-app") {
      const element = createWebElement("", 210, 150);
      element.sourceType = "local";
      element.assetId = asset.id;
      element.name = asset.name;
      addElement(element);
      notify(`${asset.name} beágyazva`);
      return;
    }
    notify(`Nem támogatott fájltípus: ${asset.name}`);
  }, [addAsset, addElement, importPdfAsSlides, notify, state.editingMasterId, state.editingNotesBoard, state.workspace.language]);

  const replaceImageAsset = useCallback((elementId: string, asset: AssetRecord) => {
    if (!["image", "svg", "gif"].includes(asset.kind)) {
      notify(`Képfájlt válassz: ${asset.name}`);
      return false;
    }
    const target = activeContainer.elements.find((candidate) => candidate.id === elementId);
    if (!target || target.type !== "image") return false;

    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    const editingNotesBoard = state.editingNotesBoard;
    updateProject((project) => {
      const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
      const container = editingMasterId
        ? project.masters.find((master) => master.id === editingMasterId)
        : editingNotesBoard
          ? slide?.notesBoard
          : slide;
      const element = container?.elements.find((candidate) => candidate.id === elementId);
      if (!element || element.type !== "image") return;
      project.assets.push(asset);
      element.assetId = asset.id;
      element.name = element.name === "Kép" || !element.name ? asset.name : element.name;
    });
    notify(`${asset.name} – kép cserélve, a keret megmaradt`);
    return true;
  }, [activeContainer.elements, notify, state.activeSlideId, state.editingMasterId, state.editingNotesBoard, updateProject]);

  const applyAssetToExistingElement = useCallback((elementId: string, asset: AssetRecord) => {
    const target = activeContainer.elements.find((candidate) => candidate.id === elementId);
    if (!target) return false;
    const isImageLike = ["image", "svg", "gif"].includes(asset.kind);
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    const editingNotesBoard = state.editingNotesBoard;
    if (target.type === "image" && isImageLike) return replaceImageAsset(elementId, asset);
    if (target.type === "slideshow" && isImageLike) {
      updateProject((project) => {
        if (!project.assets.some((candidate) => candidate.id === asset.id)) project.assets.push(asset);
        const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
        const container = editingMasterId
          ? project.masters.find((master) => master.id === editingMasterId)
          : editingNotesBoard
            ? slide?.notesBoard
            : slide;
        const element = container?.elements.find((candidate) => candidate.id === elementId);
        if (element?.type === "slideshow") element.assetIds.push(asset.id);
      });
      notify(`${asset.name} – hozzáadva a slideshow-hoz`);
      return true;
    }
    if (target.type === "shape" && target.shape !== "line" && (isImageLike || asset.kind === "video")) {
      updateProject((project) => {
        project.assets.push(asset);
        const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
        const container = editingMasterId
          ? project.masters.find((master) => master.id === editingMasterId)
          : editingNotesBoard
            ? slide?.notesBoard
            : slide;
        const element = container?.elements.find((candidate) => candidate.id === elementId);
        if (element?.type === "shape") {
          element.fillAssetId = asset.id;
          element.fillType = asset.kind === "video" ? "video" : "image";
          element.fillFit = "cover";
        }
      });
      notify(`${asset.name} – alakzat kitöltéseként beállítva`);
      return true;
    }
    return false;
  }, [activeContainer.elements, notify, replaceImageAsset, state.activeSlideId, state.editingMasterId, state.editingNotesBoard, updateProject]);


  const handleNativePaths = useCallback(async (
    paths: string[],
    preferred: "image" | "video" | "model" | "any" = "any",
    targetElementId?: string,
  ) => {
    let targetAvailable = Boolean(targetElementId);
    const targetAcceptsMultiple = Boolean(targetElementId && activeContainer.elements.find((element) => element.id === targetElementId)?.type === "slideshow");
    for (const path of paths) {
      try {
        const asset = await createAssetRecord(path);
        if (preferred === "image" && !["image", "svg", "gif"].includes(asset.kind)) {
          notify(`Képfájlt válassz: ${asset.name}`);
          continue;
        }
        if (preferred === "video" && asset.kind !== "video") {
          notify(`Videófájlt válassz: ${asset.name}`);
          continue;
        }
        if (preferred === "model" && asset.kind !== "model3d") {
          notify(`GLB vagy glTF modellt válassz: ${asset.name}`);
          continue;
        }
        if (targetAvailable && targetElementId && applyAssetToExistingElement(targetElementId, asset)) {
          if (!targetAcceptsMultiple) targetAvailable = false;
          continue;
        }
        addAssetAsElement(asset, true);
      } catch (error) {
        notify(`Fájlimport hiba: ${String(error)}`);
      }
    }
  }, [activeContainer.elements, addAssetAsElement, applyAssetToExistingElement, createAssetRecord, notify]);

  const handleBrowserFiles = useCallback(async (files: File[], targetElementId?: string) => {
    let targetAvailable = Boolean(targetElementId);
    const targetAcceptsMultiple = Boolean(targetElementId && activeContainer.elements.find((element) => element.id === targetElementId)?.type === "slideshow");
    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const asset: AssetRecord = {
          id: newId("asset"),
          name: file.name,
          dataUrl,
          kind: detectAssetKind(file.name, file.type),
          mime: file.type,
          size: file.size,
          createdAt: new Date().toISOString(),
        };
        if (asset.kind === "pdf") asset.pageCount = await getPdfPageCount(asset);
        if (targetAvailable && targetElementId && applyAssetToExistingElement(targetElementId, asset)) {
          if (!targetAcceptsMultiple) targetAvailable = false;
          continue;
        }
        addAssetAsElement(asset, true);
      } catch (error) {
        notify(`Fájlimport hiba: ${String(error)}`);
      }
    }
  }, [activeContainer.elements, addAssetAsElement, applyAssetToExistingElement, notify]);

  const nativeDropHandlerRef = useRef(handleNativePaths);
  const lastNativeDropRef = useRef<{ signature: string; at: number } | null>(null);
  useEffect(() => {
    nativeDropHandlerRef.current = handleNativePaths;
  }, [handleNativePaths]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listenForNativeDrops(({ paths, clientX, clientY }) => {
      const signature = `${paths.join("|")}@${Math.round(clientX ?? -1)},${Math.round(clientY ?? -1)}`;
      const now = Date.now();
      const previous = lastNativeDropRef.current;
      if (previous && previous.signature === signature && now - previous.at < 900) return;
      lastNativeDropRef.current = { signature, at: now };
      const target = clientX !== undefined && clientY !== undefined
        ? document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-element-id]")
        : null;
      void nativeDropHandlerRef.current(paths, "any", target?.dataset.elementId);
    }).then((value) => {
      if (disposed) value?.();
      else unlisten = value;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const addMedia = useCallback(async (kind: "image" | "video" | "model" | "any") => {
    if (isTauriRuntime()) {
      const paths = await chooseMediaFiles(kind);
      if (paths.length) await handleNativePaths(paths, kind);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = kind === "image" ? "image/*,.svg" : kind === "video" ? "video/*" : kind === "model" ? ".glb,.gltf,model/gltf-binary,model/gltf+json" : "image/*,video/*,.svg,.pdf,application/pdf,.html,.htm,.glb,.gltf";
    input.onchange = () => void handleBrowserFiles(Array.from(input.files ?? []));
    input.click();
  }, [handleBrowserFiles, handleNativePaths]);

  const applySlideshowAssets = useCallback((assets: AssetRecord[], elementId?: string) => {
    const images = assets.filter((asset) => ["image", "svg", "gif"].includes(asset.kind));
    if (!images.length) {
      notify("A slideshow-hoz képfájlokat válassz.");
      return;
    }
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    const editingNotesBoard = state.editingNotesBoard;
    let createdId = elementId ?? "";
    updateProject((project) => {
      images.forEach((asset) => {
        if (!project.assets.some((candidate) => candidate.id === asset.id)) project.assets.push(asset);
      });
      const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
      const container = editingMasterId
        ? project.masters.find((master) => master.id === editingMasterId)
        : editingNotesBoard
          ? slide?.notesBoard
          : slide;
      if (!container) return;
      if (elementId) {
        const element = container.elements.find((candidate) => candidate.id === elementId);
        if (element?.type === "slideshow") element.assetIds.push(...images.map((asset) => asset.id));
        return;
      }
      const element = createSlideshowElement(images.map((asset) => asset.id), 240, 180);
      element.name = images.length === 1 ? `${images[0].name} slideshow` : `Slideshow · ${images.length} kép`;
      createdId = element.id;
      container.elements.push(element);
    });
    if (!elementId && createdId) window.setTimeout(() => setSelection([createdId]), 0);
    notify(elementId ? `${images.length} kép hozzáadva a slideshow-hoz` : `Slideshow létrehozva · ${images.length} kép`);
  }, [notify, setSelection, state.activeSlideId, state.editingMasterId, state.editingNotesBoard, updateProject]);

  const chooseSlideshowImages = useCallback(async (elementId?: string) => {
    if (isTauriRuntime()) {
      const paths = await chooseMediaFiles("image");
      if (!paths.length) return;
      const assets: AssetRecord[] = [];
      for (const path of paths) {
        try {
          const asset = await createAssetRecord(path);
          if (["image", "svg", "gif"].includes(asset.kind)) assets.push(asset);
        } catch (error) {
          notify(`Slideshow import hiba: ${String(error)}`);
        }
      }
      if (assets.length) applySlideshowAssets(assets, elementId);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.svg";
    input.onchange = async () => {
      const assets: AssetRecord[] = [];
      for (const file of Array.from(input.files ?? [])) {
        const dataUrl = await readFileAsDataUrl(file);
        const asset: AssetRecord = {
          id: newId("asset"),
          name: file.name,
          dataUrl,
          kind: detectAssetKind(file.name, file.type),
          mime: file.type,
          size: file.size,
          createdAt: new Date().toISOString(),
        };
        if (["image", "svg", "gif"].includes(asset.kind)) assets.push(asset);
      }
      if (assets.length) applySlideshowAssets(assets, elementId);
    };
    input.click();
  }, [applySlideshowAssets, createAssetRecord, notify]);

  const chooseReplacementImage = useCallback(async (elementId: string) => {
    if (isTauriRuntime()) {
      const paths = await chooseMediaFiles("image");
      if (!paths[0]) return;
      try {
        const asset = await createAssetRecord(paths[0]);
        replaceImageAsset(elementId, asset);
      } catch (error) {
        notify(`Képcsere hiba: ${String(error)}`);
      }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.svg";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleBrowserFiles([file], elementId);
    };
    input.click();
  }, [createAssetRecord, handleBrowserFiles, notify, replaceImageAsset]);

  const chooseShapeMedia = useCallback(async (elementId: string, kind: "image" | "video") => {
    if (isTauriRuntime()) {
      const paths = await chooseMediaFiles(kind);
      if (!paths[0]) return;
      try {
        const asset = await createAssetRecord(paths[0]);
        if (!applyAssetToExistingElement(elementId, asset)) notify("Ez a média nem használható az alakzat kitöltéseként.");
      } catch (error) { notify(`Alakzat média hiba: ${String(error)}`); }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "video" ? "video/*" : "image/*,.svg";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const dataUrl = await readFileAsDataUrl(file);
      const asset: AssetRecord = { id:newId("asset"), name:file.name, dataUrl, kind:detectAssetKind(file.name,file.type), mime:file.type, size:file.size, createdAt:new Date().toISOString() };
      applyAssetToExistingElement(elementId, asset);
    };
    input.click();
  }, [applyAssetToExistingElement, createAssetRecord, notify]);

  const chooseMaskSvg = useCallback(async (elementId: string) => {
    let asset: AssetRecord | null = null;
    if (isTauriRuntime()) {
      const paths = await chooseMediaFiles("image");
      if (!paths[0]) return;
      try {
        asset = await createAssetRecord(paths[0]);
      } catch (error) {
        notify(`SVG maszk hiba: ${String(error)}`);
        return;
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".svg,image/svg+xml";
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return;
      asset = {
        id: newId("asset"),
        name: file.name,
        dataUrl: await readFileAsDataUrl(file),
        kind: detectAssetKind(file.name, file.type),
        mime: file.type || "image/svg+xml",
        size: file.size,
        createdAt: new Date().toISOString(),
      };
    }
    if (asset.kind !== "svg") {
      notify("Maszknak SVG fájlt válassz.");
      return;
    }
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    const editingNotesBoard = state.editingNotesBoard;
    updateProject((project) => {
      project.assets.push(asset!);
      const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
      const container = editingMasterId
        ? project.masters.find((master) => master.id === editingMasterId)
        : editingNotesBoard
          ? slide?.notesBoard
          : slide;
      const element = container?.elements.find((candidate) => candidate.id === elementId);
      if (element && (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf")) {
        element.mask = { kind: "svg", assetId: asset!.id };
      }
    });
    notify(`${asset.name} maszkként beállítva`);
  }, [createAssetRecord, notify, state.activeSlideId, state.editingMasterId, state.editingNotesBoard, updateProject]);

  const setBackgroundMedia = useCallback(async (kind: "image" | "video") => {
    let asset: AssetRecord | null = null;
    if (isTauriRuntime()) {
      const paths = await chooseMediaFiles(kind);
      if (!paths[0]) return;
      try {
        asset = await createAssetRecord(paths[0]);
      } catch (error) {
        notify(`Háttérimport hiba: ${String(error)}`);
        return;
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = kind === "video" ? "video/*" : "image/*,.svg";
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return;
      asset = {
        id: newId("asset"),
        name: file.name,
        dataUrl: await readFileAsDataUrl(file),
        kind: detectAssetKind(file.name, file.type),
        mime: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
    }

    const accepted = kind === "image" ? ["image", "svg", "gif"].includes(asset.kind) : asset.kind === "video";
    if (!accepted) {
      notify(kind === "image" ? "Képfájlt válassz." : "Videófájlt válassz.");
      return;
    }
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    const editingNotesBoard = state.editingNotesBoard;
    const selectedSlideIds = state.slideSelection.length ? state.slideSelection : [activeSlideId];
    const selectedSet = new Set(selectedSlideIds);
    updateProject((project) => {
      project.assets.push(asset!);
      if (editingMasterId) {
        const container = project.masters.find((master) => master.id === editingMasterId);
        if (container) {
          container.background.assetId = asset!.id;
          container.background.type = kind;
          container.background.inherit = false;
        }
        return;
      }
      if (editingNotesBoard) {
        const board = project.slides.find((slide) => slide.id === activeSlideId)?.notesBoard;
        if (board) {
          board.background.assetId = asset!.id;
          board.background.type = kind;
          board.background.inherit = false;
        }
        return;
      }
      project.slides.forEach((slide) => {
        if (!selectedSet.has(slide.id)) return;
        slide.background.assetId = asset!.id;
        slide.background.type = kind;
        slide.background.inherit = false;
      });
    });
    notify(editingNotesBoard ? "Jegyzetlap háttérmédia beállítva" : selectedSlideIds.length > 1 ? `Háttérmédia beállítva ${selectedSlideIds.length} dián` : "Háttérmédia beállítva");
  }, [createAssetRecord, notify, state.activeSlideId, state.editingMasterId, state.editingNotesBoard, state.slideSelection, updateProject]);

  const saveProjectAs = useCallback(async () => {
    const contents = JSON.stringify(state.project, null, 2);
    const pickerWindow = window as BrowserPickerWindow;
    if (pickerWindow.showSaveFilePicker) {
      try {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: `${safeFileName(state.project.name)}.preon`,
          types: [{ description: "Pre'on project", accept: { "application/json": [".preon", ".pstudio", ".json"] } }],
        });
        await writeBrowserHandle(handle, contents);
        browserProjectHandleRef.current = handle;
        markSaved(null);
        notify("Projekt mentve a helyi fájlba");
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
        console.warn("File System Access save failed; falling back to download.", error);
      }
    }
    await saveTextFallback(`${safeFileName(state.project.name)}.preon`, contents);
    browserProjectHandleRef.current = null;
    markSaved(null);
    notify("Projekt letöltve");
  }, [markSaved, notify, state.project]);

  const saveProject = useCallback(async () => {
    const handle = browserProjectHandleRef.current;
    if (!handle) {
      await saveProjectAs();
      return;
    }
    try {
      await writeBrowserHandle(handle, JSON.stringify(state.project, null, 2));
      markSaved(null);
      notify("Projekt mentve");
    } catch (error) {
      notify(`Mentési hiba: ${String(error)}`);
    }
  }, [markSaved, notify, saveProjectAs, state.project]);

  const openProject = useCallback(async () => {
    if (state.dirty && !window.confirm("A nem mentett módosítások elveszhetnek. Megnyitod a másik projektet?")) return;
    const pickerWindow = window as BrowserPickerWindow;
    if (pickerWindow.showOpenFilePicker) {
      try {
        const [handle] = await pickerWindow.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Pre'on project", accept: { "application/json": [".preon", ".pstudio", ".json"] } }],
        });
        if (!handle) return;
        const file = await handle.getFile();
        const project = normalizeLoadedProject(JSON.parse(await file.text()));
        clearPdfCaches();
        browserProjectHandleRef.current = handle;
        replaceProject(project, null);
        notify("Projekt megnyitva · közvetlen mentés aktív");
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
        console.warn("File System Access open failed; falling back to file input.", error);
      }
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".preon,.pstudio,.json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const project = normalizeLoadedProject(JSON.parse(await file.text()));
        clearPdfCaches();
        browserProjectHandleRef.current = null;
        replaceProject(project, null);
        notify("Projekt megnyitva");
      } catch (error) {
        notify(`Megnyitási hiba: ${String(error)}`);
      }
    };
    input.click();
  }, [notify, replaceProject, state.dirty]);

  const createNew = useCallback(() => {
    if (state.dirty && !window.confirm("A nem mentett módosítások elvesznek. Létrehozol egy új projektet?")) return;
    clearPdfCaches();
    browserProjectHandleRef.current = null;
    newProject();
    window.setTimeout(() => window.dispatchEvent(new Event("ps-fit-canvas")), 80);
  }, [newProject, state.dirty]);

  const fontCheck = useCallback(async () => {
    const families = Array.from(new Set(
      [...state.project.slides.flatMap((slide) => slide.elements), ...state.project.masters.flatMap((master) => master.elements)]
        .filter((element) => element.type === "text")
        .map((element) => element.type === "text" ? element.fontFamily : "")
        .filter(Boolean),
    ));
    if (!families.length) {
      window.alert("Pre'on Lite Font Check\n\nNincs szöveg a prezentációban.");
      return;
    }
    const report = families
      .map((family) => `${document.fonts?.check?.(`16px "${family}"`) ? "✓" : "⚠"} ${family}`)
      .join("\n");
    window.alert(`Pre'on Lite Font Check\n\n${report}\n\nA webes kiadás a böngésző által elérhető fontokat használja.`);
  }, [state.project]);

  const exportHtml = useCallback(async () => {
    try {
      const [{ prepareExport }, { buildHtmlExport }] = await Promise.all([
        import("./exportPreparation"),
        import("./exportHtml"),
      ]);
      const includePresenter = state.project.htmlExportMode === "presenter";
      const prepared = isTauriRuntime() ? await prepareExport(state.project, includePresenter) : { fontFaces: [], fontAssets: [], textOutlines: {}, fontStatus: [] };
      const glbProject = isTauriRuntime() ? await withFileSafeGlbAssets(state.project) : state.project;
      const htmlProject = await withRenderedPdfPages(glbProject, 2400);
      const { html, presenterHtml, assets } = await buildHtmlExport(htmlProject, { ...prepared, includePresenter });
      if (!isTauriRuntime()) {
        await saveTextFallback(includePresenter ? "presentation.html" : "index.html", html);
        if (includePresenter && presenterHtml) await saveTextFallback("presenter.html", presenterHtml);
        notify(includePresenter
          ? "A presentation.html és presenter.html letöltve"
          : "Az index.html letöltve");
        return;
      }
      const folder = await chooseExportFolder();
      if (!folder) return;
      const result = await exportHtmlBundle(folder, `${safeFileName(state.project.name)}-web`, html, presenterHtml, assets);
      const embedded = prepared.fontStatus.filter((item) => item.status === "embedded").length;
      const outlined = prepared.fontStatus.filter((item) => item.status === "outlined").length;
      const missing = prepared.fontStatus.filter((item) => item.status === "missing");
      notify(`HTML export kész · ${embedded} font beágyazva · ${outlined} outline`);
      const fontNote = missing.length ? `\n\nFigyelem: ${missing.map((item) => item.family).join(", ")} nem volt teljesen csomagolható.` : "";
      if (window.confirm(`Elkészült az export:\n${result}${fontNote}\n\nMegnyitod a mappát?`)) await revealInFolder(result);
    } catch (error) {
      notify(`Export hiba: ${String(error)}`);
    }
  }, [notify, state.project]);

  const exportPdf = useCallback(async () => {
    try {
      const { buildDirectPdf } = await import("./exportPdf");
      notify("PDF renderelés…");
      const bytes = await buildDirectPdf(state.project, (current, total) => setStatus(`PDF renderelés ${current}/${total}`));
      const fileName = `${safeFileName(state.project.name)}.pdf`;
      const pickerWindow = window as BrowserPickerWindow;
      if (pickerWindow.showSaveFilePicker) {
        try {
          const handle = await pickerWindow.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
          });
          await writeBrowserHandle(handle, bytes);
          notify(`PDF elkészült · ${state.project.width}×${state.project.height} slide-oldalak`);
          return;
        } catch (error) {
          if ((error as DOMException)?.name === "AbortError") return;
          console.warn("PDF save picker failed; falling back to download.", error);
        }
      }
      downloadBinaryFile(fileName, bytes, "application/pdf");
      notify(`PDF letöltve · ${state.project.width}×${state.project.height} slide-oldalak`);
    } catch (error) {
      notify(`PDF export hiba: ${String(error)}`);
    }
  }, [notify, setStatus, state.project]);

  const publishLanSnapshot = useCallback(async (projectSnapshot: PresentationProject, revision: number) => {
    const [{ prepareExport }, { buildHtmlExport }] = await Promise.all([
      import("./exportPreparation"),
      import("./exportHtml"),
    ]);
    const prepared = await prepareExport(projectSnapshot, false);
    const glbProject = await withFileSafeGlbAssets(projectSnapshot);
    const shareProject = await withRenderedPdfPages(glbProject, 2200);
    const liveReloadToken = `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const { html, assets } = await buildHtmlExport(shareProject, { ...prepared, liveReloadToken });
    if (revision !== lanPublishRevisionRef.current) return null;
    const share = await startLocalShare(html, assets, liveReloadToken);
    if (revision !== lanPublishRevisionRef.current) return null;
    return share;
  }, []);

  useEffect(() => {
    if (!lanShareActiveRef.current || !isTauriRuntime()) return;
    const revision = ++lanPublishRevisionRef.current;
    const snapshot = state.project;
    const timer = window.setTimeout(() => {
      void publishLanSnapshot(snapshot, revision)
        .then((share) => { if (share) setStatus(`LAN Live Preview · ${share.url}`); })
        .catch((error) => setStatus(`LAN Live Preview hiba: ${String(error)}`));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [publishLanSnapshot, setStatus, state.project]);

  const shareOnLan = useCallback(async () => {
    if (!isTauriRuntime()) { notify("A LAN megosztás a desktop verzióban használható."); return; }
    try {
      const revision = ++lanPublishRevisionRef.current;
      notify(lanShareActiveRef.current ? "LAN Live Preview frissítése…" : "LAN Live Preview indítása…");
      const share = await publishLanSnapshot(state.project, revision);
      if (!share) return;
      lanShareActiveRef.current = true;
        try { await navigator.clipboard.writeText(share.url); } catch { /* nincs clipboard engedély */ }
      notify(`LAN Live Preview: ${share.url}`);
      window.alert(state.workspace.language === "en"
        ? `Live Preview is available on the local network:

${share.url}

The address was copied to the clipboard. Keep this page open: edits in Pre'on refresh automatically, including One Slide mode and 3D content. No re-share is needed.`
        : `A Live Preview elérhető a helyi hálózaton:

${share.url}

A címet a vágólapra másoltam. Hagyd nyitva ezt az oldalt: a Pre'onban végzett módosítások automatikusan frissülnek, One Slide módban és 3D tartalomnál is. Nem kell újra megosztani.`);
    } catch (error) { notify(`LAN megosztási hiba: ${String(error)}`); }
  }, [notify, publishLanSnapshot, state.project, state.workspace.language]);


  const exportWorkspace = useCallback(async () => {
    const contents = JSON.stringify(state.workspace, null, 2);
    if (!isTauriRuntime()) {
      await saveTextFallback(`${safeFileName(state.workspace.name)}.pworkspace`, contents);
      return;
    }
    const path = await chooseSaveWorkspacePath(safeFileName(state.workspace.name));
    if (!path) return;
    await writeTextFile(path, contents);
    notify("Workspace exportálva");
  }, [notify, state.workspace]);

  const importWorkspaceFile = useCallback(async () => {
    if (!isTauriRuntime()) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pworkspace,.json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          replaceWorkspace(JSON.parse(await file.text()) as WorkspaceConfig);
          notify("Workspace importálva");
        } catch (error) {
          notify(`Workspace import hiba: ${String(error)}`);
        }
      };
      input.click();
      return;
    }
    const path = await chooseWorkspaceFile();
    if (!path) return;
    try {
      replaceWorkspace(JSON.parse(await readTextFile(path)) as WorkspaceConfig);
      notify("Workspace importálva");
    } catch (error) {
      notify(`Workspace import hiba: ${String(error)}`);
    }
  }, [notify, replaceWorkspace]);

  const addHtmlApp = useCallback(async () => {
    if (!isTauriRuntime()) {
      notify("HTML app mappa importja a desktop verzióban használható.");
      return;
    }
    const folder = await chooseHtmlAppFolder();
    if (!folder) return;
    try {
      const imported = await importHtmlApp(folder);
      const asset: AssetRecord = {
        id: newId("asset"),
        name: imported.name,
        path: imported.path,
        bundleRoot: imported.path.replace(/[\\/]index\.html$/i, ""),
        kind: "html-app",
        mime: "text/html",
        size: imported.size,
        createdAt: new Date().toISOString(),
      };
      addAsset(asset);
      const element = createWebElement("", 210, 150);
      element.sourceType = "local";
      element.assetId = asset.id;
      element.name = asset.name;
      addElement(element);
      notify(`${asset.name} HTML app beágyazva`);
    } catch (error) {
      notify(`HTML app import hiba: ${String(error)}`);
    }
  }, [addAsset, addElement, notify]);

  const addSlideNumber = useCallback(() => {
    const element = createTextElement(state.project.width - 310, state.project.height - 112);
    element.name = "Oldalszám";
    element.width = 220;
    element.height = 56;
    element.fontSize = 24;
    element.fontWeight = 550;
    element.lineHeight = 1.1;
    element.textAlign = "right";
    element.dynamicField = "slide-number";
    element.numberFormat = "01";
    element.text = "01";
    addElement(element);
    notify(state.editingMasterId ? "Dinamikus oldalszám hozzáadva a mesterhez" : "Dinamikus oldalszám hozzáadva");
  }, [addElement, notify, state.editingMasterId, state.project.height, state.project.width]);

  const addWebUrl = (url: string) => {
    addElement(createWebElement(url, 210, 150));
    setWebDialogOpen(false);
    notify("Webtartalom hozzáadva");
  };

  const copyStyle = useCallback(() => {
    const source = selectedElements[0];
    if (!source) { notify("Jelölj ki egy forráselemet"); return; }
    styleClipboardRef.current = createElementStyleSnapshot(source);
    notify("Stílus másolva");
  }, [notify, selectedElements]);

  const pasteStyle = useCallback(() => {
    const snapshot = styleClipboardRef.current;
    if (!snapshot || !state.selection.length) return;
    updateElements(state.selection, (element) => applyElementStyleSnapshot(element, snapshot));
    notify("Stílus alkalmazva");
  }, [notify, state.selection, updateElements]);

  const startColorEyedropper = useCallback(async () => {
    if (!state.selection.length) { notify("Előbb jelölj ki egy célelemet"); return; }
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (EyeDropperCtor) {
      try {
        const result = await new EyeDropperCtor().open();
        let changed = 0;
        updateElements(state.selection, (element) => { if (applyColorToElement(element, result.sRGBHex)) changed += 1; });
        notify(changed ? `Pipetta: ${result.sRGBHex}` : "A kijelölés nem színezhető");
        setTool("select");
        return;
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
      }
    }
    setTool("eyedropperColor");
    notify("Kattints a mintázandó színre");
  }, [notify, setTool, state.selection, updateElements]);

  const startFormatEyedropper = useCallback(() => {
    if (!selectedElements.some((element) => element.type === "text")) {
      notify("A formázáspipettához jelölj ki szöveget");
      return;
    }
    setTool("eyedropperFormat");
    notify("Kattints a mintázandó szövegre");
  }, [notify, selectedElements, setTool]);

  const pasteClipboard = useCallback(() => {
    if (!clipboardRef.current.length) return;
    const copies = cloneForPaste(clipboardRef.current);
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    const editingNotesBoard = state.editingNotesBoard;
    updateProject((project) => {
      const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
      const container = editingMasterId
        ? project.masters.find((master) => master.id === editingMasterId)
        : editingNotesBoard
          ? slide?.notesBoard
          : slide;
      container?.elements.push(...copies);
    });
    setSelection(copies.map((element) => element.id));
  }, [setSelection, state.activeSlideId, state.editingMasterId, state.editingNotesBoard, updateProject]);

  const contextSelection = selectedElements;

  const selectSameFromContext = useCallback((mode: "type" | "font" | "size" | "color" | "style") => {
    const source = selectedElements[0];
    if (!source) return;
    const sourceColor = primaryElementColor(source);
    const sourceStyle = elementStyleSignature(source);
    const sourceFont = source.type === "text" ? primaryFontFamily(source.fontFamily).toLocaleLowerCase() : "";
    const ids = activeContainer.elements.filter((candidate) => {
      if (!candidate.visible) return false;
      if (mode === "type") return candidate.type === source.type;
      if (mode === "color") return Boolean(sourceColor) && primaryElementColor(candidate) === sourceColor;
      if (mode === "style") return candidate.type === source.type && elementStyleSignature(candidate) === sourceStyle;
      if (source.type !== "text" || candidate.type !== "text") return false;
      if (mode === "font") return primaryFontFamily(candidate.fontFamily).toLocaleLowerCase() === sourceFont;
      return candidate.fontSize === source.fontSize;
    }).map((candidate) => candidate.id);
    setSelection(ids);
    notify(ids.length ? `${ids.length} azonos elem kijelölve` : "Nincs egyező elem");
  }, [activeContainer.elements, notify, selectedElements, setSelection]);

  const contextCommandVisible = useCallback((id: ContextMenuCommandId) => {
    const menu = contextMenu;
    if (!menu) return false;
    const globalIds = new Set<ContextMenuCommandId>([
      "undo", "redo", "openProperties", "openTextOverview", "openLayers", "openAssets",
      "present", "exportHtml", "exportPdf", "newProject", "openProject", "save", "saveAs", "workspaceSettings",
    ]);
    if (globalIds.has(id)) return true;
    if (menu.target.kind === "slide") return ["addSlide", "duplicateSlide", "hideSlide", "renameSlide", "createSection", "deleteSlide"].includes(id);
    if (["add", "addText", "addShape", "addImage", "addSlideshow", "addVideo", "addModel3d", "addWeb", "addSlideNumber"].includes(id)) return true;
    if (id === "paste" || id === "selectAll") return true;
    if (!contextSelection.length) return false;
    if (["copy", "cut", "duplicate", "delete", "lockToggle", "arrange", "bringFront", "bringForward", "sendBackward", "sendBack", "copyStyle", "pasteStyle", "selectSame", "selectSameType", "selectSameColor", "selectSameStyle"].includes(id)) return true;
    if (["group", "ungroup", "align", "alignLeft", "alignCenter", "alignRight", "alignTop", "alignMiddle", "alignBottom", "distributeHorizontal", "distributeVertical"].includes(id)) return contextSelection.length > 1;
    const allText = contextSelection.every((element) => element.type === "text");
    if (id === "editText") return contextSelection.length === 1 && contextSelection[0].type === "text";
    if (["eyedropperFormat", "toggleResizeMode", "selectSameFont", "selectSameSize"].includes(id)) return allText;
    if (id === "eyedropperColor") return contextSelection.some((element) => element.type === "text" || element.type === "shape");
    if (id === "replaceImage") return contextSelection.length === 1 && contextSelection[0].type === "image";
    if (["frameFit", "fitContain", "fitCover"].includes(id)) return contextSelection.some((element) => element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf");
    return false;
  }, [contextMenu, contextSelection]);

  const contextCommandEnabled = useCallback((id: ContextMenuCommandId) => {
    if (id === "undo") return state.historyPast.length > 0;
    if (id === "redo") return state.historyFuture.length > 0;
    if (id === "paste") return clipboardRef.current.length > 0;
    if (id === "pasteStyle") return Boolean(styleClipboardRef.current) && state.selection.length > 0;
    if (id === "group") return state.selection.length >= 2;
    if (id === "ungroup") return selectedElements.some((element) => Boolean(element.groupId));
    if (["distributeHorizontal", "distributeVertical"].includes(id)) return state.selection.length >= 3;
    if (["align", "alignLeft", "alignCenter", "alignRight", "alignTop", "alignMiddle", "alignBottom"].includes(id)) return state.selection.length >= 2;
    if (["copy", "cut", "duplicate", "delete", "lockToggle", "arrange", "bringFront", "bringForward", "sendBackward", "sendBack", "copyStyle", "selectSame", "selectSameType", "selectSameColor", "selectSameStyle", "selectSameFont", "selectSameSize", "eyedropperColor", "eyedropperFormat", "editText", "toggleResizeMode", "replaceImage", "frameFit", "fitContain", "fitCover"].includes(id)) return state.selection.length > 0;
    if (["duplicateSlide", "hideSlide", "renameSlide", "createSection", "deleteSlide"].includes(id)) return Boolean(contextMenu && contextMenu.target.kind === "slide");
    return true;
  }, [contextMenu, selectedElements, state.historyFuture.length, state.historyPast.length, state.selection.length]);

  const runContextCommand = useCallback((id: ContextMenuCommandId) => {
    const menu = contextMenu;
    const selectionIds = [...state.selection];
    const slideTargetId = menu?.target.kind === "slide" ? menu.target.slideId : null;
    const slideIds = slideTargetId && state.slideSelection.includes(slideTargetId) ? state.slideSelection : slideTargetId ? [slideTargetId] : state.slideSelection;
    const reorderSelected = (direction: "front" | "forward" | "backward" | "back") => {
      const ordered = activeContainer.elements.filter((element) => selectionIds.includes(element.id)).map((element) => element.id);
      const ids = direction === "back" || direction === "backward" ? [...ordered].reverse() : ordered;
      ids.forEach((elementId) => reorderElement(elementId, direction));
    };
    switch (id) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "copy": clipboardRef.current = deepClone(selectedElements); notify(`${selectedElements.length} elem másolva`); break;
      case "cut": clipboardRef.current = deepClone(selectedElements); deleteSelection(); break;
      case "paste": pasteClipboard(); break;
      case "duplicate": duplicateSelection(); break;
      case "delete": deleteSelection(); break;
      case "selectAll": setSelection(activeContainer.elements.filter((element) => element.visible).map((element) => element.id)); break;
      case "lockToggle": {
        const unlock = selectedElements.length > 0 && selectedElements.every((element) => element.locked);
        updateElements(selectionIds, (element) => { element.locked = !unlock; });
        break;
      }
      case "group": groupSelection(); break;
      case "ungroup": ungroupSelection(); break;
      case "bringFront": reorderSelected("front"); break;
      case "bringForward": reorderSelected("forward"); break;
      case "sendBackward": reorderSelected("backward"); break;
      case "sendBack": reorderSelected("back"); break;
      case "alignLeft": alignSelection("left"); break;
      case "alignCenter": alignSelection("center"); break;
      case "alignRight": alignSelection("right"); break;
      case "alignTop": alignSelection("top"); break;
      case "alignMiddle": alignSelection("middle"); break;
      case "alignBottom": alignSelection("bottom"); break;
      case "distributeHorizontal": alignSelection("distribute-horizontal"); break;
      case "distributeVertical": alignSelection("distribute-vertical"); break;
      case "copyStyle": copyStyle(); break;
      case "pasteStyle": pasteStyle(); break;
      case "selectSameType": selectSameFromContext("type"); break;
      case "selectSameColor": selectSameFromContext("color"); break;
      case "selectSameStyle": selectSameFromContext("style"); break;
      case "selectSameFont": selectSameFromContext("font"); break;
      case "selectSameSize": selectSameFromContext("size"); break;
      case "eyedropperColor": void startColorEyedropper(); break;
      case "eyedropperFormat": startFormatEyedropper(); break;
      case "editText": {
        const text = selectedElements.find((element) => element.type === "text");
        if (text) window.dispatchEvent(new CustomEvent("preon-edit-element", { detail: { elementId: text.id } }));
        break;
      }
      case "toggleResizeMode": updateElements(selectionIds, (element) => { if (element.type === "text") element.resizeMode = element.resizeMode === "box" ? "scale" : "box"; }); break;
      case "replaceImage": { const image = selectedElements.find((element) => element.type === "image"); if (image) void chooseReplacementImage(image.id); break; }
      case "fitContain": updateElements(selectionIds, (element) => { if (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") { element.fit = "contain"; if ("contentScale" in element) element.contentScale = 1; } }); break;
      case "fitCover": updateElements(selectionIds, (element) => { if (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") { element.fit = "cover"; if ("contentScale" in element) element.contentScale = 1; } }); break;
      case "addText": addElement(createTextElement(160, 160)); break;
      case "addShape": addElement(createShapeElement(state.workspace.selectedShape, 220, 180)); break;
      case "addImage": void addMedia("image"); break;
      case "addSlideshow": void chooseSlideshowImages(); break;
      case "addVideo": void addMedia("video"); break;
      case "addModel3d": void addMedia("model"); break;
      case "addWeb": setWebDialogOpen(true); break;
      case "addSlideNumber": addSlideNumber(); break;
      case "addSlide": addSlide(); break;
      case "duplicateSlide": if (slideIds.length) duplicateSlides(slideIds); break;
      case "hideSlide": if (slideIds.length) {
        const chosen = state.project.slides.filter((slide) => slideIds.includes(slide.id));
        const nextHidden = !chosen.every((slide) => slide.hidden);
        updateProject((project) => project.slides.forEach((slide) => { if (slideIds.includes(slide.id)) slide.hidden = nextHidden; }));
        break;
      }
      case "renameSlide": if (slideTargetId) {
        const slide = state.project.slides.find((candidate) => candidate.id === slideTargetId);
        const name = window.prompt(t("Dia átnevezése"), slide?.name ?? "");
        if (name?.trim()) updateProject((project) => { const target = project.slides.find((candidate) => candidate.id === slideTargetId); if (target) target.name = name.trim(); });
        break;
      }
      case "createSection": if (slideIds.length) {
        const sectionId = newId("section");
        updateProject((project) => { project.sections.push({ id: sectionId, name: t("Új szekció"), collapsed: false }); project.slides.forEach((slide) => { if (slideIds.includes(slide.id)) slide.sectionId = sectionId; }); });
        break;
      }
      case "deleteSlide": if (slideIds.length) deleteSlides(slideIds); break;
      case "openProperties": updateWorkspace({ rightVisible: true, rightTab: "properties" }); break;
      case "openTextOverview": updateWorkspace({ rightVisible: true, rightTab: "textOverview" }); break;
      case "openLayers": updateWorkspace({ rightVisible: true, rightTab: "layers" }); break;
      case "openAssets": updateWorkspace({ rightVisible: true, rightTab: "assets" }); break;
      case "present": setPresentMode(true); break;
      case "exportHtml": void exportHtml(); break;
      case "exportPdf": void exportPdf(); break;
      case "newProject": createNew(); break;
      case "openProject": void openProject(); break;
      case "save": void saveProject(); break;
      case "saveAs": void saveProjectAs(); break;
      case "workspaceSettings": setWorkspaceOpen(true); break;
      default: break;
    }
  }, [activeContainer.elements, addElement, addMedia, addSlide, addSlideNumber, alignSelection, chooseReplacementImage, chooseSlideshowImages, contextMenu, copyStyle, createNew, deleteSelection, deleteSlides, duplicateSelection, duplicateSlides, exportHtml, exportPdf, groupSelection, notify, openProject, pasteClipboard, pasteStyle, redo, reorderElement, saveProject, saveProjectAs, selectSameFromContext, selectedElements, setPresentMode, setSelection, shareOnLan, startColorEyedropper, startFormatEyedropper, state.project.slides, state.selection, state.slideSelection, state.workspace.selectedShape, t, undo, ungroupSelection, updateElements, updateProject, updateWorkspace]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
      if (editable || state.presentMode) return;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (command && key === "s") {
        event.preventDefault();
        if (event.shiftKey) void saveProjectAs();
        else void saveProject();
      } else if (command && key === "o") {
        event.preventDefault();
        void openProject();
      } else if (command && key === "n") {
        event.preventDefault();
        createNew();
      } else if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (command && key === "d") {
        event.preventDefault();
        if (state.selection.length) duplicateSelection();
        else if (state.slideSelection.length > 1) duplicateSlides();
      } else if (command && event.altKey && key === "c") {
        event.preventDefault();
        copyStyle();
      } else if (command && event.altKey && key === "v") {
        event.preventDefault();
        pasteStyle();
      } else if (command && key === "c") {
        event.preventDefault();
        clipboardRef.current = deepClone(selectedElements);
        notify(`${selectedElements.length} elem másolva`);
      } else if (command && key === "x") {
        event.preventDefault();
        clipboardRef.current = deepClone(selectedElements);
        deleteSelection();
      } else if (command && key === "v") {
        event.preventDefault();
        pasteClipboard();
      } else if (command && key === "a") {
        event.preventDefault();
        setSelection(activeContainer.elements.filter((element) => element.visible).map((element) => element.id));
      } else if (command && key === "g") {
        event.preventDefault();
        if (event.shiftKey) ungroupSelection();
        else groupSelection();
      } else if (command && event.shiftKey && key === "e") {
        event.preventDefault();
        void exportHtml();
      } else if (command && event.key === "Enter") {
        event.preventDefault();
        setPresentMode(true);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        if (state.selection.length) {
          event.preventDefault();
          deleteSelection();
        } else if (state.slideSelection.length > 1) {
          event.preventDefault();
          deleteSlides();
        }
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && state.selection.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        updateElements(state.selection, (element) => {
          if (element.locked) return;
          if (event.key === "ArrowLeft") element.x -= step;
          if (event.key === "ArrowRight") element.x += step;
          if (event.key === "ArrowUp") element.y -= step;
          if (event.key === "ArrowDown") element.y += step;
        });
      } else if (event.key === "Escape") {
        setSelection([]);
        setTool("select");
      } else if (event.key === "1") {
        window.dispatchEvent(new Event("ps-fit-canvas"));
      } else if (key === "v") setTool("select");
      else if (key === "h") setTool("hand");
      else if (key === "t") setTool("text");
      else if (key === "r") setTool("rect");
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [
    activeContainer.elements,
    createNew,
    deleteSelection,
    deleteSlides,
    duplicateSelection,
    duplicateSlides,
    exportHtml,
    groupSelection,
    notify,
    openProject,
    pasteClipboard,
    pasteStyle,
    copyStyle,
    redo,
    saveProject,
    saveProjectAs,
    selectedElements,
    setPresentMode,
    setSelection,
    setSlideSelection,
    setTool,
    state.presentMode,
    state.selection,
    state.slideSelection,
    undo,
    ungroupSelection,
    updateElements,
  ]);

  const startPanelResize = (side: "left" | "right", event: ReactPointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? state.workspace.leftWidth : state.workspace.rightWidth;
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      updateWorkspace({
        [side === "left" ? "leftWidth" : "rightWidth"]:
          side === "left"
            ? Math.max(210, Math.min(460, startWidth + delta))
            : Math.max(280, Math.min(560, startWidth - delta)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="app-shell">
      <TopBar
        onNew={createNew}
        onOpen={() => void openProject()}
        onSave={() => void saveProject()}
        onSaveAs={() => void saveProjectAs()}
        onExportHtml={() => void exportHtml()}
        onFontCheck={() => void fontCheck()}
        onExportPdf={() => void exportPdf()}
        onShareLan={() => void shareOnLan()}
        onAddMedia={(kind) => void addMedia(kind)}
        onAddSlideshow={() => void chooseSlideshowImages()}
        onAddSlideNumber={addSlideNumber}
        onAddWeb={() => setWebDialogOpen(true)}
        onAddHtmlApp={() => void addHtmlApp()}
        onPresent={() => setPresentMode(true)}
        onWorkspace={() => setWorkspaceOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onEyedropperColor={() => void startColorEyedropper()}
        onEyedropperFormat={startFormatEyedropper}
        onCopyStyle={copyStyle}
        onPasteStyle={pasteStyle}
        canPasteStyle={Boolean(styleClipboardRef.current)}
      />

      <div className="workspace-shell" style={{ "--left-panel-width": `${state.workspace.leftWidth}px`, "--right-panel-width": `${state.workspace.rightWidth}px` } as CSSProperties}>
        {state.workspace.leftVisible && <SlidesPanel />}
        {state.workspace.leftVisible && <div className="panel-resizer left-resizer" onPointerDown={(event) => startPanelResize("left", event)} />}
        <main className={`canvas-area ${state.workspace.showNotesBoard && !state.editingMasterId ? "presenter-notes-visible" : ""}`}>
          <EditorCanvas onBrowserFilesDropped={handleBrowserFiles} onReplaceImage={(elementId) => void chooseReplacementImage(elementId)} />
        </main>
        {state.workspace.rightVisible && <div className="panel-resizer right-resizer" onPointerDown={(event) => startPanelResize("right", event)} />}
        {state.workspace.rightVisible && <RightPanel onSetBackgroundMedia={(kind) => void setBackgroundMedia(kind)} onReplaceImage={(elementId) => void chooseReplacementImage(elementId)} onChooseMaskSvg={(elementId) => void chooseMaskSvg(elementId)} onChooseShapeMedia={(elementId, kind) => void chooseShapeMedia(elementId, kind)} onAddSlideshowImages={(elementId) => void chooseSlideshowImages(elementId)} onUseAsset={(asset) => addAssetAsElement(asset, false)} onImportAssets={() => void addMedia("any")} onImportPdfAsSlides={importPdfAsSlides} />}
      </div>

      <footer className="status-bar">
        <div><span className={`status-dot ${state.dirty ? "dirty" : ""}`} />{t(state.status)}</div>
        <div className="status-center">
          <span>{t(state.editingNotesBoard ? "Előadói jegyzetlap" : state.editingMasterId ? "Mester szerkesztése" : state.workspace.canvasView === "continuous" ? "Folyamatos mód" : "Slide mód")}</span>
          <span>{state.selection.length ? `${state.selection.length} ${t("kijelölt elem")}` : t("Nincs kijelölés")}</span>
        </div>
        <div>
          <span>{state.project.width} × {state.project.height}</span>
          <span>{state.project.assets.length} {t("asset")}</span>
          <button onClick={() => updateWorkspace({ leftVisible: !state.workspace.leftVisible })} title={t("Bal panel")}><Icon name={state.workspace.leftVisible ? "panelLeftClose" : "panelLeftOpen"} size={14} /></button>
          <button onClick={() => updateWorkspace({ rightVisible: !state.workspace.rightVisible })} title={t("Jobb panel")}><Icon name={state.workspace.rightVisible ? "panelRightClose" : "panelRightOpen"} size={14} /></button>
        </div>
      </footer>

      {contextMenu && <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={state.workspace.contextMenuItems[contextMenu.profile] ?? []}
        language={state.workspace.language}
        onCommand={runContextCommand}
        isVisible={contextCommandVisible}
        isEnabled={contextCommandEnabled}
        onClose={() => setContextMenu(null)}
      />}

      {workspaceOpen && (
        <WorkspaceDialog
          onClose={() => setWorkspaceOpen(false)}
          onExport={() => void exportWorkspace()}
          onImport={() => void importWorkspaceFile()}
        />
      )}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {webDialogOpen && (
        <WebEmbedDialog
          onClose={() => setWebDialogOpen(false)}
          onAdd={addWebUrl}
          onChooseLocal={() => {
            setWebDialogOpen(false);
            void addMedia("any");
          }}
        />
      )}
      {state.presentMode && <PresentMode />}
      {toast && <div className="toast"><Icon name="check" size={15} />{toast}</div>}
    </div>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <StudioApp />
    </EditorProvider>
  );
}
