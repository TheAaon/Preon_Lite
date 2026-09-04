import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { uiText } from "../i18n";
import { useEditor } from "../EditorContext";
import { createImageElement, createShapeElement, createTextElement } from "../elementFactory";
import { defaultNotesTextElement } from "../defaultProject";
import type {
  AssetRecord,
  GridSettings,
  MasterSlide,
  PresentationProject,
  Rect,
  Slide,
  SlideElement,
  SmartGuideLine,
  ToolId,
  ShapeKind,
} from "../types";
import { clamp, elementBounds, isTauriRuntime, round } from "../utils";
import { inheritedMasterElements, inheritedMasterGuides, resolvedSlideMasterElements, resolvedMasterGrid, resolvedMasterGuides, resolvedMasterBackground, resolvedSlideBackground, resolvedSlideGrid } from "../masterResolver";
import { ElementVisual } from "./ElementVisual";
import { SceneBackground, StaticScene } from "./Scene";
import { MaskPathEditor } from "./MaskPathEditor";
import { withResolvedDynamicText } from "../dynamicFields";
import { longformLayout, longformSectionAtY, longformSectionHeight, longformTotalHeight } from "../longformLayout";
import { Icon } from "./Icon";
import { RichTextNoteEditor } from "./RichTextNoteEditor";
import { applyColorToElement, elementEffectsFilter, primaryElementColor, textFormattingPatch } from "../elementAppearance";

const RULER = 25;
const SNAP_SCREEN_PX = 7;
const MIN_ELEMENT_SIZE = 8;
const CONTINUOUS_GAP = 160;
const NOTES_BOARD_GAP = 160;
const NOTES_META_FOOTER = 96;

const SHAPE_TOOLS = new Set<ShapeKind>(["rect", "rounded-rect", "ellipse", "triangle", "star", "polygon", "line", "arrow"]);
function isShapeTool(tool: ToolId): tool is ShapeKind { return SHAPE_TOOLS.has(tool as ShapeKind); }

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface EditorCanvasProps {
  onBrowserFilesDropped: (files: File[], targetElementId?: string) => void;
  onReplaceImage: (elementId: string) => void;
}

function guideGridStyle(grid: GridSettings, width: number, height: number) {
  const contentWidth = width - grid.marginX * 2;
  const columnWidth = Math.max(1, (contentWidth - grid.gutter * (grid.columns - 1)) / grid.columns);
  return Array.from({ length: grid.columns }, (_, index) => ({
    left: grid.marginX + index * (columnWidth + grid.gutter),
    width: columnWidth,
    top: grid.marginY,
    height: height - grid.marginY * 2,
  }));
}


function gridSnapTargets(grid: GridSettings, width: number, height: number): { vertical: number[]; horizontal: number[] } {
  if (!grid.enabled) return { vertical: [], horizontal: [] };
  const vertical = new Set<number>([grid.marginX, width - grid.marginX]);
  const contentWidth = Math.max(1, width - grid.marginX * 2);
  const columnWidth = Math.max(1, (contentWidth - grid.gutter * (grid.columns - 1)) / Math.max(1, grid.columns));
  for (let index = 0; index < grid.columns; index += 1) {
    const left = grid.marginX + index * (columnWidth + grid.gutter);
    vertical.add(left);
    vertical.add(left + columnWidth);
  }

  const horizontal = new Set<number>([grid.marginY, height - grid.marginY]);
  if (grid.baseline > 0) {
    for (let y = grid.marginY; y <= height - grid.marginY + 0.01; y += grid.baseline) {
      horizontal.add(y);
    }
  }
  return { vertical: Array.from(vertical), horizontal: Array.from(horizontal) };
}

function noteTextColor(color: string | undefined): string {
  const hex = (color ?? "").trim().replace(/^#/, "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#24262a";
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.48 ? "#f4f5f2" : "#24262a";
}

function nearestSnap(value: number, targets: number[], threshold: number): number {
  let best = value;
  let distance = threshold + 1;
  for (const target of targets) {
    const candidate = Math.abs(target - value);
    if (candidate <= threshold && candidate < distance) {
      best = target;
      distance = candidate;
    }
  }
  return best;
}

function elementAxisTargets(elements: SlideElement[], selectedIds: Set<string>): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  for (const element of elements) {
    if (!element.visible || selectedIds.has(element.id)) continue;
    vertical.push(element.x, element.x + element.width / 2, element.x + element.width);
    horizontal.push(element.y, element.y + element.height / 2, element.y + element.height);
  }
  return { vertical, horizontal };
}

function rectIntersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointInsideElement(point: { x: number; y: number }, element: SlideElement, offsetY = 0): boolean {
  if (!element.visible || element.locked) return false;
  const centerX = element.x + element.width / 2;
  const centerY = offsetY + element.y + element.height / 2;
  const radians = -(element.rotation || 0) * Math.PI / 180;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= element.width / 2 && Math.abs(localY) <= element.height / 2;
}

interface SnapResult {
  dx: number;
  dy: number;
  lines: SmartGuideLine[];
}

function computeSnap(
  moving: Rect,
  selectedIds: Set<string>,
  elements: SlideElement[],
  verticalGuides: number[],
  horizontalGuides: number[],
  width: number,
  height: number,
  threshold: number,
): SnapResult {
  const xTargets: Array<{ value: number; from: number; to: number }> = [
    { value: 0, from: 0, to: height },
    { value: width / 2, from: 0, to: height },
    { value: width, from: 0, to: height },
    ...verticalGuides.map((value) => ({ value, from: 0, to: height })),
  ];
  const yTargets: Array<{ value: number; from: number; to: number }> = [
    { value: 0, from: 0, to: width },
    { value: height / 2, from: 0, to: width },
    { value: height, from: 0, to: width },
    ...horizontalGuides.map((value) => ({ value, from: 0, to: width })),
  ];

  elements.forEach((element) => {
    if (selectedIds.has(element.id) || !element.visible) return;
    xTargets.push(
      { value: element.x, from: element.y, to: element.y + element.height },
      { value: element.x + element.width / 2, from: element.y, to: element.y + element.height },
      { value: element.x + element.width, from: element.y, to: element.y + element.height },
    );
    yTargets.push(
      { value: element.y, from: element.x, to: element.x + element.width },
      { value: element.y + element.height / 2, from: element.x, to: element.x + element.width },
      { value: element.y + element.height, from: element.x, to: element.x + element.width },
    );
  });

  const movingX = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const movingY = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
  let bestX: { delta: number; target: (typeof xTargets)[number] } | null = null;
  let bestY: { delta: number; target: (typeof yTargets)[number] } | null = null;

  for (const anchor of movingX) {
    for (const target of xTargets) {
      const delta = target.value - anchor;
      if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, target };
      }
    }
  }
  for (const anchor of movingY) {
    for (const target of yTargets) {
      const delta = target.value - anchor;
      if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, target };
      }
    }
  }

  const lines: SmartGuideLine[] = [];
  if (bestX) {
    lines.push({
      axis: "x",
      position: bestX.target.value,
      from: Math.min(bestX.target.from, moving.y),
      to: Math.max(bestX.target.to, moving.y + moving.height),
    });
  }
  if (bestY) {
    lines.push({
      axis: "y",
      position: bestY.target.value,
      from: Math.min(bestY.target.from, moving.x),
      to: Math.max(bestY.target.to, moving.x + moving.width),
    });
  }
  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, lines };
}

function RulerTicks({
  orientation,
  length,
  zoom,
  pan,
}: {
  orientation: "horizontal" | "vertical";
  length: number;
  zoom: number;
  pan: number;
}) {
  const step = zoom < 0.22 ? 200 : zoom < 0.42 ? 100 : zoom < 0.8 ? 50 : zoom < 1.5 ? 25 : 10;
  const ticks: number[] = [];
  for (let value = 0; value <= length; value += step) ticks.push(value);
  return (
    <>
      {ticks.map((value) => {
        const position = RULER + pan + value * zoom;
        return (
          <div
            key={value}
            className={`ruler-tick ruler-tick-${orientation}`}
            style={orientation === "horizontal" ? { left: position } : { top: position }}
          >
            <span>{value}</span>
          </div>
        );
      })}
    </>
  );
}

