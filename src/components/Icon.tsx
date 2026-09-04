import type { ComponentType, SVGProps } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  AppWindow,
  BringToFront,
  Box,
  Hash,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  CopyPlus,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileArchive,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  Library,
  StickyNote,
  Globe2,
  Sun,
  Moon,
  Languages,
  Info,
  Grid3X3,
  Group,
  Hand,
  Image,
  Layers3,
  LayoutPanelLeft,
  LayoutTemplate,
  Link,
  Lock,
  Magnet,
  Maximize2,
  Menu,
  Minus,
  MousePointer2,
  Move,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Printer,
  Ruler,
  Save,
  SendToBack,
  Settings2,
  SlidersHorizontal,
  Square,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type IconName =
  | "select"
  | "hand"
  | "text"
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "triangle"
  | "star"
  | "polygon"
  | "line"
  | "arrow"
  | "imageFrame"
  | "image"
  | "slideshow"
  | "pdf"
  | "video"
  | "web"
  | "undo"
  | "redo"
  | "duplicate"
  | "delete"
  | "group"
  | "ungroup"
  | "play"
  | "pause"
  | "save"
  | "open"
  | "new"
  | "export"
  | "settings"
  | "menu"
  | "plus"
  | "copy"
  | "close"
  | "layers"
  | "masters"
  | "slides"
  | "grid"
  | "ruler"
  | "snap"
  | "eye"
  | "eyeOff"
  | "lock"
  | "unlock"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "more"
  | "zoomIn"
  | "zoomOut"
  | "fit"
  | "move"
  | "link"
  | "import"
  | "archive"
  | "reset"
  | "panelLeftOpen"
  | "panelLeftClose"
  | "panelRightOpen"
  | "panelRightClose"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignTop"
  | "alignMiddle"
  | "alignBottom"
  | "distributeH"
  | "distributeV"
  | "front"
  | "back"
  | "check"
  | "properties"
  | "app"
  | "share"
  | "print"
  | "model3d"
  | "slideNumber"
  | "section"
  | "assets"
  | "notes"
  | "sun"
  | "moon"
  | "language"
  | "info"
  | "singleView"
  | "continuousView"
  | "oneSlide"
  | "trimView"
  | "eyedropper";

const iconMap: Record<Exclude<IconName, "roundedRect" | "triangle" | "star" | "polygon" | "arrow" | "imageFrame" | "slideshow" | "singleView" | "continuousView" | "oneSlide" | "trimView" | "eyedropper">, ComponentType<SVGProps<SVGSVGElement>>> = {
  select: MousePointer2,
  hand: Hand,
  text: Type,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  image: Image,
  pdf: FileText,
  video: Video,
  web: Globe2,
  undo: Undo2,
  redo: Redo2,
  duplicate: CopyPlus,
  delete: Trash2,
  group: Group,
  ungroup: Ungroup,
  play: Play,
  pause: Pause,
  save: Save,
  open: FolderOpen,
  new: FilePlus2,
  export: FileDown,
  settings: Settings2,
  menu: Menu,
  plus: Plus,
  copy: Copy,
  close: X,
  layers: Layers3,
  masters: LayoutTemplate,
  slides: LayoutPanelLeft,
  grid: Grid3X3,
  ruler: Ruler,
  snap: Magnet,
  eye: Eye,
  eyeOff: EyeOff,
  lock: Lock,
  unlock: Unlock,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  more: Ellipsis,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  fit: Maximize2,
  move: Move,
  link: Link,
  import: Upload,
  archive: FileArchive,
  reset: RotateCcw,
  panelLeftOpen: PanelLeftOpen,
  panelLeftClose: PanelLeftClose,
  panelRightOpen: PanelRightOpen,
  panelRightClose: PanelRightClose,
  alignLeft: AlignStartVertical,
  alignCenter: AlignCenterVertical,
  alignRight: AlignEndVertical,
  alignTop: AlignStartHorizontal,
  alignMiddle: AlignCenterHorizontal,
  alignBottom: AlignEndHorizontal,
  distributeH: AlignHorizontalDistributeCenter,
  distributeV: AlignVerticalDistributeCenter,
  front: BringToFront,
  back: SendToBack,
  check: Check,
  properties: SlidersHorizontal,
  app: AppWindow,
  share: Share2,
  print: Printer,
  model3d: Box,
  slideNumber: Hash,
  section: FolderPlus,
  assets: Library,
  notes: StickyNote,
  sun: Sun,
  moon: Moon,
  language: Languages,
  info: Info,
};

export function Icon({ name, size = 17, strokeWidth = 1.8, className }: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (name === "eyedropper") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d="m19.2 3.8 1 1a2.3 2.3 0 0 1 0 3.2l-8.7 8.7-4.2.8.8-4.2 8.7-8.7a2.3 2.3 0 0 1 3.2 0Z"/><path d="m14.8 6.6 2.6 2.6"/><path d="M5.2 18.8 3 21l3.8-.8"/></svg>;
  }
  if (name === "roundedRect") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} aria-hidden><rect x="3.5" y="5" width="17" height="14" rx="4"/></svg>;
  }
  if (name === "triangle") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" className={className} aria-hidden><path d="M12 3.5 21 20H3Z"/></svg>;
  }
  if (name === "star") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" className={className} aria-hidden><path d="m12 2.7 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9Z"/></svg>;
  }
  if (name === "polygon") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" className={className} aria-hidden><path d="M7 3.5h10l5 8.5-5 8.5H7L2 12Z"/></svg>;
  }
  if (name === "arrow") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden><path d="M3 12h14M13 7l5 5-5 5"/></svg>;
  }
  if (name === "imageFrame") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={className} aria-hidden><rect x="3.5" y="3.5" width="17" height="17"/><path d="m6.5 6.5 11 11m0-11-11 11"/></svg>;
  }
  if (name === "slideshow") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><rect x="5.2" y="3.7" width="14.4" height="11.2" rx="1.5"/><path d="m7.8 12 3.1-3 2.1 2 1.7-1.5 2.6 2.5"/><circle cx="15.8" cy="7.2" r="1"/><path d="M4.1 7.3H3.5A1.5 1.5 0 0 0 2 8.8v9.9a1.6 1.6 0 0 0 1.6 1.6h12.8a1.6 1.6 0 0 0 1.6-1.6v-.9"/></svg>;
  }
  if (name === "singleView") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} aria-hidden><rect x="3.5" y="6" width="17" height="12" rx="2.3"/></svg>;
  }
  if (name === "continuousView") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d="M5 0.8v3.1C5 5.6 6.4 7 8.1 7h7.8C17.6 7 19 5.6 19 3.9V.8"/><rect x="5" y="8.2" width="14" height="7.6" rx="2"/><path d="M5 23.2v-3.1C5 18.4 6.4 17 8.1 17h7.8c1.7 0 3.1 1.4 3.1 3.1v3.1"/></svg>;
  }
  if (name === "oneSlide") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9h12M6 15h12"/></svg>;
  }
  if (name === "trimView") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={className} aria-hidden><rect x="5" y="5" width="14" height="14" rx="1.4"/><path d="M2 8V2h6M16 2h6v6M22 16v6h-6M8 22H2v-6"/></svg>;
  }
  const Component = iconMap[name];
  return <Component width={size} height={size} strokeWidth={strokeWidth} className={className} />;
}
