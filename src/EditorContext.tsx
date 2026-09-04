import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createDefaultProject, defaultBackground, defaultGrid, defaultNotesBoard, defaultWorkspace } from "./defaultProject";
import type {
  AssetRecord,
  EditorState,
  MasterSlide,
  NotesBoard,
  PresentationProject,
  Slide,
  SlideElement,
  ToolId,
  WorkspaceConfig,
} from "./types";
import { clamp, deepClone, elementBounds, newId } from "./utils";
import { migrateProject } from "./projectMigration";
import { resolvedMasterBackground, resolvedMasterElements, resolvedMasterGrid, resolvedMasterGuides } from "./masterResolver";
import { applyWorkspaceAppearance } from "./theme";
import { normalizeContextMenuItems } from "./contextMenuRegistry";

const AUTOSAVE_KEY = "presentation-studio.autosave.v1";
const WORKSPACE_KEY = "presentation-studio.workspace.v1";
const HISTORY_LIMIT = 80;

function normalizeWorkspace(workspace: Partial<WorkspaceConfig>): WorkspaceConfig {
  const merged = { ...defaultWorkspace, ...workspace } as WorkspaceConfig;
  const oldShapeIds = new Set(["rect", "ellipse", "line"]);
  const sourceItems = Array.isArray(workspace.toolbarItems) ? workspace.toolbarItems : defaultWorkspace.toolbarItems;
  const legacyToolbar = sourceItems.some((id) => oldShapeIds.has(id));
  const normalizedItems: string[] = [];
  let shapeAdded = false;
  for (const id of sourceItems) {
    // v0.12 default toolbar migration: the dynamic page-number button leaves the default row,
    // but users may still add it manually from Workspace in v0.13.
    if (id === "slideNumber" && legacyToolbar) continue;
    if (oldShapeIds.has(id) || id === "shape") {
      if (!shapeAdded) normalizedItems.push("shape");
      shapeAdded = true;
      continue;
    }
    normalizedItems.push(id);
  }
  // v0.21.2: surface the new Slideshow tool next to Image for existing workspaces
  // that already expose Image. Custom toolbars without Image stay untouched.
  if (!normalizedItems.includes("slideshow")) {
    const imageIndex = normalizedItems.indexOf("image");
    if (imageIndex >= 0) normalizedItems.splice(imageIndex + 1, 0, "slideshow");
  }
  merged.toolbarItems = normalizedItems;
  merged.contextMenuItems = normalizeContextMenuItems(workspace.contextMenuItems);
  const validShapes = new Set(["rect", "rounded-rect", "ellipse", "triangle", "star", "polygon", "line", "arrow"]);
  if (!validShapes.has(merged.selectedShape)) merged.selectedShape = "rect";
  if (!new Set(["dark", "light", "system"]).has(merged.theme)) merged.theme = "dark";
  if (!new Set(["properties", "textOverview", "layers", "assets"]).has(merged.rightTab)) merged.rightTab = "properties";
  const darkBrightness = Number(merged.darkBrightness);
  merged.darkBrightness = Number.isFinite(darkBrightness) ? clamp(darkBrightness, 0, 100) : 50;
  // Kept in the workspace format for older workspace imports, but light mode
  // itself is fixed at the designed palette from v0.20.6 onward.
  merged.lightBrightness = 50;
  return merged;
}

function loadWorkspace(): WorkspaceConfig {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return normalizeWorkspace(defaultWorkspace);
    return normalizeWorkspace(JSON.parse(raw) as Partial<WorkspaceConfig>);
  } catch {
    return normalizeWorkspace(defaultWorkspace);
  }
}

function loadProject(): PresentationProject {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return createDefaultProject();
    return migrateProject(JSON.parse(raw));
  } catch {
    return createDefaultProject();
  }
}

function getContainer(
  project: PresentationProject,
  activeSlideId: string,
  editingMasterId: string | null,
  editingNotesBoard = false,
): Slide | MasterSlide | NotesBoard {
  if (editingMasterId) {
    return project.masters.find((master) => master.id === editingMasterId) ?? project.masters[0];
  }
  const slide = project.slides.find((candidate) => candidate.id === activeSlideId) ?? project.slides[0];
  if (editingNotesBoard) {
    slide.notesBoard ??= defaultNotesBoard();
    return slide.notesBoard;
  }
  return slide;
}

function remapElements(elements: SlideElement[], offset = 0): SlideElement[] {
  const groupMap = new Map<string, string>();
  return elements.map((element) => {
    const clone = deepClone(element);
    clone.id = newId(element.type);
    clone.x += offset;
    clone.y += offset;
    if (clone.groupId) {
      if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, newId("group"));
      clone.groupId = groupMap.get(clone.groupId);
    }
    return clone;
  });
}

export type AlignReference = "selection" | "slide";

export type AlignMode =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distribute-horizontal"
  | "distribute-vertical";