function DistanceOverlay({
  selection,
  others,
  width,
  height,
  zoom,
}: {
  selection: Rect;
  others: SlideElement[];
  width: number;
  height: number;
  zoom: number;
}) {
  const leftCandidates = others
    .filter((element) => element.x + element.width <= selection.x)
    .map((element) => ({ edge: element.x + element.width, element }))
    .sort((a, b) => b.edge - a.edge);
  const rightCandidates = others
    .filter((element) => element.x >= selection.x + selection.width)
    .map((element) => ({ edge: element.x, element }))
    .sort((a, b) => a.edge - b.edge);
  const topCandidates = others
    .filter((element) => element.y + element.height <= selection.y)
    .map((element) => ({ edge: element.y + element.height, element }))
    .sort((a, b) => b.edge - a.edge);
  const bottomCandidates = others
    .filter((element) => element.y >= selection.y + selection.height)
    .map((element) => ({ edge: element.y, element }))
    .sort((a, b) => a.edge - b.edge);

  const left = leftCandidates[0]?.edge ?? 0;
  const right = rightCandidates[0]?.edge ?? width;
  const top = topCandidates[0]?.edge ?? 0;
  const bottom = bottomCandidates[0]?.edge ?? height;
  const labelScale = 1 / zoom;

  return (
    <div className="distance-overlay" aria-hidden>
      <div
        className="distance-line horizontal"
        style={{
          left,
          top: selection.y + selection.height / 2,
          width: Math.max(0, selection.x - left),
          height: 1 / zoom,
        }}
      >
        <span style={{ transform: `translate(-50%, -50%) scale(${labelScale})` }}>{round(selection.x - left)} px</span>
      </div>
      <div
        className="distance-line horizontal"
        style={{
          left: selection.x + selection.width,
          top: selection.y + selection.height / 2,
          width: Math.max(0, right - selection.x - selection.width),
          height: 1 / zoom,
        }}
      >
        <span style={{ transform: `translate(-50%, -50%) scale(${labelScale})` }}>
          {round(right - selection.x - selection.width)} px
        </span>
      </div>
      <div
        className="distance-line vertical"
        style={{
          left: selection.x + selection.width / 2,
          top,
          height: Math.max(0, selection.y - top),
          width: 1 / zoom,
        }}
      >
        <span style={{ transform: `translate(-50%, -50%) rotate(-90deg) scale(${labelScale})` }}>
          {round(selection.y - top)} px
        </span>
      </div>
      <div
        className="distance-line vertical"
        style={{
          left: selection.x + selection.width / 2,
          top: selection.y + selection.height,
          height: Math.max(0, bottom - selection.y - selection.height),
          width: 1 / zoom,
        }}
      >
        <span style={{ transform: `translate(-50%, -50%) rotate(-90deg) scale(${labelScale})` }}>
          {round(bottom - selection.y - selection.height)} px
        </span>
      </div>
    </div>
  );
}

function NotesBoardPreview({
  project,
  slide,
  assetById,
}: {
  project: PresentationProject;
  slide: Slide;
  assetById: ReadonlyMap<string, AssetRecord>;
}) {
  const board = slide.notesBoard;
  if (!board) return <div className="notes-board-preview-empty">{uiText("Előadói jegyzetlap")}</div>;
  return (
    <div className="notes-board-inline-scene" style={{ width: board.width, height: board.height, backgroundColor: board.background.color }}>
      <SceneBackground project={project} background={board.background} mode="thumbnail" assetById={assetById} />
      {board.elements.filter((element) => element.visible).map((element) => {
        const assetId = "assetId" in element ? element.assetId : element.type === "shape" ? element.fillAssetId : undefined;
        const asset = assetId ? assetById.get(assetId) : undefined;
        const maskAssetId = (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") ? element.mask?.assetId : undefined;
        const maskAsset = maskAssetId ? assetById.get(maskAssetId) : undefined;
        const visual = element.type === "text" ? withResolvedDynamicText(project, slide, element) : element;
        return (
          <div
            key={element.id}
            className="notes-board-inline-element"
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              opacity: element.opacity,
              transform: `rotate(${element.rotation}deg)`,
              transformOrigin: element.type === "shape" && element.shape === "line" ? "left center" : "center center",
              filter: elementEffectsFilter(element.effects),
            }}
          >
            <ElementVisual element={visual} asset={asset} maskAsset={maskAsset} assetById={assetById} mode="thumbnail" active={false} />
          </div>
        );
      })}
    </div>
  );
}

