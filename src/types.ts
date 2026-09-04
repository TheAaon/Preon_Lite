export type ToolId = "select" | "text" | ShapeKind | "imageFrame" | "hand" | "eyedropperColor" | "eyedropperFormat";
export type PanelTab = "slides" | "masters" | "properties" | "textOverview" | "layers" | "assets";
export type AppTheme = "dark" | "light" | "system";
export type AppLanguage = "hu" | "en";
export type ContextMenuProfile = "canvas" | "element" | "text" | "shape" | "media" | "multi" | "slide";
export type ElementType = "text" | "shape" | "image" | "slideshow" | "video" | "pdf" | "web" | "model3d";
export type ShapeKind = "rect" | "rounded-rect" | "ellipse" | "triangle" | "star" | "polygon" | "line" | "arrow";
export type FitMode = "cover" | "contain" | "fill";
export type MediaMaskKind = "none" | "ellipse" | "rounded-rect" | "svg" | "path";
export interface MaskPoint { x: number; y: number; }

export interface MediaMaskConfig {
  kind: MediaMaskKind;
  assetId?: string;
  invert?: boolean;
  points?: MaskPoint[];
}

export type AnimationKind = "none" | "fade" | "fade-up" | "scale";
export type AnimationTrigger = "with-slide" | "on-click";

export interface AnimationConfig {
  kind: AnimationKind;
  trigger: AnimationTrigger;
  duration: number;
  delay: number;
}

export type ElementNavigationType = "none" | "section";

export interface ElementNavigation {
  type: ElementNavigationType;
  targetSlideId?: string;
  smooth?: boolean;
}

export type ElementScrollMode = "normal" | "sticky";
export type ElementScrollRangeMode = "screens" | "until-section";
export type ElementScrollPinBehavior = "hard";

export interface ElementScrollMotion {
  /** Enables simple scroll-driven transforms for presentation-first motion. */
  enabled: boolean;
  opacityFrom: number;
  opacityTo: number;
  scaleFrom: number;
  scaleTo: number;
  offsetXFrom: number;
  offsetXTo: number;
  offsetYFrom: number;
  offsetYTo: number;
}

export interface ElementScrollBehavior {
  /** Normal = the element moves with the page; Sticky = it stays visually pinned for the configured range. */
  mode: ElementScrollMode;
  /** Pin is pixel-stable in One Slide mode. Legacy soft pins migrate to hard. */
  pinBehavior?: ElementScrollPinBehavior;
  /** The range can be expressed in viewport-heights or by the start of a later One Slide section. */
  rangeMode: ElementScrollRangeMode;
  screens: number;
  targetSlideId?: string;
  /** Optional scroll-driven opacity / scale / position motion using the same range. */
  motion?: ElementScrollMotion;
}

export interface ElementDropShadowEffect {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface ElementGlowEffect {
  enabled: boolean;
  blur: number;
  color: string;
  opacity: number;
}

export interface ElementEffects {
  blur: number;
  dropShadow: ElementDropShadowEffect;
  glow: ElementGlowEffect;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  groupId?: string;
  masterSourceId?: string;
  animation: AnimationConfig;
  /** Optional presentation navigation action. */
  navigation?: ElementNavigation;
  /** One Slide object-level scroll behavior. */
  scrollBehavior?: ElementScrollBehavior;
  /** Non-destructive visual effects shared by text, shapes and media. */
  effects?: ElementEffects;
}

export type DynamicTextField = "none" | "slide-number" | "total-slides" | "slide-number-total";
export type SlideNumberFormat = "1" | "01" | "001";

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  dynamicField: DynamicTextField;
  numberFormat: SlideNumberFormat;
  dynamicPrefix: string;
  dynamicSuffix: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  strikethrough?: boolean;
  textTransform?: "none" | "uppercase";
  fontVariantCaps?: "normal" | "small-caps";
  baselineMode?: "normal" | "super" | "sub";
  baselineShift?: number;
  ligatures?: boolean;
  lineHeight: number;
  lineHeightAuto?: boolean;
  letterSpacing: number;
  letterSpacingAuto?: boolean;
  paragraphSpacingBefore?: number;
  paragraphSpacingAfter?: number;
  firstLineIndent?: number;
  color: string;
  textAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  background: string;
  padding: number;
  resizeMode: "box" | "scale";
  textStyleId?: string;
}