interface EditorContextValue {
  state: EditorState;
  activeContainer: Slide | MasterSlide | NotesBoard;
  activeSlide: Slide;
  activeMaster: MasterSlide | null;
  selectedElements: SlideElement[];
  selectedSlides: Slide[];
  setTool: (tool: ToolId) => void;
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setStatus: (status: string) => void;
  updateWorkspace: (patch: Partial<WorkspaceConfig>) => void;
  replaceWorkspace: (workspace: WorkspaceConfig) => void;
  resetWorkspace: () => void;
  setProjectPath: (path: string | null) => void;
  markSaved: (path?: string | null) => void;
  replaceProject: (project: PresentationProject, path?: string | null) => void;
  newProject: () => void;
  updateProject: (mutator: (project: PresentationProject) => void, recordHistory?: boolean) => void;
  updateSlideNotes: (slideId: string, notes: string, notesHtml?: string) => void;
  beginInteraction: () => PresentationProject;
  finishInteraction: (snapshot: PresentationProject) => void;
  undo: () => void;
  redo: () => void;
  setActiveSlide: (id: string) => void;
  setSlideSelection: (ids: string[], activeId?: string) => void;
  setEditingMaster: (id: string | null) => void;
  setEditingNotesBoard: (enabled: boolean) => void;
  addSlide: () => void;
  duplicateSlide: (id?: string) => void;
  duplicateSlides: (ids?: string[]) => void;
  deleteSlide: (id?: string) => void;
  deleteSlides: (ids?: string[]) => void;
  updateSlides: (ids: string[], mutator: (slide: Slide) => void, recordHistory?: boolean) => void;
  reorderSlide: (from: number, to: number) => void;
  addMaster: () => void;
  duplicateMaster: (id?: string) => void;
  deleteMaster: (id?: string) => void;
  addElement: (element: SlideElement) => void;
  updateElement: (id: string, patch: Partial<SlideElement>, recordHistory?: boolean) => void;
  updateSlideElement: (slideId: string, id: string, patch: Partial<SlideElement>, recordHistory?: boolean) => void;
  updateElements: (
    ids: string[],
    updater: (element: SlideElement) => void,
    recordHistory?: boolean,
  ) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  alignSelection: (mode: AlignMode, reference?: AlignReference) => void;
  bakeMasterIntoSlide: () => void;
  detachMasterElement: (masterElementId: string) => void;
  resetMasterOverride: (masterElementId: string) => void;
  reorderElement: (id: string, direction: "front" | "forward" | "backward" | "back") => void;
  addAsset: (asset: AssetRecord) => void;
  setPresentMode: (enabled: boolean, index?: number) => void;
  setPresentIndex: (index: number) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const initialProject = useMemo(loadProject, []);
  const [state, setState] = useState<EditorState>(() => ({
    project: initialProject,
    projectPath: null,
    activeSlideId: initialProject.slides[0]?.id ?? "",
    slideSelection: initialProject.slides[0]?.id ? [initialProject.slides[0].id] : [],
    editingMasterId: null,
    editingNotesBoard: false,
    selection: [],
    tool: "select",
    zoom: 0.5,
    pan: { x: 80, y: 70 },
    workspace: loadWorkspace(),
    historyPast: [],
    historyFuture: [],
    dirty: false,
    status: "Készen áll",
    presentMode: false,
    presentIndex: 0,
  }));
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    const save = () => {
      if (cancelled) return;
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state.project));
      } catch {
        // A projekt ettől még kézzel menthető.
      }
    };
    const timer = window.setTimeout(() => {
      const requestIdle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
      if (requestIdle) idleId = requestIdle(save, { timeout: 1200 });
      else save();
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId !== null) {
        const cancelIdle = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
        cancelIdle?.(idleId);
      }
    };
  }, [state.project]);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state.workspace));
    } catch {
      // A workspace export továbbra is használható.
    }
  }, [state.workspace]);

  const activeContainer = useMemo(
    () => getContainer(state.project, state.activeSlideId, state.editingMasterId, state.editingNotesBoard),
    [state.project, state.activeSlideId, state.editingMasterId, state.editingNotesBoard],
  );
  const activeSlide =
    state.project.slides.find((slide) => slide.id === state.activeSlideId) ?? state.project.slides[0];
  const activeMaster = activeSlide?.masterId
    ? state.project.masters.find((master) => master.id === activeSlide.masterId) ?? null
    : null;
  const selectedElements = activeContainer.elements.filter((element) => state.selection.includes(element.id));
  const selectedSlides = state.project.slides.filter((slide) => state.slideSelection.includes(slide.id));

  const setTool = useCallback((tool: ToolId) => setState((prev) => ({ ...prev, tool })), []);
  const setSelection = useCallback((ids: string[]) => setState((prev) => ({ ...prev, selection: ids })), []);
  const toggleSelection = useCallback(
    (id: string) =>
      setState((prev) => ({
        ...prev,
        selection: prev.selection.includes(id)
          ? prev.selection.filter((selectedId) => selectedId !== id)
          : [...prev.selection, id],
      })),
    [],
  );
  const setZoom = useCallback(
    (zoom: number) => setState((prev) => ({ ...prev, zoom: clamp(zoom, 0.08, 3) })),
    [],
  );
  const setPan = useCallback((pan: { x: number; y: number }) => setState((prev) => ({ ...prev, pan })), []);
  const setStatus = useCallback((status: string) => setState((prev) => ({ ...prev, status })), []);
  const updateWorkspace = useCallback((patch: Partial<WorkspaceConfig>) => {
    setState((prev) => {
      const workspace = normalizeWorkspace({ ...prev.workspace, ...patch });
      applyWorkspaceAppearance(workspace);
      document.documentElement.lang = workspace.language === "en" ? "en" : "hu";
      return {
        ...prev,
        workspace,
        editingNotesBoard: patch.showNotesBoard === false ? false : prev.editingNotesBoard,
        selection: patch.showNotesBoard === false && prev.editingNotesBoard ? [] : prev.selection,
      };
    });
  }, []);
  const replaceWorkspace = useCallback((workspace: WorkspaceConfig) => {
    const normalized = normalizeWorkspace(workspace);
    applyWorkspaceAppearance(normalized);
    document.documentElement.lang = normalized.language === "en" ? "en" : "hu";
    setState((prev) => ({
      ...prev,
      workspace: normalized,
      editingNotesBoard: normalized.showNotesBoard ? prev.editingNotesBoard : false,
      selection: normalized.showNotesBoard ? prev.selection : [],
    }));
  }, []);
  const resetWorkspace = useCallback(() => {
    const workspace = deepClone(defaultWorkspace);
    applyWorkspaceAppearance(workspace);
    document.documentElement.lang = workspace.language === "en" ? "en" : "hu";
    setState((prev) => ({ ...prev, workspace, editingNotesBoard: false, selection: [] }));
  }, []);
  const setProjectPath = useCallback(
    (path: string | null) => setState((prev) => ({ ...prev, projectPath: path })),
    [],
  );
  const markSaved = useCallback(
    (path?: string | null) =>
      setState((prev) => ({
        ...prev,
        dirty: false,
        projectPath: path === undefined ? prev.projectPath : path,
        status: "Mentve",
      })),
    [],
  );

  const updateProject = useCallback(
    (mutator: (project: PresentationProject) => void, recordHistory = true) => {
      setState((prev) => {
        const next = deepClone(prev.project);
        mutator(next);
        next.updatedAt = new Date().toISOString();
        return {
          ...prev,
          project: next,
          historyPast: recordHistory
            ? [...prev.historyPast, prev.project].slice(-HISTORY_LIMIT)
            : prev.historyPast,
          historyFuture: recordHistory ? [] : prev.historyFuture,
          dirty: true,
        };
      });
    },
    [],
  );

  const updateSlideNotes = useCallback((slideId: string, notes: string, notesHtml?: string) => {
    setState((prev) => {
      const index = prev.project.slides.findIndex((slide) => slide.id === slideId);
      if (index < 0) return prev;
      const current = prev.project.slides[index];
      const nextHtml = notesHtml === undefined ? current.notesHtml : notesHtml;
      if (current.notes === notes && current.notesHtml === nextHtml) return prev;
      const slides = [...prev.project.slides];
      slides[index] = { ...current, notes, notesHtml: nextHtml };
      return {
        ...prev,
        project: { ...prev.project, slides, updatedAt: new Date().toISOString() },
        dirty: true,
      };
    });
  }, []);

  // A projektmódosítások immutábilis/clone-alapúak, ezért az interakció eleji
  // projekt-referencia biztonságos Undo snapshot. Nem kell minden drag/resize indulásakor
  // a teljes prezentációt deep-clone-olni, ami nagy projektnél érezhető pause volt.
  const beginInteraction = useCallback(() => stateRef.current.project, []);
  const finishInteraction = useCallback((snapshot: PresentationProject) => {
    setState((prev) => ({
      ...prev,
      historyPast: [...prev.historyPast, snapshot].slice(-HISTORY_LIMIT),
      historyFuture: [],
      dirty: true,
    }));
  }, []);

  const replaceProject = useCallback((project: PresentationProject, path: string | null = null) => {
    const safeProject = deepClone(project);
    if (!safeProject.slides.length) {
      const fallback = createDefaultProject();
      safeProject.slides = fallback.slides;
    }
    if (!safeProject.masters.length) {
      safeProject.masters = createDefaultProject().masters;
    }
    setState((prev) => ({
      ...prev,
      project: safeProject,
      projectPath: path,
      activeSlideId: safeProject.slides[0].id,
      slideSelection: [safeProject.slides[0].id],
      editingMasterId: null,
      editingNotesBoard: false,
      selection: [],
      historyPast: [],
      historyFuture: [],
      dirty: false,
      status: "Projekt megnyitva",
    }));
  }, []);

  const newProject = useCallback(() => {
    const project = createDefaultProject();
    setState((prev) => ({
      ...prev,
      project,
      projectPath: null,
      activeSlideId: project.slides[0].id,
      slideSelection: [project.slides[0].id],
      editingMasterId: null,
      editingNotesBoard: false,
      selection: [],
      historyPast: [],
      historyFuture: [],
      dirty: false,
      status: "Új projekt",
    }));
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const previous = prev.historyPast.at(-1);
      if (!previous) return prev;
      const nextActiveId = previous.slides.some((slide) => slide.id === prev.activeSlideId)
        ? prev.activeSlideId
        : previous.slides[0]?.id ?? "";
      const nextEditingMasterId = prev.editingMasterId && previous.masters.some((master) => master.id === prev.editingMasterId)
        ? prev.editingMasterId
        : null;
      return {
        ...prev,
        project: previous,
        activeSlideId: nextActiveId,
        editingMasterId: nextEditingMasterId,
        historyPast: prev.historyPast.slice(0, -1),
        historyFuture: [prev.project, ...prev.historyFuture].slice(0, HISTORY_LIMIT),
        selection: [],
        slideSelection: nextEditingMasterId ? [] : (nextActiveId ? [nextActiveId] : []),
        dirty: true,
        status: "Visszavonva",
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const next = prev.historyFuture[0];
      if (!next) return prev;
      const nextActiveId = next.slides.some((slide) => slide.id === prev.activeSlideId)
        ? prev.activeSlideId
        : next.slides[0]?.id ?? "";
      const nextEditingMasterId = prev.editingMasterId && next.masters.some((master) => master.id === prev.editingMasterId)
        ? prev.editingMasterId
        : null;
      return {
        ...prev,
        project: next,
        activeSlideId: nextActiveId,
        editingMasterId: nextEditingMasterId,
        historyPast: [...prev.historyPast, prev.project].slice(-HISTORY_LIMIT),
        historyFuture: prev.historyFuture.slice(1),
        selection: [],
        slideSelection: nextEditingMasterId ? [] : (nextActiveId ? [nextActiveId] : []),
        dirty: true,
        status: "Ismét alkalmazva",
      };
    });
  }, []);

  const setActiveSlide = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.project.slides.find((slide) => slide.id === id);
      return {
        ...prev,
        activeSlideId: id,
        slideSelection: [id],
        editingMasterId: null,
        editingNotesBoard: Boolean(prev.editingNotesBoard && target?.notesBoard?.mode === "visual"),
        selection: [],
        workspace: { ...prev.workspace, leftTab: "slides" },
      };
    });
  }, []);

  const setSlideSelection = useCallback((ids: string[], activeId?: string) => {
    setState((prev) => {
      const valid = Array.from(new Set(ids)).filter((id) => prev.project.slides.some((slide) => slide.id === id));
      const nextActive = activeId && valid.includes(activeId)
        ? activeId
        : valid.at(-1) ?? prev.activeSlideId;
      const target = prev.project.slides.find((slide) => slide.id === nextActive);
      return {
        ...prev,
        activeSlideId: nextActive,
        slideSelection: valid.length ? valid : [nextActive],
        editingMasterId: null,
        editingNotesBoard: Boolean(prev.editingNotesBoard && target?.notesBoard?.mode === "visual"),
        selection: [],
        workspace: { ...prev.workspace, leftTab: "slides" },
      };
    });
  }, []);

  const setEditingMaster = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      editingMasterId: id,
      editingNotesBoard: id ? false : prev.editingNotesBoard,
      slideSelection: id ? [] : (prev.slideSelection.length ? prev.slideSelection : (prev.activeSlideId ? [prev.activeSlideId] : [])),
      selection: [],
      workspace: { ...prev.workspace, leftTab: id ? "masters" : prev.workspace.leftTab },
    }));
  }, []);

  const setEditingNotesBoard = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      editingNotesBoard: Boolean(enabled && prev.workspace.showNotesBoard && !prev.editingMasterId),
      selection: [],
      tool: "select",
    }));
  }, []);

  const addSlide = useCallback(() => {
    const current = stateRef.current;
    const active = current.project.slides.find((candidate) => candidate.id === current.activeSlideId);
    const slide: Slide = {
      id: newId("slide"),
      name: `Dia ${current.project.slides.length + 1}`,
      hidden: false,
      masterId: active?.masterId ?? current.project.masters[0]?.id ?? null,
      sectionId: active?.sectionId,
      background: defaultBackground(true),
      guides: { vertical: [], horizontal: [] },
      grid: defaultGrid(),
      inheritMasterGrid: true,
      elements: [],
      notes: "",
      notesBoard: defaultNotesBoard(),
      transition: "fade",
      longformHeightScale: 1,
      longformSticky: false,
    };
    updateProject((project) => project.slides.push(slide));
    setState((prev) => ({ ...prev, activeSlideId: slide.id, slideSelection: [slide.id], editingMasterId: null, editingNotesBoard: false, selection: [] }));
  }, [updateProject]);

  const duplicateSlides = useCallback(
    (ids?: string[]) => {
      const current = stateRef.current;
      const selectedIds = ids?.length ? ids : (current.slideSelection.length ? current.slideSelection : [current.activeSlideId]);
      const selected = new Set(selectedIds);
      const copiesBySource = new Map<string, Slide>();
      const created = current.project.slides
        .filter((slide) => selected.has(slide.id))
        .map((source) => {
          const copy = deepClone(source);
          copy.id = newId("slide");
          copy.name = `${source.name} másolat`;
          copy.elements = remapElements(source.elements);
          if (source.notesBoard) copy.notesBoard = { ...deepClone(source.notesBoard), elements: remapElements(source.notesBoard.elements) };
          copiesBySource.set(source.id, copy);
          return copy;
        });
      if (!created.length) return;

      // Keep links and scroll ranges self-contained when a linked set of slides is duplicated together.
      // References to slides outside the duplicated set intentionally keep pointing to the originals.
      for (const copy of created) {
        for (const element of copy.elements) {
          const navigationTarget = element.navigation?.type === "section" ? element.navigation.targetSlideId : undefined;
          if (navigationTarget) {
            const remappedTarget = copiesBySource.get(navigationTarget);
            if (remappedTarget && element.navigation) element.navigation.targetSlideId = remappedTarget.id;
          }
          if (element.scrollBehavior?.rangeMode === "until-section" && element.scrollBehavior.targetSlideId) {
            const remappedTarget = copiesBySource.get(element.scrollBehavior.targetSlideId);
            if (remappedTarget) element.scrollBehavior.targetSlideId = remappedTarget.id;
          }
        }
      }

      updateProject((project) => {
        const next: Slide[] = [];
        project.slides.forEach((source) => {
          next.push(source);
          const copy = copiesBySource.get(source.id);
          if (copy) next.push(deepClone(copy));
        });
        project.slides = next;
      });
      setState((prev) => ({
        ...prev,
        activeSlideId: created[0].id,
        slideSelection: created.map((slide) => slide.id),
        editingMasterId: null,
        editingNotesBoard: Boolean(prev.editingNotesBoard && created[0].notesBoard?.mode === "visual"),
        selection: [],
      }));
    },
    [updateProject],
  );

  const duplicateSlide = useCallback((id?: string) => {
    duplicateSlides([id ?? stateRef.current.activeSlideId]);
  }, [duplicateSlides]);

  const deleteSlides = useCallback(
    (ids?: string[]) => {
      const current = stateRef.current;
      const selectedIds = ids?.length ? ids : (current.slideSelection.length ? current.slideSelection : [current.activeSlideId]);
      const selected = new Set(selectedIds);
      const existing = current.project.slides.filter((slide) => selected.has(slide.id));
      if (!existing.length) return;
      if (current.project.slides.length - existing.length < 1) {
        setStatus("Legalább egy dia szükséges");
        return;
      }
      const firstIndex = Math.min(...existing.map((slide) => current.project.slides.findIndex((candidate) => candidate.id === slide.id)));
      const remaining = current.project.slides.filter((slide) => !selected.has(slide.id));
      const nextActive = remaining[Math.min(firstIndex, remaining.length - 1)]?.id ?? remaining[0].id;
      updateProject((project) => {
        project.slides = project.slides.filter((slide) => !selected.has(slide.id));
        const clearDeletedTargets = (elements: SlideElement[]) => elements.forEach((element) => {
          if (element.navigation?.type === "section" && element.navigation.targetSlideId && selected.has(element.navigation.targetSlideId)) {
            element.navigation = { type: "none", smooth: true };
          }
          if (element.scrollBehavior?.targetSlideId && selected.has(element.scrollBehavior.targetSlideId)) {
            element.scrollBehavior.targetSlideId = undefined;
            if (element.scrollBehavior.rangeMode === "until-section") element.scrollBehavior.rangeMode = "screens";
          }
        });
        project.slides.forEach((slide) => clearDeletedTargets(slide.elements));
        project.masters.forEach((master) => clearDeletedTargets(master.elements));
      });
      setState((prev) => { const target = remaining.find((slide) => slide.id === nextActive); return { ...prev, activeSlideId: nextActive, slideSelection: [nextActive], editingMasterId: null, editingNotesBoard: Boolean(prev.editingNotesBoard && target?.notesBoard?.mode === "visual"), selection: [] }; });
    },
    [setStatus, updateProject],
  );

  const deleteSlide = useCallback((id?: string) => {
    deleteSlides([id ?? stateRef.current.activeSlideId]);
  }, [deleteSlides]);

  const updateSlides = useCallback((ids: string[], mutator: (slide: Slide) => void, recordHistory = true) => {
    const idSet = new Set(ids);
    if (!idSet.size) return;
    updateProject((project) => {
      project.slides.forEach((slide) => { if (idSet.has(slide.id)) mutator(slide); });
    }, recordHistory);
  }, [updateProject]);

  const reorderSlide = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return;
      updateProject((project) => {
        const [slide] = project.slides.splice(from, 1);
        project.slides.splice(to, 0, slide);
      });
    },
    [updateProject],
  );

  const addMaster = useCallback(() => {
    const current = stateRef.current;
    const master: MasterSlide = {
      id: newId("master"),
      name: `Mester ${current.project.masters.length + 1}`,
      parentMasterId: current.editingMasterId ?? null,
      inheritParentGrid: true,
      background: { ...defaultBackground(Boolean(current.editingMasterId)), color: "#f4f2ec" },
      guides: { vertical: [], horizontal: [] },
      grid: defaultGrid(),
      elements: [],
    };
    updateProject((project) => project.masters.push(master));
    setState((prev) => ({ ...prev, editingMasterId: master.id, selection: [] }));
  }, [updateProject]);

  const duplicateMaster = useCallback(
    (id?: string) => {
      const current = stateRef.current;
      const targetId = id ?? current.editingMasterId ?? current.project.masters[0]?.id;
      const index = current.project.masters.findIndex((master) => master.id === targetId);
      if (index < 0) return;
      const source = current.project.masters[index];
      const copy = deepClone(source);
      copy.id = newId("master");
      copy.name = `${source.name} másolat`;
      copy.elements = remapElements(source.elements);
      updateProject((project) => project.masters.splice(index + 1, 0, copy));
      setState((prev) => ({ ...prev, editingMasterId: copy.id, selection: [] }));
    },
    [updateProject],
  );

  const deleteMaster = useCallback(
    (id?: string) => {
      const current = stateRef.current;
      if (current.project.masters.length <= 1) {
        setStatus("Legalább egy mesteroldal szükséges");
        return;
      }
      const targetId = id ?? current.editingMasterId ?? current.project.masters[0].id;
      const fallback = current.project.masters.find((master) => master.id !== targetId)?.id ?? null;
      updateProject((project) => {
        project.masters = project.masters.filter((master) => master.id !== targetId);
        project.masters.forEach((master) => {
          if (master.parentMasterId === targetId) master.parentMasterId = null;
        });
        project.slides.forEach((slide) => {
          if (slide.masterId === targetId) slide.masterId = fallback;
        });
      });
      setState((prev) => ({ ...prev, editingMasterId: fallback, selection: [] }));
    },
    [setStatus, updateProject],
  );

  const addElement = useCallback(
    (element: SlideElement) => {
      const current = stateRef.current;
      updateProject((project) => {
        getContainer(project, current.activeSlideId, current.editingMasterId, current.editingNotesBoard).elements.push(element);
      });
      setState((prev) => ({ ...prev, selection: [element.id], tool: "select" }));
    },
    [updateProject],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<SlideElement>, recordHistory = true) => {
      setState((prev) => {
        const updatedAt = new Date().toISOString();
        let changed = false;
        let nextProject: PresentationProject;
        if (prev.editingNotesBoard && !prev.editingMasterId) {
          const slides = prev.project.slides.map((slide) => {
            if (slide.id !== prev.activeSlideId) return slide;
            const board = slide.notesBoard ?? defaultNotesBoard();
            let boardChanged = false;
            const elements = board.elements.map((element) => {
              if (element.id !== id) return element;
              changed = true;
              boardChanged = true;
              return { ...element, ...patch } as SlideElement;
            });
            return boardChanged ? { ...slide, notesBoard: { ...board, elements } } : slide;
          });
          if (!changed) return prev;
          nextProject = { ...prev.project, slides, updatedAt };
        } else if (prev.editingMasterId) {
          const masters = prev.project.masters.map((master) => {
            if (master.id !== prev.editingMasterId) return master;
            const elements = master.elements.map((element) => {
              if (element.id !== id) return element;
              changed = true;
              return { ...element, ...patch } as SlideElement;
            });
            return changed ? { ...master, elements } : master;
          });
          if (!changed) return prev;
          nextProject = { ...prev.project, masters, updatedAt };
        } else {
          const slides = prev.project.slides.map((slide) => {
            if (slide.id !== prev.activeSlideId) return slide;
            let slideChanged = false;
            const elements = slide.elements.map((element) => {
              if (element.id !== id) return element;
              changed = true;
              slideChanged = true;
              return { ...element, ...patch } as SlideElement;
            });
            return slideChanged ? { ...slide, elements } : slide;
          });
          if (!changed) return prev;
          nextProject = { ...prev.project, slides, updatedAt };
        }
        return {
          ...prev,
          project: nextProject,
          historyPast: recordHistory ? [...prev.historyPast, prev.project].slice(-HISTORY_LIMIT) : prev.historyPast,
          historyFuture: recordHistory ? [] : prev.historyFuture,
          dirty: true,
        };
      });
    },
    [],
  );

  const updateSlideElement = useCallback(
    (slideId: string, id: string, patch: Partial<SlideElement>, recordHistory = true) => {
      setState((prev) => {
        let changed = false;
        const slides = prev.project.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          let slideChanged = false;
          const elements = slide.elements.map((element) => {
            if (element.id !== id) return element;
            changed = true;
            slideChanged = true;
            return { ...element, ...patch } as SlideElement;
          });
          return slideChanged ? { ...slide, elements } : slide;
        });
        if (!changed) return prev;
        const nextProject = { ...prev.project, slides, updatedAt: new Date().toISOString() };
        return {
          ...prev,
          project: nextProject,
          historyPast: recordHistory ? [...prev.historyPast, prev.project].slice(-HISTORY_LIMIT) : prev.historyPast,
          historyFuture: recordHistory ? [] : prev.historyFuture,
          dirty: true,
        };
      });
    },
    [],
  );

  const updateElements = useCallback(
    (ids: string[], updater: (element: SlideElement) => void, recordHistory = true) => {
      const idSet = new Set(ids);
      if (!idSet.size) return;
      setState((prev) => {
        let changed = false;
        const patchElements = (elements: SlideElement[]) => elements.map((element) => {
          if (!idSet.has(element.id)) return element;
          changed = true;
          const clone = deepClone(element);
          updater(clone);
          return clone;
        });
        const updatedAt = new Date().toISOString();
        let nextProject: PresentationProject;
        if (prev.editingNotesBoard && !prev.editingMasterId) {
          const slides = prev.project.slides.map((slide) => {
            if (slide.id !== prev.activeSlideId) return slide;
            const board = slide.notesBoard ?? defaultNotesBoard();
            const elements = patchElements(board.elements);
            return changed ? { ...slide, notesBoard: { ...board, elements } } : slide;
          });
          if (!changed) return prev;
          nextProject = { ...prev.project, slides, updatedAt };
        } else if (prev.editingMasterId) {
          const masters = prev.project.masters.map((master) => master.id === prev.editingMasterId ? { ...master, elements: patchElements(master.elements) } : master);
          if (!changed) return prev;
          nextProject = { ...prev.project, masters, updatedAt };
        } else {
          const slides = prev.project.slides.map((slide) => slide.id === prev.activeSlideId ? { ...slide, elements: patchElements(slide.elements) } : slide);
          if (!changed) return prev;
          nextProject = { ...prev.project, slides, updatedAt };
        }
        return {
          ...prev,
          project: nextProject,
          historyPast: recordHistory ? [...prev.historyPast, prev.project].slice(-HISTORY_LIMIT) : prev.historyPast,
          historyFuture: recordHistory ? [] : prev.historyFuture,
          dirty: true,
        };
      });
    },
    [],
  );

  const deleteSelection = useCallback(() => {
    const current = stateRef.current;
    if (!current.selection.length) return;
    const selected = new Set(current.selection);
    updateProject((project) => {
      const container = getContainer(project, current.activeSlideId, current.editingMasterId, current.editingNotesBoard);
      container.elements = container.elements.filter((element) => !selected.has(element.id));
    });
    setSelection([]);
  }, [setSelection, updateProject]);

  const duplicateSelection = useCallback(() => {
    const current = stateRef.current;
    if (!current.selection.length) return;
    const selected = new Set(current.selection);
    const source = getContainer(current.project, current.activeSlideId, current.editingMasterId, current.editingNotesBoard).elements.filter(
      (element) => selected.has(element.id),
    );
    const copies = remapElements(source, 24);
    updateProject((project) => {
      getContainer(project, current.activeSlideId, current.editingMasterId, current.editingNotesBoard).elements.push(...copies);
    });
    setSelection(copies.map((element) => element.id));
  }, [setSelection, updateProject]);

  const groupSelection = useCallback(() => {
    const current = stateRef.current;
    if (current.selection.length < 2) {
      setStatus("Csoportosításhoz legalább két elem kell");
      return;
    }
    const groupId = newId("group");
    updateElements(current.selection, (element) => {
      element.groupId = groupId;
    });
    setStatus("Csoport létrehozva");
  }, [setStatus, updateElements]);

  const ungroupSelection = useCallback(() => {
    const current = stateRef.current;
    if (!current.selection.length) return;
    updateElements(current.selection, (element) => {
      delete element.groupId;
    });
    setStatus("Csoport felbontva");
  }, [setStatus, updateElements]);

  const alignSelection = useCallback(
    (mode: AlignMode, reference: AlignReference = "selection") => {
      const current = stateRef.current;
      const container = getContainer(current.project, current.activeSlideId, current.editingMasterId, current.editingNotesBoard);
      const selected = container.elements.filter((element) => current.selection.includes(element.id));
      if (!selected.length) return;
      if (reference === "selection" && selected.length < 2 && (mode !== "distribute-horizontal" && mode !== "distribute-vertical")) return;
      if ((mode === "distribute-horizontal" || mode === "distribute-vertical") && selected.length < 3) return;

      const bounds = elementBounds(selected);
      const positions = new Map<string, { x?: number; y?: number }>();

      if (mode === "distribute-horizontal") {
        const sorted = [...selected].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((sum, element) => sum + element.width, 0);
        const gap = (bounds.width - totalWidth) / Math.max(1, sorted.length - 1);
        let cursor = bounds.x;
        sorted.forEach((element) => {
          positions.set(element.id, { x: cursor });
          cursor += element.width + gap;
        });
      } else if (mode === "distribute-vertical") {
        const sorted = [...selected].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((sum, element) => sum + element.height, 0);
        const gap = (bounds.height - totalHeight) / Math.max(1, sorted.length - 1);
        let cursor = bounds.y;
        sorted.forEach((element) => {
          positions.set(element.id, { y: cursor });
          cursor += element.height + gap;
        });
      }

      let groupDeltaX = 0;
      let groupDeltaY = 0;
      if (reference === "slide") {
        if (mode === "left") groupDeltaX = -bounds.x;
        if (mode === "center") groupDeltaX = (current.project.width - bounds.width) / 2 - bounds.x;
        if (mode === "right") groupDeltaX = current.project.width - bounds.width - bounds.x;
        if (mode === "top") groupDeltaY = -bounds.y;
        if (mode === "middle") groupDeltaY = (current.project.height - bounds.height) / 2 - bounds.y;
        if (mode === "bottom") groupDeltaY = current.project.height - bounds.height - bounds.y;
      }

      updateElements(current.selection, (element) => {
        if (mode === "distribute-horizontal" || mode === "distribute-vertical") {
          Object.assign(element, positions.get(element.id));
          return;
        }
        if (reference === "slide") {
          element.x += groupDeltaX;
          element.y += groupDeltaY;
          return;
        }
        switch (mode) {
          case "left": element.x = bounds.x; break;
          case "center": element.x = bounds.x + (bounds.width - element.width) / 2; break;
          case "right": element.x = bounds.x + bounds.width - element.width; break;
          case "top": element.y = bounds.y; break;
          case "middle": element.y = bounds.y + (bounds.height - element.height) / 2; break;
          case "bottom": element.y = bounds.y + bounds.height - element.height; break;
          default: break;
        }
      });
    },
    [updateElements],
  );

  const detachMasterElement = useCallback((masterElementId: string) => {
    const current = stateRef.current;
    if (current.editingMasterId) return;
    const slide = current.project.slides.find((candidate) => candidate.id === current.activeSlideId);
    if (!slide?.masterId) return;
    if (slide.elements.some((element) => element.masterSourceId === masterElementId)) {
      setStatus("Ez a mester elem már helyileg felül van írva");
      return;
    }
    const source = resolvedMasterElements(current.project, slide.masterId).find((element) => element.id === masterElementId);
    if (!source) return;
    const clone = deepClone(source);
    clone.id = newId(source.type);
    clone.masterSourceId = source.id;
    delete clone.groupId;
    updateProject((project) => {
      const target = project.slides.find((candidate) => candidate.id === current.activeSlideId);
      target?.elements.push(clone);
    });
    setSelection([clone.id]);
    setStatus("Mester elem leválasztva – ezen a dián külön szerkeszthető");
  }, [setSelection, setStatus, updateProject]);

  const resetMasterOverride = useCallback((masterElementId: string) => {
    const current = stateRef.current;
    if (current.editingMasterId) return;
    updateProject((project) => {
      const slide = project.slides.find((candidate) => candidate.id === current.activeSlideId);
      if (!slide) return;
      slide.elements = slide.elements.filter((element) => element.masterSourceId !== masterElementId);
    });
    setSelection([]);
    setStatus("Mester felülírás visszaállítva");
  }, [setSelection, setStatus, updateProject]);

  const bakeMasterIntoSlide = useCallback(() => {
    const current = stateRef.current;
    if (current.editingMasterId) return;
    const slide = current.project.slides.find((candidate) => candidate.id === current.activeSlideId);
    if (!slide?.masterId) {
      setStatus("Ehhez a diához nincs mesteroldal rendelve");
      return;
    }
    const masterId = slide.masterId;
    const overriddenIds = new Set(slide.elements.map((element) => element.masterSourceId).filter(Boolean));
    const bakedElements = remapElements(resolvedMasterElements(current.project, masterId).filter((element) => !overriddenIds.has(element.id)));
    const bakedGuides = resolvedMasterGuides(current.project, masterId);
    const bakedGrid = resolvedMasterGrid(current.project, masterId);
    const bakedBackground = resolvedMasterBackground(current.project, masterId);
    updateProject((project) => {
      const target = project.slides.find((candidate) => candidate.id === current.activeSlideId);
      if (!target) return;
      if (target.background.inherit) target.background = { ...bakedBackground, inherit: false };
      target.grid = { ...bakedGrid };
      target.inheritMasterGrid = false;
      target.guides = {
        vertical: Array.from(new Set([...bakedGuides.vertical, ...target.guides.vertical])).sort((a, b) => a - b),
        horizontal: Array.from(new Set([...bakedGuides.horizontal, ...target.guides.horizontal])).sort((a, b) => a - b),
      };
      target.elements.forEach((element) => { delete element.masterSourceId; });
      target.elements = [...bakedElements, ...target.elements];
      target.masterId = null;
    });
    setState((prev) => ({ ...prev, selection: bakedElements.map((element) => element.id) }));
    setStatus("A mesteroldal ráégetve a diára – az elemek most helyben szerkeszthetők");
  }, [setStatus, updateProject]);

  const reorderElement = useCallback(
    (id: string, direction: "front" | "forward" | "backward" | "back") => {
      const current = stateRef.current;
      updateProject((project) => {
        const elements = getContainer(project, current.activeSlideId, current.editingMasterId, current.editingNotesBoard).elements;
        const index = elements.findIndex((element) => element.id === id);
        if (index < 0) return;
        const [element] = elements.splice(index, 1);
        if (direction === "front") elements.push(element);
        if (direction === "back") elements.unshift(element);
        if (direction === "forward") elements.splice(Math.min(elements.length, index + 1), 0, element);
        if (direction === "backward") elements.splice(Math.max(0, index - 1), 0, element);
      });
    },
    [updateProject],
  );

  const addAsset = useCallback(
    (asset: AssetRecord) => {
      updateProject((project) => {
        if (!project.assets.some((candidate) => candidate.id === asset.id)) project.assets.push(asset);
      });
    },
    [updateProject],
  );

  const setPresentMode = useCallback((enabled: boolean, index?: number) => {
    setState((prev) => {
      const visibleSlides = prev.project.slides.filter((slide) => !slide.hidden);
      const activeVisibleIndex = visibleSlides.findIndex((slide) => slide.id === prev.activeSlideId);
      return {
        ...prev,
        presentMode: enabled,
        presentIndex: index ?? Math.max(0, activeVisibleIndex),
      };
    });
  }, []);
  const setPresentIndex = useCallback(
    (index: number) =>
      setState((prev) => ({
        ...prev,
        presentIndex: clamp(index, 0, Math.max(0, prev.project.slides.filter((slide) => !slide.hidden).length - 1)),
      })),
    [],
  );

  const value: EditorContextValue = {
    state,
    activeContainer,
    activeSlide,
    activeMaster,
    selectedElements,
    selectedSlides,
    setTool,
    setSelection,
    toggleSelection,
    setZoom,
    setPan,
    setStatus,
    updateWorkspace,
    replaceWorkspace,
    resetWorkspace,
    setProjectPath,
    markSaved,
    replaceProject,
    newProject,
    updateProject,
    updateSlideNotes,
    beginInteraction,
    finishInteraction,
    undo,
    redo,
    setActiveSlide,
    setSlideSelection,
    setEditingMaster,
    setEditingNotesBoard,
    addSlide,
    duplicateSlide,
    duplicateSlides,
    deleteSlide,
    deleteSlides,
    updateSlides,
    reorderSlide,
    addMaster,
    duplicateMaster,
    deleteMaster,
    addElement,
    updateElement,
    updateSlideElement,
    updateElements,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    alignSelection,
    bakeMasterIntoSlide,
    detachMasterElement,
    resetMasterOverride,
    reorderElement,
    addAsset,
    setPresentMode,
    setPresentIndex,
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditor csak EditorProvider alatt használható.");
  return context;
}