export function EditorCanvas({ onBrowserFilesDropped, onReplaceImage }: EditorCanvasProps) {
  const {
    state,
    activeContainer,
    activeSlide,
    selectedElements,
    setSelection,
    setTool,
    setZoom,
    setPan,
    setActiveSlide,
    setEditingNotesBoard,
    addElement,
    updateElement,
    updateElements,
    updateProject,
    updateSlideNotes,
    beginInteraction,
    finishInteraction,
    setStatus,
  } = useEditor();
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressNextActiveAutoPanRef = useRef(false);
  const suppressAutoFitRef = useRef(false);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 760 });
  const [smartLines, setSmartLines] = useState<SmartGuideLine[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [creationPreview, setCreationPreview] = useState<{ tool: ToolId; rect: Rect; rotation?: number } | null>(null);
  const [draggingGuide, setDraggingGuide] = useState<{
    orientation: "vertical" | "horizontal";
    value: number;
    sourceIndex?: number;
    masterGuide?: boolean;
  } | null>(null);

  useEffect(() => {
    const handleEditRequest = (event: Event) => {
      const custom = event as CustomEvent<{ elementId?: string }>;
      const elementId = custom.detail?.elementId;
      if (!elementId) return;
      const element = activeContainer.elements.find((candidate) => candidate.id === elementId);
      if (!element || element.type !== "text" || element.locked || (element.dynamicField ?? "none") !== "none") return;
      setSelection([elementId]);
      setEditingImageId(null);
      setEditingTextId(elementId);
    };
    window.addEventListener("preon-edit-element", handleEditRequest as EventListener);
    return () => window.removeEventListener("preon-edit-element", handleEditRequest as EventListener);
  }, [activeContainer.elements, setSelection]);

  const project = state.project;
  const assetById = useMemo(() => new Map(project.assets.map((asset) => [asset.id, asset])), [project.assets]);
  const notesView = state.editingNotesBoard && !state.editingMasterId;
  const notesEnabled = state.workspace.showNotesBoard && !state.editingMasterId;
  const notesPairView = notesEnabled && project.presentationMode === "slides";
  const notesSingleView = notesPairView && state.workspace.canvasView === "single";
  const notesFlowView = notesPairView && state.workspace.canvasView === "continuous";
  const notesLongformView = notesEnabled && project.presentationMode === "longform";
  // Flow View keeps one independent note card beside every slide. In Single Slide view only
  // the active pair is mounted, while One Slide keeps its long canvas and uses a docked note.
  const notesFlowLayout = useMemo(() => {
    let top = 0;
    return project.slides.map((slide, index) => {
      const board = slide.notesBoard;
      const noteWidth = board?.width ?? 900;
      const noteHeight = board?.height ?? 1200;
      const rowHeight = Math.max(project.height, noteHeight);
      const item = { slide, index, top, rowHeight, noteWidth, noteHeight };
      top += rowHeight + (index < project.slides.length - 1 ? CONTINUOUS_GAP : 0);
      return item;
    });
  }, [project]);
  const notesFlowHeight = notesFlowLayout.length
    ? notesFlowLayout[notesFlowLayout.length - 1].top + notesFlowLayout[notesFlowLayout.length - 1].rowHeight + NOTES_META_FOOTER
    : project.height;
  const maxNotesWidth = notesFlowLayout.reduce((max, item) => Math.max(max, item.noteWidth), 900);
  const longformView = project.presentationMode === "longform" && !state.editingMasterId;
  const continuousView = (state.workspace.canvasView === "continuous" || longformView) && !state.editingMasterId;
  const continuousGap = longformView ? 0 : CONTINUOUS_GAP;
  const activeSlideIndex = Math.max(0, project.slides.findIndex((slide) => slide.id === state.activeSlideId));
  const activeNotesBoard = activeSlide?.notesBoard;
  const singleNotesWidth = activeNotesBoard?.width ?? 900;
  const workspaceWidth = notesFlowView
    ? project.width + NOTES_BOARD_GAP + maxNotesWidth
    : notesSingleView
      ? project.width + NOTES_BOARD_GAP + singleNotesWidth
      : project.width;
  const activeBoardOffsetX = notesPairView && notesView ? project.width + NOTES_BOARD_GAP : 0;
  const longformSections = useMemo(() => longformLayout(project), [project]);
  const activeLongformSection = longformView
    ? longformSections.find((section) => section.slide.id === state.activeSlideId)
    : undefined;
  const activeSectionHeight = longformView ? (activeLongformSection?.height ?? project.height) : project.height;
  const activeCanvasWidth = notesView ? (activeNotesBoard?.width ?? 900) : project.width;
  const activeCanvasHeight = notesView ? (activeNotesBoard?.height ?? 1200) : activeSectionHeight;
  const activeSlideOffsetY = continuousView
    ? (longformView
      ? (activeLongformSection?.top ?? 0)
      : notesFlowView
        ? (notesFlowLayout[activeSlideIndex]?.top ?? 0)
        : activeSlideIndex * (project.height + continuousGap))
    : 0;
  const continuousHeight = continuousView
    ? (longformView
      ? longformTotalHeight(project)
      : notesFlowView
        ? notesFlowHeight
        : project.slides.length * project.height + Math.max(0, project.slides.length - 1) * continuousGap)
    : Math.max(activeCanvasHeight, notesSingleView ? (activeNotesBoard?.height ?? 1200) + NOTES_META_FOOTER : activeCanvasHeight);
  const notesPairLayout = notesSingleView
    ? [{
        slide: activeSlide,
        index: activeSlideIndex,
        top: 0,
        rowHeight: Math.max(project.height, activeNotesBoard?.height ?? 1200),
        noteWidth: activeNotesBoard?.width ?? 900,
        noteHeight: activeNotesBoard?.height ?? 1200,
      }]
    : notesFlowView ? notesFlowLayout : [];
  const rulerOffset = state.workspace.showRulers ? RULER : 0;
  const longformViewportY = Math.max(0, ((viewportSize.height - rulerOffset) * 0.42 - state.pan.y) / Math.max(0.0001, state.zoom));
  const longformNoteSection = notesLongformView ? (longformSectionAtY(project, longformViewportY) ?? activeLongformSection) : undefined;
  const longformNoteSlide = longformNoteSection?.slide ?? activeSlide;
  const background = notesView
    ? activeContainer.background
    : state.editingMasterId
      ? resolvedMasterBackground(project, state.editingMasterId)
      : resolvedSlideBackground(project, activeSlide);
  const masterElements = notesView
    ? []
    : state.editingMasterId
      ? inheritedMasterElements(project, state.editingMasterId)
      : resolvedSlideMasterElements(project, activeSlide);
  const inheritedGuides = notesView
    ? { vertical: [], horizontal: [] }
    : state.editingMasterId
      ? inheritedMasterGuides(project, state.editingMasterId)
      : resolvedMasterGuides(project, activeSlide.masterId);
  const effectiveGrid = notesView
    ? activeContainer.grid
    : state.editingMasterId
      ? resolvedMasterGrid(project, state.editingMasterId)
      : resolvedSlideGrid(project, activeSlide);
  const gridColumns = useMemo(
    () => guideGridStyle(effectiveGrid, activeCanvasWidth, activeCanvasHeight),
    [activeCanvasHeight, activeCanvasWidth, effectiveGrid],
  );
  const selectionBounds = useMemo(() => elementBounds(selectedElements), [selectedElements]);
  const canvasViewTop = continuousView ? (-state.pan.y) / Math.max(0.0001, state.zoom) : 0;
  const canvasViewBottom = continuousView
    ? (Math.max(100, viewportSize.height - rulerOffset) - state.pan.y) / Math.max(0.0001, state.zoom)
    : activeCanvasHeight;
  const canvasRenderMargin = continuousView
    ? Math.max(project.height, activeCanvasHeight, (viewportSize.height / Math.max(0.0001, state.zoom)) * 1.25)
    : 0;
  const canvasRangeIsNear = (top: number, height: number) => !continuousView
    || top + height >= canvasViewTop - canvasRenderMargin
    && top <= canvasViewBottom + canvasRenderMargin;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const fitToScreen = useCallback(() => {
    const usableWidth = Math.max(100, viewportSize.width - rulerOffset - (notesLongformView ? 390 : 90));
    const usableHeight = Math.max(100, viewportSize.height - rulerOffset - 90);
    const rowFitHeight = notesFlowView
      ? Math.max(project.height, activeNotesBoard?.height ?? 1200) + continuousGap * 0.55
      : project.height * 1.62 + continuousGap;
    const singlePairHeight = notesSingleView ? Math.max(project.height, activeNotesBoard?.height ?? 1200) + NOTES_META_FOOTER : activeCanvasHeight;
    const fitWidth = notesSingleView ? workspaceWidth : activeCanvasWidth;
    const zoom = continuousView
      ? clamp(Math.min(usableWidth / workspaceWidth, usableHeight / rowFitHeight), 0.08, 2)
      : clamp(Math.min(usableWidth / fitWidth, usableHeight / singlePairHeight), 0.08, 2);
    setZoom(zoom);
    setPan({
      x: (viewportSize.width - rulerOffset - (notesLongformView ? 360 : 0) - workspaceWidth * zoom) / 2,
      y: continuousView ? 42 : (viewportSize.height - rulerOffset - singlePairHeight * zoom) / 2,
    });
  }, [activeCanvasHeight, activeCanvasWidth, activeNotesBoard?.height, continuousGap, continuousView, notesFlowView, notesLongformView, notesSingleView, project.height, rulerOffset, setPan, setZoom, viewportSize.height, viewportSize.width, workspaceWidth]);

  useEffect(() => {
    const listener = () => fitToScreen();
    window.addEventListener("ps-fit-canvas", listener);
    return () => window.removeEventListener("ps-fit-canvas", listener);
  }, [fitToScreen]);

  useEffect(() => {
    if (suppressAutoFitRef.current) return;
    const timer = window.setTimeout(fitToScreen, 80);
    return () => window.clearTimeout(timer);
  }, [fitToScreen]);

  useEffect(() => {
    if (!continuousView || !viewportRef.current) return;
    if (suppressNextActiveAutoPanRef.current) {
      suppressNextActiveAutoPanRef.current = false;
      return;
    }
    const usableHeight = Math.max(100, viewportSize.height - rulerOffset);
    const viewTop = (-state.pan.y) / state.zoom;
    const viewBottom = (usableHeight - state.pan.y) / state.zoom;
    const slideTop = activeSlideOffsetY;
    const slideBottom = slideTop + activeCanvasHeight;
    if (slideBottom < viewTop + 90 / state.zoom || slideTop > viewBottom - 90 / state.zoom) {
      setPan({
        x: state.pan.x,
        y: (usableHeight - Math.min(Math.max(project.height, activeCanvasHeight), activeCanvasHeight) * state.zoom) / 2 - activeSlideOffsetY * state.zoom,
      });
    }
  // Only react to active slide/view changes. Pan/zoom are intentionally sampled, not dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSlideId, continuousView]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        setSpacePressed(true);
      }
      if (event.key === "Alt") setAltPressed(true);
      if (event.key === "Escape") {
        setEditingImageId(null);
        setEditingTextId(null);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
      if (event.key === "Alt") setAltPressed(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - rulerOffset - state.pan.x) / state.zoom - activeBoardOffsetX,
        y: (clientY - rect.top - rulerOffset - state.pan.y) / state.zoom - activeSlideOffsetY,
      };
    },
    [activeBoardOffsetX, activeSlideOffsetY, rulerOffset, state.pan.x, state.pan.y, state.zoom],
  );

  const screenToWorkspace = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - rulerOffset - state.pan.x) / state.zoom,
        y: (clientY - rect.top - rulerOffset - state.pan.y) / state.zoom,
      };
    },
    [rulerOffset, state.pan.x, state.pan.y, state.zoom],
  );

  const slideIndexAtWorkspaceY = useCallback((workspaceY: number) => {
    if (!continuousView) return activeSlideIndex;
    if (longformView) return longformSectionAtY(project, workspaceY)?.index ?? -1;
    if (notesFlowView) {
      const hit = notesFlowLayout.find((item) => workspaceY >= item.top && workspaceY <= item.top + item.rowHeight);
      return hit?.index ?? -1;
    }
    const stride = project.height + continuousGap;
    const index = Math.floor(workspaceY / stride);
    if (index < 0 || index >= project.slides.length) return -1;
    const localY = workspaceY - index * stride;
    return localY >= 0 && localY <= project.height ? index : -1;
  }, [activeSlideIndex, continuousGap, continuousView, longformView, notesFlowLayout, notesFlowView, project]);

  const startPan = (event: ReactPointerEvent) => {
    const start = { x: event.clientX, y: event.clientY };
    const initial = state.pan;
    const move = (moveEvent: PointerEvent) => {
      setPan({ x: initial.x + moveEvent.clientX - start.x, y: initial.y + moveEvent.clientY - start.y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const setNotesMode = (slideId: string, mode: "text" | "visual", enterVisualEditor = true) => {
    updateProject((draft) => {
      const slide = draft.slides.find((item) => item.id === slideId);
      const board = slide?.notesBoard;
      if (!board) return;
      board.mode = mode;
      if (mode === "visual" && board.elements.length === 0) {
        const starter = defaultNotesTextElement();
        starter.width = Math.max(240, board.width - 144);
        starter.height = Math.max(240, board.height - 144);
        board.elements.push(starter);
      }
    });
    setActiveSlide(slideId);
    setEditingNotesBoard(mode === "visual" && enterVisualEditor);
  };

  const resetNotesPortrait = (slideId: string) => {
    updateProject((draft) => {
      const board = draft.slides.find((item) => item.id === slideId)?.notesBoard;
      if (!board) return;
      board.width = 900;
      board.height = 1200;
    });
  };

  const setNotesBackground = (slideId: string, color: string) => {
    updateProject((draft) => {
      const board = draft.slides.find((item) => item.id === slideId)?.notesBoard;
      if (!board) return;
      board.background.inherit = false;
      board.background.type = "color";
      board.background.color = color;
    });
  };

  const startNotesResize = (event: ReactPointerEvent, slideId: string) => {
    event.stopPropagation();
    event.preventDefault();
    const board = project.slides.find((slide) => slide.id === slideId)?.notesBoard;
    if (!board) return;
    const snapshot = beginInteraction();
    suppressAutoFitRef.current = true;
    const start = { x: event.clientX, y: event.clientY, width: board.width, height: board.height };
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      moved = true;
      const dx = (moveEvent.clientX - start.x) / Math.max(0.0001, state.zoom);
      const dy = (moveEvent.clientY - start.y) / Math.max(0.0001, state.zoom);
      updateProject((draft) => {
        const target = draft.slides.find((slide) => slide.id === slideId)?.notesBoard;
        if (!target) return;
        target.width = round(clamp(start.width + dx, 420, 2400), 2);
        target.height = round(clamp(start.height + dy, 480, 3200), 2);
      }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      suppressAutoFitRef.current = false;
      if (moved) finishInteraction(snapshot);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleWheel = (event: ReactWheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = event.clientX - rect.left - rulerOffset;
      const localY = event.clientY - rect.top - rulerOffset;
      const canvasX = (localX - state.pan.x) / state.zoom;
      const canvasY = (localY - state.pan.y) / state.zoom;
      const factor = Math.exp(-event.deltaY * 0.0014);
      const nextZoom = clamp(state.zoom * factor, 0.08, 3);
      setZoom(nextZoom);
      setPan({ x: localX - canvasX * nextZoom, y: localY - canvasY * nextZoom });
    } else {
      setPan({ x: state.pan.x - event.deltaX, y: state.pan.y - event.deltaY });
    }
  };

  const startMarqueeSelection = useCallback((start: { x: number; y: number }, shiftAtStart = false) => {
    let moved = false;
    setMarquee({ x: start.x, y: start.y, width: 0, height: 0 });
    const move = (moveEvent: PointerEvent) => {
      const current = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      moved = Math.abs(current.x - start.x) > 2 || Math.abs(current.y - start.y) > 2;
      setMarquee({
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      });
    };
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = screenToCanvas(upEvent.clientX, upEvent.clientY);
      const box: Rect = {
        x: Math.min(start.x, current.x), y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y),
      };
      if (moved) {
        const ids = activeContainer.elements
          .filter((element) => !element.locked && element.visible && rectIntersects(box, element))
          .map((element) => element.id);
        setSelection((upEvent.shiftKey || shiftAtStart) ? Array.from(new Set([...state.selection, ...ids])) : ids);
      } else if (!(upEvent.shiftKey || shiftAtStart)) setSelection([]);
      setMarquee(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [activeContainer.elements, screenToCanvas, setSelection, state.selection]);

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hitElement = event.target !== event.currentTarget ? (event.target as HTMLElement).closest<HTMLElement>(".editor-element") : null;
    if (state.tool === "eyedropperColor" && event.button === 0 && !hitElement) {
      event.preventDefault();
      const color = background.color;
      let changed = 0;
      updateElements(state.selection, (target) => { if (applyColorToElement(target, color)) changed += 1; });
      setStatus(changed ? `Pipetta: ${color}` : "A kijelölés nem színezhető");
      setTool("select");
      return;
    }
    if (state.tool === "eyedropperFormat" && event.button === 0 && !hitElement) {
      event.preventDefault();
      setStatus("A formázáspipettához szövegre kattints");
      return;
    }
    // Rajzoló eszközöknél a már meglévő objektumok nem foghatják el a pointert:
    // szöveg/shape/frame közvetlenül kép vagy videó fölé is rajzolható lock nélkül.
    if (state.tool === "select" && hitElement && !hitElement.classList.contains("locked")) return;

    // One Slide-ban az aktív section szerkesztőrétege vizuálisan a preview-k fölött van.
    // Emiatt egy másik sectionből ide átlógó objektum látható része DOM hit-testtel nem mindig
    // lenne elérhető. Ilyenkor globális koordinátában megkeressük a legfelső átlógó elemet.
    if (longformView && state.tool === "select" && event.button === 0 && !hitElement) {
      const workspacePoint = screenToWorkspace(event.clientX, event.clientY);
      for (let slideIndex = project.slides.length - 1; slideIndex >= 0; slideIndex -= 1) {
        const slide = project.slides[slideIndex];
        if (slide.id === state.activeSlideId) continue;
        const sectionTop = longformSections[slideIndex]?.top ?? 0;
        for (let elementIndex = slide.elements.length - 1; elementIndex >= 0; elementIndex -= 1) {
          const element = slide.elements[elementIndex];
          if (!pointInsideElement(workspacePoint, element, sectionTop)) continue;
          event.preventDefault();
          suppressNextActiveAutoPanRef.current = true;
          setActiveSlide(slide.id);
          setSelection([element.id]);
          return;
        }
      }
    }
    if (state.tool === "hand" || spacePressed || event.button === 1) {
      event.preventDefault();
      startPan(event);
      return;
    }
    if (editingImageId) setEditingImageId(null);
    const point = screenToCanvas(event.clientX, event.clientY);
    if (point.x < 0 || point.y < 0 || point.x > activeCanvasWidth || point.y > activeCanvasHeight) return;
    if (state.tool === "text" || isShapeTool(state.tool) || state.tool === "imageFrame") {
      const creationTool = state.tool;
      event.preventDefault();
      const gridTargets = gridSnapTargets(effectiveGrid, activeCanvasWidth, activeCanvasHeight);
      const threshold = SNAP_SCREEN_PX / state.zoom;
      const verticalTargets = [0, activeCanvasWidth / 2, activeCanvasWidth, ...inheritedGuides.vertical, ...activeContainer.guides.vertical, ...gridTargets.vertical];
      const horizontalTargets = [0, activeCanvasHeight / 2, activeCanvasHeight, ...inheritedGuides.horizontal, ...activeContainer.guides.horizontal, ...gridTargets.horizontal];
      const snapPoint = (value: { x: number; y: number }, pointerEvent?: PointerEvent) => {
        if (!state.workspace.snapEnabled || pointerEvent?.metaKey || pointerEvent?.ctrlKey) return value;
        return {
          x: nearestSnap(value.x, verticalTargets, threshold),
          y: nearestSnap(value.y, horizontalTargets, threshold),
        };
      };
      const start = snapPoint(point);
      let last = start;
      let moved = false;

      const move = (moveEvent: PointerEvent) => {
        last = snapPoint(screenToCanvas(moveEvent.clientX, moveEvent.clientY), moveEvent);
        moved = moved || Math.hypot(last.x - start.x, last.y - start.y) > 5 / state.zoom;
        if (creationTool === "line") {
          const dx = last.x - start.x;
          const dy = last.y - start.y;
          const length = Math.max(4, Math.hypot(dx, dy));
          setCreationPreview({
            tool: creationTool,
            rect: { x: start.x, y: start.y, width: length, height: 4 },
            rotation: Math.atan2(dy, dx) * 180 / Math.PI,
          });
          return;
        }
        let width = Math.abs(last.x - start.x);
        let height = Math.abs(last.y - start.y);
        if (moveEvent.shiftKey && creationTool !== "text") {
          const size = Math.max(width, height);
          width = size;
          height = size;
        }
        setCreationPreview({
          tool: creationTool,
          rect: {
            x: last.x >= start.x ? start.x : start.x - width,
            y: last.y >= start.y ? start.y : start.y - height,
            width,
            height,
          },
        });
      };

      const up = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const end = snapPoint(screenToCanvas(upEvent.clientX, upEvent.clientY), upEvent);
        setCreationPreview(null);
        if (!moved) {
          if (creationTool === "text") {
            const element = createTextElement(round(start.x), round(start.y));
            addElement(element);
            setEditingTextId(element.id);
          } else if (creationTool === "imageFrame") {
            addElement(createImageElement("", round(start.x), round(start.y)));
          } else addElement(createShapeElement(creationTool, round(start.x), round(start.y)));
          return;
        }
        if (creationTool === "line") {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const element = createShapeElement("line", round(start.x), round(start.y));
          element.width = round(Math.max(4, Math.hypot(dx, dy)), 2);
          element.height = 4;
          element.rotation = round(Math.atan2(dy, dx) * 180 / Math.PI, 2);
          addElement(element);
          return;
        }
        let width = Math.max(MIN_ELEMENT_SIZE, Math.abs(end.x - start.x));
        let height = Math.max(MIN_ELEMENT_SIZE, Math.abs(end.y - start.y));
        if (upEvent.shiftKey && creationTool !== "text") {
          const size = Math.max(width, height);
          width = size;
          height = size;
        }
        const x = end.x >= start.x ? start.x : start.x - width;
        const y = end.y >= start.y ? start.y : start.y - height;
        if (creationTool === "text") {
          const element = createTextElement(round(x), round(y));
          element.width = round(width, 2);
          element.height = round(height, 2);
          addElement(element);
          setEditingTextId(element.id);
        } else if (creationTool === "imageFrame") {
          const element = createImageElement("", round(x), round(y));
          element.width = round(width, 2);
          element.height = round(height, 2);
          element.name = "Képkeret";
          addElement(element);
        } else {
          const element = createShapeElement(creationTool, round(x), round(y));
          element.width = round(width, 2);
          element.height = round(height, 2);
          addElement(element);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    if (state.tool !== "select") return;

    startMarqueeSelection(point, event.shiftKey);
  };

  const handleElementPointerDown = (event: ReactPointerEvent, element: SlideElement) => {
    if (state.tool === "eyedropperColor" && event.button === 0) {
      event.stopPropagation();
      event.preventDefault();
      const color = primaryElementColor(element);
      if (!color) {
        setStatus("Ehhez az elemhez nincs közvetlenül mintázható szín");
        return;
      }
      let changed = 0;
      updateElements(state.selection, (target) => { if (applyColorToElement(target, color)) changed += 1; });
      setStatus(changed ? `Pipetta: ${color}` : "A kijelölés nem színezhető");
      setTool("select");
      return;
    }
    if (state.tool === "eyedropperFormat" && event.button === 0) {
      event.stopPropagation();
      event.preventDefault();
      if (element.type !== "text") {
        setStatus("A formázáspipettához szövegre kattints");
        return;
      }
      const patch = textFormattingPatch(element);
      let changed = 0;
      updateElements(state.selection, (target) => {
        if (target.type !== "text") return;
        Object.assign(target, patch);
        target.textStyleId = undefined;
        changed += 1;
      });
      setStatus(changed ? "Szövegformázás átvéve" : "Jelölj ki legalább egy célszöveget");
      setTool("select");
      return;
    }
    if (state.tool === "hand" || spacePressed || event.button === 1) {
      event.stopPropagation();
      startPan(event);
      return;
    }
    if (state.tool !== "select" || element.locked || editingTextId === element.id) return;
    event.stopPropagation();

    if ((element.type === "image" || element.type === "slideshow" || element.type === "pdf") && editingImageId === element.id) {
      const snapshot = beginInteraction();
      const startPoint = screenToCanvas(event.clientX, event.clientY);
      const startX = element.contentPositionX ?? 50;
      const startY = element.contentPositionY ?? 50;
      let moved = false;
      const moveContent = (moveEvent: PointerEvent) => {
        const current = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
        const dx = current.x - startPoint.x;
        const dy = current.y - startPoint.y;
        moved = moved || Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
        updateElement(
          element.id,
          {
            contentPositionX: clamp(startX + (dx / Math.max(1, element.width)) * 100, 0, 100),
            contentPositionY: clamp(startY + (dy / Math.max(1, element.height)) * 100, 0, 100),
          } as Partial<SlideElement>,
          false,
        );
      };
      const upContent = () => {
        window.removeEventListener("pointermove", moveContent);
        window.removeEventListener("pointerup", upContent);
        if (moved) finishInteraction(snapshot);
      };
      window.addEventListener("pointermove", moveContent);
      window.addEventListener("pointerup", upContent);
      return;
    }

    if (editingImageId) setEditingImageId(null);
    const groupIds =
      element.groupId && !event.altKey
        ? activeContainer.elements.filter((candidate) => candidate.groupId === element.groupId).map((candidate) => candidate.id)
        : [element.id];
    let dragIds: string[];
    if (event.shiftKey) {
      const next = new Set(state.selection);
      groupIds.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
      dragIds = Array.from(next);
      setSelection(dragIds);
    } else if (state.selection.includes(element.id)) {
      dragIds = state.selection;
    } else {
      dragIds = groupIds;
      setSelection(dragIds);
    }
    if (!dragIds.includes(element.id) && !groupIds.some((id) => dragIds.includes(id))) return;

    const selected = activeContainer.elements.filter((candidate) => dragIds.includes(candidate.id));
    const starts = new Map(selected.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
    const startBounds = elementBounds(selected);
    const startPoint = screenToCanvas(event.clientX, event.clientY);
    const snapshot = beginInteraction();
    const sourceSlideId = state.activeSlideId;
    const sourceSlideIndex = activeSlideIndex;
    const sourceOffsetY = longformView ? (longformSections[sourceSlideIndex]?.top ?? 0) : 0;

    // One Slide behaves as one shared vertical workspace while keeping section-local
    // coordinates internally. Build the snap scene in shared workspace coordinates so
    // objects can align to elements/guides in neighbouring sections while crossing a boundary.
    let dragSnapElements: SlideElement[] = [...masterElements, ...activeContainer.elements];
    let dragSnapVerticalGuides = [...inheritedGuides.vertical, ...activeContainer.guides.vertical];
    let dragSnapHorizontalGuides = [...inheritedGuides.horizontal, ...activeContainer.guides.horizontal];
    let dragSnapHeight = activeCanvasHeight;
    if (longformView) {
      dragSnapElements = [];
      const vertical = new Set<number>();
      const horizontal = new Set<number>();
      project.slides.forEach((slide, slideIndex) => {
        const sectionOffsetY = longformSections[slideIndex]?.top ?? 0;
        const sectionMasterElements = resolvedSlideMasterElements(project, slide);
        [...sectionMasterElements, ...slide.elements].forEach((candidate) => {
          dragSnapElements.push({ ...candidate, y: candidate.y + sectionOffsetY });
        });

        const sectionMasterGuides = resolvedMasterGuides(project, slide.masterId);
        const sectionGrid = resolvedSlideGrid(project, slide);
        const sectionHeight = longformSectionHeight(project, slide);
        const sectionGridTargets = gridSnapTargets(sectionGrid, project.width, sectionHeight);
        [...sectionMasterGuides.vertical, ...slide.guides.vertical, ...sectionGridTargets.vertical]
          .forEach((value) => vertical.add(value));
        [...sectionMasterGuides.horizontal, ...slide.guides.horizontal, ...sectionGridTargets.horizontal]
          .forEach((value) => horizontal.add(value + sectionOffsetY));

        // Every section keeps its own top / centre / bottom snap anchors inside the
        // shared longform canvas, not only the outer document bounds.
        horizontal.add(sectionOffsetY);
        horizontal.add(sectionOffsetY + sectionHeight / 2);
        horizontal.add(sectionOffsetY + sectionHeight);
      });
      dragSnapVerticalGuides = Array.from(vertical);
      dragSnapHorizontalGuides = Array.from(horizontal);
      dragSnapHeight = continuousHeight;
    }
    let moved = false;

    const move = (moveEvent: PointerEvent) => {
      const currentPoint = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      let dx = currentPoint.x - startPoint.x;
      let dy = currentPoint.y - startPoint.y;
      if (moveEvent.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      moved = moved || Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25;
      let snapDx = 0;
      let snapDy = 0;
      let lines: SmartGuideLine[] = [];
      if (state.workspace.snapEnabled && !moveEvent.metaKey && !moveEvent.ctrlKey) {
        const gridTargets = longformView ? { vertical: [], horizontal: [] } : gridSnapTargets(effectiveGrid, activeCanvasWidth, activeCanvasHeight);
        const snap = computeSnap(
          {
            ...startBounds,
            x: startBounds.x + dx,
            y: startBounds.y + sourceOffsetY + dy,
          },
          new Set(dragIds),
          dragSnapElements,
          [...dragSnapVerticalGuides, ...gridTargets.vertical],
          [...dragSnapHorizontalGuides, ...gridTargets.horizontal],
          longformView ? project.width : activeCanvasWidth,
          dragSnapHeight,
          SNAP_SCREEN_PX / state.zoom,
        );
        snapDx = snap.dx;
        snapDy = snap.dy;
        lines = state.workspace.smartGuides
          ? snap.lines.map((line) => line.axis === "x"
            ? { ...line, from: line.from - sourceOffsetY, to: line.to - sourceOffsetY }
            : { ...line, position: line.position - sourceOffsetY })
          : [];
      }
      setSmartLines(lines);
      updateElements(
        dragIds,
        (candidate) => {
          const start = starts.get(candidate.id);
          if (!start) return;
          candidate.x = round(start.x + dx + snapDx, 2);
          candidate.y = round(start.y + dy + snapDy, 2);
        },
        false,
      );
    };
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setSmartLines([]);
      if (moved && continuousView && !state.editingMasterId && !notesView) {
        const workspacePoint = screenToWorkspace(upEvent.clientX, upEvent.clientY);
        const targetIndex = slideIndexAtWorkspaceY(workspacePoint.y);
        if (targetIndex >= 0 && targetIndex !== sourceSlideIndex) {
          const targetSlide = project.slides[targetIndex];
          const targetTop = longformView
            ? (longformSections[targetIndex]?.top ?? 0)
            : notesFlowView
              ? (notesFlowLayout[targetIndex]?.top ?? 0)
              : targetIndex * (project.height + continuousGap);
          const sourceTop = longformView
            ? (longformSections[sourceSlideIndex]?.top ?? 0)
            : notesFlowView
              ? (notesFlowLayout[sourceSlideIndex]?.top ?? 0)
              : sourceSlideIndex * (project.height + continuousGap);
          const offsetY = targetTop - sourceTop;
          updateProject((draft) => {
            const source = draft.slides.find((slide) => slide.id === sourceSlideId);
            const target = draft.slides.find((slide) => slide.id === targetSlide.id);
            if (!source || !target) return;
            const moving = source.elements.filter((candidate) => dragIds.includes(candidate.id));
            if (!moving.length) return;
            source.elements = source.elements.filter((candidate) => !dragIds.includes(candidate.id));
            moving.forEach((candidate) => { candidate.y = round(candidate.y - offsetY, 2); });
            target.elements.push(...moving);
          }, false);
          setActiveSlide(targetSlide.id);
          setSelection(dragIds);
        }
      }
      if (moved) finishInteraction(snapshot);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (event: ReactPointerEvent, element: SlideElement, handle: ResizeHandle) => {
    event.stopPropagation();
    event.preventDefault();
    if (element.locked) return;
    const snapshot = beginInteraction();
    const startPoint = screenToCanvas(event.clientX, event.clientY);
    const start = { x: element.x, y: element.y, width: element.width, height: element.height };
    const aspect = start.width / Math.max(1, start.height);
    const startFont = element.type === "text"
      ? {
          fontSize: element.fontSize,
          letterSpacing: element.letterSpacing,
          padding: element.padding,
          firstLineIndent: element.firstLineIndent ?? 0,
          paragraphSpacingBefore: element.paragraphSpacingBefore ?? 0,
          paragraphSpacingAfter: element.paragraphSpacingAfter ?? 0,
          baselineShift: element.baselineShift ?? 0,
        }
      : null;
    const selectedIds = new Set([element.id]);
    const sceneElements = [...masterElements, ...activeContainer.elements];
    const otherTargets = elementAxisTargets(sceneElements, selectedIds);
    const gridTargets = gridSnapTargets(effectiveGrid, activeCanvasWidth, activeCanvasHeight);
    const verticalTargets = [0, activeCanvasWidth / 2, activeCanvasWidth, ...inheritedGuides.vertical, ...activeContainer.guides.vertical, ...gridTargets.vertical, ...otherTargets.vertical];
    const horizontalTargets = [0, activeCanvasHeight / 2, activeCanvasHeight, ...inheritedGuides.horizontal, ...activeContainer.guides.horizontal, ...gridTargets.horizontal, ...otherTargets.horizontal];
    const threshold = SNAP_SCREEN_PX / state.zoom;
    let moved = false;

    const move = (moveEvent: PointerEvent) => {
      const current = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      const dx = current.x - startPoint.x;
      const dy = current.y - startPoint.y;
      let x = start.x;
      let y = start.y;
      let width = start.width;
      let height = start.height;
      if (handle.includes("e")) width = Math.max(MIN_ELEMENT_SIZE, start.width + dx);
      if (handle.includes("s")) height = Math.max(MIN_ELEMENT_SIZE, start.height + dy);
      if (handle.includes("w")) {
        width = Math.max(MIN_ELEMENT_SIZE, start.width - dx);
        x = start.x + start.width - width;
      }
      if (handle.includes("n")) {
        height = Math.max(MIN_ELEMENT_SIZE, start.height - dy);
        y = start.y + start.height - height;
      }

      const textScaleMode = element.type === "text" && element.resizeMode === "scale" && handle.length === 2;
      const keepAspect = (moveEvent.shiftKey || textScaleMode) && handle.length === 2;
      if (keepAspect) {
        const widthRatio = width / Math.max(1, start.width);
        const heightRatio = height / Math.max(1, start.height);
        const ratio = Math.abs(widthRatio - 1) >= Math.abs(heightRatio - 1) ? widthRatio : heightRatio;
        width = Math.max(MIN_ELEMENT_SIZE, start.width * ratio);
        height = Math.max(MIN_ELEMENT_SIZE, width / aspect);
        if (handle.includes("w")) x = start.x + start.width - width;
        if (handle.includes("n")) y = start.y + start.height - height;
      }

      if (state.workspace.snapEnabled && !moveEvent.metaKey && !moveEvent.ctrlKey) {
        if (handle.includes("e")) {
          const right = nearestSnap(x + width, verticalTargets, threshold);
          width = Math.max(MIN_ELEMENT_SIZE, right - x);
        }
        if (handle.includes("w")) {
          const right = x + width;
          x = nearestSnap(x, verticalTargets, threshold);
          width = Math.max(MIN_ELEMENT_SIZE, right - x);
        }
        if (handle.includes("s")) {
          const bottom = nearestSnap(y + height, horizontalTargets, threshold);
          height = Math.max(MIN_ELEMENT_SIZE, bottom - y);
        }
        if (handle.includes("n")) {
          const bottom = y + height;
          y = nearestSnap(y, horizontalTargets, threshold);
          height = Math.max(MIN_ELEMENT_SIZE, bottom - y);
        }
      }

      moved = true;
      const patch: Partial<SlideElement> = {
        x: round(x, 2),
        y: round(y, 2),
        width: round(width, 2),
        height: round(height, 2),
      } as Partial<SlideElement>;
      if (textScaleMode && startFont) {
        const scale = Math.max(0.05, width / Math.max(1, start.width));
        Object.assign(patch, {
          fontSize: round(startFont.fontSize * scale, 2),
          letterSpacing: round(startFont.letterSpacing * scale, 2),
          padding: round(startFont.padding * scale, 2),
          firstLineIndent: round(startFont.firstLineIndent * scale, 2),
          paragraphSpacingBefore: round(startFont.paragraphSpacingBefore * scale, 2),
          paragraphSpacingAfter: round(startFont.paragraphSpacingAfter * scale, 2),
          baselineShift: round(startFont.baselineShift * scale, 2),
        });
      }
      updateElement(element.id, patch, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (moved) finishInteraction(snapshot);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startRulerGuide = (event: ReactPointerEvent, orientation: "vertical" | "horizontal") => {
    event.preventDefault();
    const point = screenToCanvas(event.clientX, event.clientY);
    const value = orientation === "vertical" ? point.x : point.y;
    setDraggingGuide({ orientation, value });
    const move = (moveEvent: PointerEvent) => {
      const current = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      setDraggingGuide({ orientation, value: orientation === "vertical" ? current.x : current.y });
    };
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = screenToCanvas(upEvent.clientX, upEvent.clientY);
      const finalValue = orientation === "vertical" ? current.x : current.y;
      const limit = orientation === "vertical" ? activeCanvasWidth : activeCanvasHeight;
      if (finalValue >= 0 && finalValue <= limit) {
        const activeSlideId = state.activeSlideId;
        const editingMasterId = state.editingMasterId;
        const editingNotesBoard = state.editingNotesBoard;
        updateProject((draft) => {
          const slide = draft.slides.find((item) => item.id === activeSlideId);
          const target = editingMasterId
            ? draft.masters.find((master) => master.id === editingMasterId)
            : editingNotesBoard
              ? slide?.notesBoard
              : slide;
          if (!target) return;
          target.guides[orientation === "vertical" ? "vertical" : "horizontal"].push(round(finalValue));
        });
      }
      setDraggingGuide(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startExistingGuide = (
    event: ReactPointerEvent,
    orientation: "vertical" | "horizontal",
    index: number,
    masterGuide: boolean,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (masterGuide && !state.editingMasterId) return;
    const snapshot = beginInteraction();
    let lastValue = 0;
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const current = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      lastValue = orientation === "vertical" ? current.x : current.y;
      moved = true;
      const activeSlideId = state.activeSlideId;
      const editingMasterId = state.editingMasterId;
      const editingNotesBoard = state.editingNotesBoard;
      updateProject(
        (draft) => {
          const slide = draft.slides.find((item) => item.id === activeSlideId);
          const target = editingMasterId
            ? draft.masters.find((master) => master.id === editingMasterId)
            : editingNotesBoard
              ? slide?.notesBoard
              : slide;
          if (!target) return;
          target.guides[orientation][index] = round(lastValue, 2);
        },
        false,
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (moved) {
        const limit = orientation === "vertical" ? activeCanvasWidth : activeCanvasHeight;
        if (lastValue < 0 || lastValue > limit) {
          const activeSlideId = state.activeSlideId;
          const editingMasterId = state.editingMasterId;
          const editingNotesBoard = state.editingNotesBoard;
          updateProject(
            (draft) => {
              const slide = draft.slides.find((item) => item.id === activeSlideId);
              const target = editingMasterId
                ? draft.masters.find((master) => master.id === editingMasterId)
                : editingNotesBoard
                  ? slide?.notesBoard
                  : slide;
              target?.guides[orientation].splice(index, 1);
            },
            false,
          );
        }
        finishInteraction(snapshot);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const renderGuide = (
    value: number,
    orientation: "vertical" | "horizontal",
    index: number,
    masterGuide = false,
  ) => (
    <div
      key={`${masterGuide ? "master" : "local"}-${orientation}-${index}`}
      className={`canvas-guide canvas-guide-${orientation} ${masterGuide ? "master-guide" : ""}`}
      style={
        orientation === "vertical"
          ? { left: value, width: 1 / state.zoom }
          : { top: value, height: 1 / state.zoom }
      }
      onPointerDown={(event) => startExistingGuide(event, orientation, index, masterGuide)}
    />
  );

  return (
    <div
      ref={viewportRef}
      className={`editor-viewport tool-${state.tool} ${spacePressed ? "space-pan" : ""} ${notesView ? "notes-board-editor" : ""} ${notesPairView ? "presenter-notes-flow" : ""} ${state.workspace.trimView ? "trim-view-enabled" : "pasteboard-view-enabled"}`}
      onWheel={handleWheel}
      onPointerDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (state.tool === "hand" || spacePressed || event.button === 1) { startPan(event); return; }
        if (state.tool === "select" && event.button === 0) {
          event.preventDefault();
          startMarqueeSelection(screenToCanvas(event.clientX, event.clientY), event.shiftKey);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (isTauriRuntime()) return;
        const files = Array.from(event.dataTransfer.files) as File[];
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-element-id]");
        if (files.length) onBrowserFilesDropped(files, target?.dataset.elementId);
      }}
    >
      {state.workspace.showRulers && (
        <>
          <div className="ruler-corner" />
          <div className="ruler ruler-horizontal" onPointerDown={(event) => startRulerGuide(event, "horizontal")}>
            <RulerTicks orientation="horizontal" length={activeCanvasWidth} zoom={state.zoom} pan={state.pan.x + activeBoardOffsetX * state.zoom} />
          </div>
          <div className="ruler ruler-vertical" onPointerDown={(event) => startRulerGuide(event, "vertical")}>
            <RulerTicks orientation="vertical" length={activeCanvasHeight} zoom={state.zoom} pan={state.pan.y + activeSlideOffsetY * state.zoom} />
          </div>
        </>
      )}

      <div
        className={`stage-transform ${longformView ? "longform-canvas" : ""} ${longformView && state.workspace.trimView ? "longform-trim" : ""}`}
        style={{
          left: rulerOffset + state.pan.x,
          top: rulerOffset + state.pan.y,
          width: workspaceWidth,
          height: continuousHeight,
          transform: `scale(${state.zoom})`,
        }}
      >
        {longformView && longformSections.map(({ slide, top, height }, sectionIndex) => {
          const sectionBackground = resolvedSlideBackground(project, slide);
          const renderMedia = canvasRangeIsNear(top, height);
          return <div
            key={`longform-bg-${slide.id}`}
            className={`longform-section-background ${slide.hidden ? "is-hidden" : ""}`}
            style={{ top: top - (sectionIndex > 0 ? 0.5 : 0), width: project.width, height: height + (sectionIndex > 0 ? 1 : 0.5), backgroundColor: sectionBackground.color }}
            aria-hidden
          >
            {renderMedia && <SceneBackground project={project} background={sectionBackground} mode="editor" assetById={assetById} />}
            <div className="longform-section-edge" />
          </div>;
        })}
        {continuousView && !notesFlowView && project.slides.map((slide, index) => {
          if (slide.id === state.activeSlideId) return null;
          const longformItem = longformView ? longformSections[index] : undefined;
          const top = longformItem?.top ?? index * (project.height + continuousGap);
          const previewHeight = longformItem?.height ?? project.height;
          const renderPreview = canvasRangeIsNear(top, previewHeight);
          const previewBackground = resolvedSlideBackground(project, slide);
          return (
            <div
              key={`continuous-${slide.id}`}
              className={`continuous-slide-preview ${longformView ? "longform-section-preview" : ""} ${slide.hidden ? "is-hidden" : ""}`}
              style={{ top, width: project.width, height: previewHeight, backgroundColor: previewBackground.color }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (state.tool === "hand" || spacePressed || event.button === 1) {
                  startPan(event);
                  return;
                }
                if (event.button !== 0) return;
                const hitElement = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-static-element-id]");
                const hitId = hitElement?.dataset.staticElementId;
                setActiveSlide(slide.id);
                setSelection(hitId ? [hitId] : []);
              }}
            >
              {renderPreview && <StaticScene project={project} slide={slide} mode="thumbnail" showBackground={!longformView} allowOverflow={longformView} sceneHeight={previewHeight} assetById={assetById} />}
              <div className={longformView ? "longform-section-label" : "continuous-slide-label"}>{longformView ? `${state.workspace.language === "en" ? "Section" : "Szekció"} ${index + 1} · ` : `${index + 1}. `}{slide.name}{slide.hidden ? ` · ${state.workspace.language === "en" ? "hidden" : "rejtett"}` : ""}</div>
            </div>
          );
        })}
        {notesPairView && notesPairLayout.map(({ slide, index, top, rowHeight, noteWidth, noteHeight }) => {
          const isActive = slide.id === state.activeSlideId;
          const board = slide.notesBoard;
          const notesMode = board?.mode ?? "text";
          const renderPair = isActive || canvasRangeIsNear(top, rowHeight);
          const showSlideCompanion = !isActive || notesView;
          const showVisualPreview = notesMode === "visual" && (!isActive || !notesView);
          return (
            <div key={`notes-pair-${slide.id}`} className="notes-flow-pair-labels" style={{ top, width: workspaceWidth, height: rowHeight }}>
              {showSlideCompanion && (
                <div
                  className="notes-flow-artboard notes-flow-slide-artboard"
                  style={{ left: 0, width: project.width, height: project.height }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (state.tool === "hand" || spacePressed || event.button === 1) { startPan(event); return; }
                    if (event.button !== 0) return;
                    setActiveSlide(slide.id);
                    setEditingNotesBoard(false);
                  }}
                >
                  {renderPair && <StaticScene project={project} slide={slide} mode="thumbnail" assetById={assetById} />}
                  <div className="notes-flow-artboard-label">{index + 1}. {slide.name}</div>
                </div>
              )}

              <div
                className={`notes-flow-artboard notes-flow-notes-artboard notes-mode-${notesMode} ${isActive ? "is-active-pair" : ""}`}
                style={{ left: project.width + NOTES_BOARD_GAP, width: noteWidth, height: noteHeight, zIndex: isActive && notesMode === "text" ? 5 : 1 }}
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest("textarea,button,[contenteditable=\"true\"],.notes-flow-resize-handle")) return;
                  event.stopPropagation();
                  if (state.tool === "hand" || spacePressed || event.button === 1) { startPan(event); return; }
                  if (event.button !== 0) return;
                  setActiveSlide(slide.id);
                  setEditingNotesBoard(notesMode === "visual");
                }}
              >
                {notesMode === "text" ? (
                  <RichTextNoteEditor
                    slideId={slide.id}
                    className="notes-flow-text-note-editor"
                    style={{ backgroundColor: board?.background.color ?? "#e9efe6", color: noteTextColor(board?.background.color) }}
                    html={slide.notesHtml}
                    plainText={slide.notes}
                    placeholder={uiText("Írd ide az előadói jegyzetet…")}
                    onFocus={() => { setActiveSlide(slide.id); setEditingNotesBoard(false); }}
                    onChange={(plainText, richHtml) => updateSlideNotes(slide.id, plainText, richHtml)}
                  />
                ) : showVisualPreview && renderPair ? (
                  <NotesBoardPreview project={project} slide={slide} assetById={assetById} />
                ) : null}
              </div>
              <div
                className="notes-flow-resize-handle notes-flow-resize-handle-overlay"
                style={{ left: project.width + NOTES_BOARD_GAP + noteWidth - 34, top: noteHeight - 34 }}
                onPointerDown={(event) => startNotesResize(event, slide.id)}
                title={uiText("Jegyzet méretezése")}
              />

              <div
                className={`notes-flow-note-meta ${isActive ? "is-active" : ""}`}
                style={{ left: project.width + NOTES_BOARD_GAP, top: rowHeight + 18, width: noteWidth }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <span className="notes-flow-note-badge">NOTE</span>
                <div className="notes-flow-mode-switch">
                  <button className={notesMode === "text" ? "active" : ""} onClick={() => setNotesMode(slide.id, "text")}>{uiText("Szöveges")}</button>
                  <button className={notesMode === "visual" ? "active" : ""} onClick={() => setNotesMode(slide.id, "visual")}>{uiText("Vizuális")}</button>
                </div>
                <span className="notes-flow-note-size">{Math.round(noteWidth)} × {Math.round(noteHeight)}</span>
                <label className="notes-flow-note-color" title={uiText("Jegyzet háttérszíne")}>
                  <span>{uiText("Háttér")}</span>
                  <input type="color" value={board?.background.color ?? "#e9efe6"} onChange={(event) => setNotesBackground(slide.id, event.currentTarget.value)} />
                </label>
                <button className="notes-flow-note-preset" onClick={() => resetNotesPortrait(slide.id)} title={uiText("Álló 3:4 alapméret")}>3:4</button>
                {notesMode === "text" && <span className="notes-flow-note-count">{slide.notes.length.toLocaleString()} {uiText("karakter")}</span>}
              </div>
            </div>
          );
        })}
        <div
          className={`slide-stage ${continuousView || notesSingleView ? "continuous-active-slide" : ""} ${longformView ? "longform-active-section pasteboard-view" : state.workspace.trimView ? "trim-view" : "pasteboard-view"}`}
          style={continuousView || notesSingleView ? { position: "absolute", left: activeBoardOffsetX, top: activeSlideOffsetY, width: activeCanvasWidth, height: activeCanvasHeight, ...(longformView || notesView ? { zIndex: 4 } : {}) } : undefined}
          onPointerDown={handleStagePointerDown}
        >
          {!longformView && <SceneBackground project={project} background={background} mode="editor" assetById={assetById} />}
          {notesPairView && !notesView && <div className="notes-flow-active-label">{`${activeSlideIndex + 1}. ${activeSlide.name}`}</div>}

          {state.workspace.showGrid && effectiveGrid.enabled && (
            <div className="layout-grid" aria-hidden>
              {gridColumns.map((column, index) => (
                <div key={index} className="layout-grid-column" style={column} />
              ))}
              {effectiveGrid.baseline > 0 && (
                <div
                  className="baseline-grid"
                  style={{
                    top: effectiveGrid.marginY,
                    bottom: effectiveGrid.marginY,
                    backgroundSize: `100% ${effectiveGrid.baseline}px`,
                  }}
                />
              )}
            </div>
          )}

          {masterElements.map((element) => {
            if (!element.visible) return null;
            const assetId = "assetId" in element ? element.assetId : element.type === "shape" ? element.fillAssetId : undefined;
            const asset = assetId ? assetById.get(assetId) : undefined;
            const maskAssetId = (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") ? element.mask?.assetId : undefined;
            const maskAsset = maskAssetId ? assetById.get(maskAssetId) : undefined;
            const visualElement = element.type === "text" ? withResolvedDynamicText(project, activeSlide, element) : element;
            return (
              <div
                key={`master-${element.id}`}
                className="editor-element master-element"
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  transform: `rotate(${element.rotation}deg)`,
                  transformOrigin: element.type === "shape" && element.shape === "line" ? "left center" : "center center",
                  opacity: element.opacity,
                  filter: elementEffectsFilter(element.effects),
                }}
              >
                <ElementVisual element={visualElement} asset={asset} maskAsset={maskAsset} assetById={assetById} mode="editor" active={false} />
              </div>
            );
          })}

          {activeContainer.elements.map((element) => {
            if (!element.visible) return null;
            const selected = state.selection.includes(element.id);
            const assetId = "assetId" in element ? element.assetId : element.type === "shape" ? element.fillAssetId : undefined;
            const asset = assetId ? assetById.get(assetId) : undefined;
            const maskAssetId = (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") ? element.mask?.assetId : undefined;
            const maskAsset = maskAssetId ? assetById.get(maskAssetId) : undefined;
            const visualElement = element.type === "text" ? withResolvedDynamicText(project, activeSlide, element) : element;
            return (
              <div
                key={element.id}
                className={`editor-element ${selected ? "selected" : ""} ${element.locked ? "locked" : ""} ${editingImageId === element.id ? "image-content-editing" : ""}`}
                data-element-id={element.id}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  transform: `rotate(${element.rotation}deg)`,
                  transformOrigin: element.type === "shape" && element.shape === "line" ? "left center" : "center center",
                  opacity: element.opacity,
                  filter: elementEffectsFilter(element.effects),
                  pointerEvents: element.locked ? "none" : undefined,
                }}
                onPointerDown={(event) => handleElementPointerDown(event, element)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (element.type === "text" && !element.locked && (element.dynamicField ?? "none") === "none") {
                    setSelection([element.id]);
                    setEditingImageId(null);
                    setEditingTextId(element.id);
                  } else if ((element.type === "image" || element.type === "slideshow" || element.type === "pdf") && !element.locked) {
                    setSelection([element.id]);
                    setEditingTextId(null);
                    setEditingImageId(element.id);
                  }
                }}
              >
                <ElementVisual
                  element={visualElement}
                  asset={asset}
                  maskAsset={maskAsset}
                  assetById={assetById}
                  mode="editor"
                  active={selected}
                  editingText={editingTextId === element.id}
                  showOverflowIndicator={element.type === "text"}
                  onTextCommit={(text) => {
                    setEditingTextId(null);
                    updateElement(element.id, { text } as Partial<SlideElement>);
                  }}
                />
                {selected && (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") && element.mask?.kind === "path" && <MaskPathEditor element={element} />}
              </div>
            );
          })}

          {state.workspace.showGuides &&
            inheritedGuides.vertical.map((value, index) => renderGuide(value, "vertical", index, true))}
          {state.workspace.showGuides &&
            inheritedGuides.horizontal.map((value, index) => renderGuide(value, "horizontal", index, true))}
          {state.workspace.showGuides &&
            activeContainer.guides.vertical.map((value, index) => renderGuide(value, "vertical", index))}
          {state.workspace.showGuides &&
            activeContainer.guides.horizontal.map((value, index) => renderGuide(value, "horizontal", index))}

          {draggingGuide && (
            <div
              className={`canvas-guide canvas-guide-${draggingGuide.orientation} dragging`}
              style={
                draggingGuide.orientation === "vertical"
                  ? { left: draggingGuide.value, width: 1 / state.zoom }
                  : { top: draggingGuide.value, height: 1 / state.zoom }
              }
            />
          )}

          {smartLines.map((line, index) => (
            <div
              key={`${line.axis}-${line.position}-${index}`}
              className={`smart-guide smart-guide-${line.axis}`}
              style={
                line.axis === "x"
                  ? { left: line.position, top: line.from, height: line.to - line.from, width: 1 / state.zoom }
                  : { top: line.position, left: line.from, width: line.to - line.from, height: 1 / state.zoom }
              }
            />
          ))}

          {marquee && (
            <div
              className="selection-marquee"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.width,
                height: marquee.height,
                borderWidth: 1 / state.zoom,
              }}
            />
          )}

          {creationPreview && (
            <div
              className={`creation-preview creation-preview-${creationPreview.tool}`}
              style={{
                left: creationPreview.rect.x,
                top: creationPreview.rect.y,
                width: Math.max(1, creationPreview.rect.width),
                height: Math.max(1, creationPreview.rect.height),
                transform: `rotate(${creationPreview.rotation ?? 0}deg)`,
                transformOrigin: "left center",
                borderWidth: 1 / state.zoom,
              }}
            />
          )}

          {selectedElements.length > 0 && (
            <div
              className="selection-bounds"
              style={{
                left: selectionBounds.x,
                top: selectionBounds.y,
                width: selectionBounds.width,
                height: selectionBounds.height,
                borderWidth: 1 / state.zoom,
              }}
            >
              {selectedElements.length === 1 && !selectedElements[0].locked &&
                ((selectedElements[0].type === "text" && selectedElements[0].resizeMode === "scale"
                  ? ["nw", "ne", "se", "sw"]
                  : ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) as ResizeHandle[]).map((handle) => (
                  <button
                    key={handle}
                    className={`resize-handle handle-${handle}`}
                    style={{
                      width: 9 / state.zoom,
                      height: 9 / state.zoom,
                      borderWidth: 1 / state.zoom,
                    }}
                    onPointerDown={(event) => startResize(event, selectedElements[0], handle)}
                    aria-label={`Méretezés ${handle}`}
                  />
                ))}
              {selectedElements.length === 1 && !selectedElements[0].locked && selectedElements[0].type === "text" && (
                <button
                  type="button"
                  className={`text-resize-mode-toggle ${selectedElements[0].resizeMode === "scale" ? "is-scale" : "is-box"}`}
                  style={{
                    right: -30 / state.zoom,
                    width: 22 / state.zoom,
                    height: 22 / state.zoom,
                    borderWidth: 1 / state.zoom,
                  }}
                  onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); }}
                  onClick={(event) => {
                    event.stopPropagation();
                    const element = selectedElements[0];
                    if (element.type !== "text") return;
                    updateElement(element.id, { resizeMode: element.resizeMode === "box" ? "scale" : "box" } as Partial<SlideElement>);
                  }}
                  title={uiText(selectedElements[0].resizeMode === "box" ? "Sz\u00f6veg m\u00e9retez\u00e9se" : "Doboz")}
                  aria-label={uiText(selectedElements[0].resizeMode === "box" ? "Sz\u00f6veg m\u00e9retez\u00e9se" : "Doboz")}
                >
                  <Icon name={selectedElements[0].resizeMode === "box" ? "rect" : "text"} size={12 / state.zoom} strokeWidth={1.8} />
                </button>
              )}
              <div className="selection-size-label" style={{ transform: `translateX(-50%) scale(${1 / state.zoom})` }}>
                {round(selectionBounds.width)} × {round(selectionBounds.height)}
              </div>
            </div>
          )}

          {editingImageId && selectedElements.length === 1 && selectedElements[0].id === editingImageId && (
            <div
              className="image-editing-hint"
              style={{
                left: selectionBounds.x + selectionBounds.width / 2,
                top: selectionBounds.y + selectionBounds.height / 2,
                transform: `translate(-50%, -50%) scale(${1 / state.zoom})`,
              }}
            >{uiText("Kép mozgatása a keretben · Esc")}</div>
          )}

          {altPressed && selectedElements.length > 0 && (
            <DistanceOverlay
              selection={selectionBounds}
              others={activeContainer.elements.filter((element) => !state.selection.includes(element.id) && element.visible)}
              width={activeCanvasWidth}
              height={activeCanvasHeight}
              zoom={state.zoom}
            />
          )}
        </div>
      </div>

      {notesLongformView && longformNoteSlide && (() => {
        const board = longformNoteSlide.notesBoard;
        const mode = board?.mode ?? "text";
        const sectionNumber = Math.max(0, project.slides.findIndex((slide) => slide.id === longformNoteSlide.id)) + 1;
        const noteScale = board ? Math.min(0.42, 310 / Math.max(1, board.width)) : 0.34;
        return (
          <aside className="longform-notes-dock" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
            <div className="longform-notes-dock-head">
              <span className="notes-flow-note-badge">NOTE</span>
              <strong>{state.workspace.language === "en" ? `Section ${sectionNumber}` : `${sectionNumber}. szekció`}</strong>
              <span className="longform-notes-dock-title">{longformNoteSlide.name}</span>
            </div>
            <div className="longform-notes-dock-tools">
              <div className="notes-flow-mode-switch">
                <button className={mode === "text" ? "active" : ""} onClick={() => setNotesMode(longformNoteSlide.id, "text", false)}>{uiText("Szöveges")}</button>
                <button className={mode === "visual" ? "active" : ""} onClick={() => setNotesMode(longformNoteSlide.id, "visual", false)}>{uiText("Vizuális")}</button>
              </div>
              <label className="notes-flow-note-color" title={uiText("Jegyzet háttérszíne")}>
                <span>{uiText("Háttér")}</span>
                <input type="color" value={board?.background.color ?? "#e9efe6"} onChange={(event) => setNotesBackground(longformNoteSlide.id, event.currentTarget.value)} />
              </label>
            </div>
            <div className="longform-notes-dock-body" style={{ backgroundColor: board?.background.color ?? "#e9efe6" }}>
              {mode === "text" ? (
                <RichTextNoteEditor
                  slideId={longformNoteSlide.id}
                  className="longform-notes-text-editor"
                  html={longformNoteSlide.notesHtml}
                  plainText={longformNoteSlide.notes}
                  placeholder={uiText("Írd ide az előadói jegyzetet…")}
                  onChange={(plainText, richHtml) => updateSlideNotes(longformNoteSlide.id, plainText, richHtml)}
                  style={{ backgroundColor: board?.background.color ?? "#e9efe6", color: noteTextColor(board?.background.color) }}
                />
              ) : board ? (
                <div className="longform-notes-visual-scroll">
                  <div style={{ width: board.width * noteScale, height: board.height * noteScale, margin: "18px auto 30px", position: "relative" }}>
                    <div style={{ transform: `scale(${noteScale})`, transformOrigin: "top left", width: board.width, height: board.height }}>
                      <NotesBoardPreview project={project} slide={longformNoteSlide} assetById={assetById} />
                    </div>
                  </div>
                  <div className="longform-notes-visual-hint">{uiText("A vizuális jegyzet szerkesztéséhez válts Egy dia vagy Folyamatos nézetre.")}</div>
                </div>
              ) : null}
            </div>
          </aside>
        );
      })()}

      <div className="canvas-hud">
        <span>{notesView ? uiText("Előadói jegyzetlap") : state.editingMasterId ? "Mesteroldal" : longformView ? `One Slide · ${state.workspace.language === "en" ? "Section" : "Szekció"} ${project.slides.findIndex((slide) => slide.id === state.activeSlideId) + 1}` : `${project.slides.findIndex((slide) => slide.id === state.activeSlideId) + 1}. dia`}</span>
        <span>{Math.round(state.zoom * 100)}%</span>
        {state.workspace.snapEnabled && <span>Snap</span>}
      </div>
    </div>
  );
}