export interface TextStyleRecord {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  strikethrough: boolean;
  textTransform: "none" | "uppercase";
  fontVariantCaps: "normal" | "small-caps";
  baselineMode: "normal" | "super" | "sub";
  baselineShift: number;
  ligatures: boolean;
  lineHeight: number;
  lineHeightAuto: boolean;
  letterSpacing: number;
  letterSpacingAuto: boolean;
  paragraphSpacingBefore: number;
  paragraphSpacingAfter: number;
  firstLineIndent: number;
  color: string;
  textAlign: "left" | "center" | "right" | "justify";
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  fillType: "color" | "gradient" | "image" | "video";
  fillAssetId?: string;
  fillFit: FitMode;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  fillPosterTime: number;
  fillPosterDataUrl?: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

export interface ImageElement extends BaseElement {
  type: "image";
  assetId: string;
  fit: FitMode;
  radius: number;
  borderColor: string;
  borderWidth: number;
  contentPositionX: number;
  contentPositionY: number;
  contentScale: number;
  mask: MediaMaskConfig;
}


export type SlideshowStartMode = "slide-enter" | "on-click";
export type SlideshowTransition = "cut" | "fade";

export interface SlideshowElement extends BaseElement {
  type: "slideshow";
  /** Ordered image/GIF assets shown inside one reusable image-like frame. */
  assetIds: string[];
  fit: FitMode;
  radius: number;
  borderColor: string;
  borderWidth: number;
  contentPositionX: number;
  contentPositionY: number;
  contentScale: number;
  mask: MediaMaskConfig;
  /** Seconds each image stays visible before advancing. */
  interval: number;
  transition: SlideshowTransition;
  /** Fade duration in seconds. Ignored for cut transitions. */
  transitionDuration: number;
  startMode: SlideshowStartMode;
  loop: boolean;
  /** In Present mode a click toggles play/pause without advancing the slide. */
  clickToggle: boolean;
}

export interface PdfElement extends BaseElement {
  type: "pdf";
  assetId: string;
  page: number;
  pageCount: number;
  fit: FitMode;
  radius: number;
  borderColor: string;
  borderWidth: number;
  contentPositionX: number;
  contentPositionY: number;
  contentScale: number;
  mask: MediaMaskConfig;
  /** Export-only cached raster. Kept optional so project files stay compact. */
  renderedDataUrl?: string;
}

export type VideoPlaybackMode = "normal" | "scroll";

export interface VideoElement extends BaseElement {
  type: "video";
  assetId: string;
  fit: FitMode;
  radius: number;
  autoplay: boolean;
  /** Normal time-based playback or One Slide scroll-scrubbing. */
  playbackMode?: VideoPlaybackMode;
  loop: boolean;
  muted: boolean;
  controls: boolean;
  startTime: number;
  endTime?: number;
  posterTime: number;
  posterDataUrl?: string;
  mask: MediaMaskConfig;
}


export type Model3DInteraction = "none" | "orbit" | "parallax" | "scroll";

export interface Model3DElement extends BaseElement {
  type: "model3d";
  assetId: string;
  interaction: Model3DInteraction;
  autoRotate: boolean;
  autoRotateSpeed: number;
  orbitTheta: number;
  orbitPhi: number;
  fieldOfView: number;
  cameraDistance: number;
  parallaxStrength: number;
  scrollRotation: number;
  exposure: number;
  shadowIntensity: number;
  backgroundColor: string;
  transparentBackground: boolean;
  interactiveInEditor: boolean;
  posterDataUrl?: string;
}

export interface WebElement extends BaseElement {
  type: "web";
  sourceType: "url" | "local";
  url: string;
  assetId?: string;
  radius: number;
  interactiveInEditor: boolean;
}

export type SlideElement = TextElement | ShapeElement | ImageElement | SlideshowElement | VideoElement | PdfElement | WebElement | Model3DElement;

export interface Guides {
  vertical: number[];
  horizontal: number[];
}

export interface GridSettings {
  enabled: boolean;
  columns: number;
  gutter: number;
  marginX: number;
  marginY: number;
  baseline: number;
}

export interface BackgroundSettings {
  inherit: boolean;
  color: string;
  assetId?: string;
  type: "color" | "image" | "video";
  fit: FitMode;
}

export type NotesMode = "text" | "visual";

export interface NotesBoard {
  name: string;
  /** Text is the lightweight, scrollable speaker-note mode; visual reuses the canvas tools. */
  mode: NotesMode;
  /** Independent note-card size in editor coordinates. It is intentionally not tied to the 16:9 slide. */
  width: number;
  height: number;
  background: BackgroundSettings;
  guides: Guides;
  grid: GridSettings;
  elements: SlideElement[];
}

export interface Slide {
  id: string;
  name: string;
  hidden: boolean;
  masterId: string | null;
  background: BackgroundSettings;
  guides: Guides;
  grid: GridSettings;
  inheritMasterGrid: boolean;
  elements: SlideElement[];
  notes: string;
  /** Sanitized rich-text HTML for Text Note mode. Plain `notes` is kept as a compatibility/search fallback. */
  notesHtml?: string;
  /** Visual presenter notes canvas. It is editor-only and never appears in audience exports. */
  notesBoard?: NotesBoard;
  transition: "none" | "fade" | "slide";
  /** One Slide section height relative to the normal project slide height. 1 = 100%. */
  longformHeightScale?: number;
  /** Pins the normal slide-sized content viewport while scrolling through a taller One Slide section. */
  longformSticky?: boolean;
  sectionId?: string;
  /** Legacy v0.9 section marker, migrated automatically in v0.10. */
  sectionTitle?: string;
  /** Legacy v0.9 collapsed state, migrated automatically in v0.10. */
  sectionCollapsed?: boolean;
}

export interface SlideSection {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface MasterSlide {
  id: string;
  name: string;
  parentMasterId: string | null;
  inheritParentGrid: boolean;
  background: BackgroundSettings;
  guides: Guides;
  grid: GridSettings;
  elements: SlideElement[];
}

export type AssetKind = "image" | "video" | "svg" | "gif" | "pdf" | "html" | "html-app" | "model3d" | "unknown";

export interface AssetRecord {
  id: string;
  name: string;
  path?: string;
  dataUrl?: string;
  kind: AssetKind;
  mime?: string;
  size?: number;
  pageCount?: number;
  bundleRoot?: string;
  createdAt: string;
}

export interface PresentationProject {
  format: "presentation-studio";
  formatVersion: 1;
  appVersion: string;
  id: string;
  name: string;
  width: number;
  height: number;
  presentationMode: "slides" | "longform";
  /** Standard exports only the audience HTML; presenter additionally creates presenter.html with notes. */
  htmlExportMode?: "standard" | "presenter";
  slides: Slide[];
  sections: SlideSection[];
  masters: MasterSlide[];
  assets: AssetRecord[];
  textStyles: TextStyleRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceConfig {
  name: string;
  leftVisible: boolean;
  rightVisible: boolean;
  leftWidth: number;
  rightWidth: number;
  leftTab: "slides" | "masters";
  rightTab: "properties" | "textOverview" | "layers" | "assets";
  showRulers: boolean;
  showGuides: boolean;
  showGrid: boolean;
  smartGuides: boolean;
  snapEnabled: boolean;
  toolbarItems: string[];
  theme: AppTheme;
  darkBrightness: number;
  lightBrightness: number;
  language: AppLanguage;
  canvasView: "single" | "continuous";
  trimView: boolean;
  /** Optional side-by-side visual presenter notes canvas. Hidden by default. */
  showNotesBoard: boolean;
  recentFonts: string[];
  favoriteFonts: string[];
  selectedShape: ShapeKind;
  contextMenuItems: Record<ContextMenuProfile, string[]>;
}

export interface EditorState {
  project: PresentationProject;
  projectPath: string | null;
  activeSlideId: string;
  slideSelection: string[];
  editingMasterId: string | null;
  /** When true, the regular canvas tools edit the active slide's presenter notes board. */
  editingNotesBoard: boolean;
  selection: string[];
  tool: ToolId;
  zoom: number;
  pan: { x: number; y: number };
  workspace: WorkspaceConfig;
  historyPast: PresentationProject[];
  historyFuture: PresentationProject[];
  dirty: boolean;
  status: string;
  presentMode: boolean;
  presentIndex: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SmartGuideLine {
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
  label?: string;
}

export interface ImportedAssetResult {
  path: string;
  name: string;
  size: number;
}

export interface ExportAssetItem {
  sourcePath: string;
  targetName: string;
}

export interface FontFileRecord {
  family: string;
  path: string;
  embeddable: boolean;
  format: string;
  styleName: string;
  weight: number;
  italic: boolean;
}

export interface LocalShareResult {
  url: string;
  port: number;
}
