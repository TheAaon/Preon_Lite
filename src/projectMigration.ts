import { defaultGrid, defaultNotesBoard, defaultNotesTextElement } from "./defaultProject";
import type { PresentationProject, SlideElement, TextElement, ImageElement, SlideshowElement, VideoElement, PdfElement, ShapeElement, Model3DElement, SlideSection } from "./types";
import { APP_VERSION, normalizeProjectName } from "./utils";
import { normalizedElementEffects } from "./elementAppearance";
import { noteHtmlToPlainText, plainTextToNoteHtml, sanitizeRichNoteHtml } from "./notesRichText";

function migrateElement(element: SlideElement): SlideElement {
  element.opacity ??= 1;
  element.visible ??= true;
  element.locked ??= false;
  element.rotation ??= 0;
  element.animation ??= { kind: "none", trigger: "with-slide", duration: 0.6, delay: 0 };
  element.navigation ??= { type: "none", smooth: true };
  element.scrollBehavior ??= { mode: "normal", rangeMode: "screens", screens: 2 };
  element.effects = normalizedElementEffects(element.effects);
  element.scrollBehavior.mode = element.scrollBehavior.mode === "sticky" ? "sticky" : "normal";
  // v0.20: Soft Pin kivezetve; minden korábbi pin stabil Hard Pin lesz.
  element.scrollBehavior.pinBehavior = "hard";
  element.scrollBehavior.rangeMode = element.scrollBehavior.rangeMode === "until-section" ? "until-section" : "screens";
  element.scrollBehavior.screens = Number.isFinite(Number(element.scrollBehavior.screens)) ? Math.min(12, Math.max(0.25, Number(element.scrollBehavior.screens))) : 2;
  const motion = element.scrollBehavior.motion;
  if (motion) {
    motion.enabled = Boolean(motion.enabled);
    motion.opacityFrom = Number.isFinite(Number(motion.opacityFrom)) ? Math.min(1, Math.max(0, Number(motion.opacityFrom))) : 0;
    motion.opacityTo = Number.isFinite(Number(motion.opacityTo)) ? Math.min(1, Math.max(0, Number(motion.opacityTo))) : 1;
    motion.scaleFrom = Number.isFinite(Number(motion.scaleFrom)) ? Math.min(4, Math.max(0.1, Number(motion.scaleFrom))) : 0.96;
    motion.scaleTo = Number.isFinite(Number(motion.scaleTo)) ? Math.min(4, Math.max(0.1, Number(motion.scaleTo))) : 1;
    motion.offsetXFrom = Number.isFinite(Number(motion.offsetXFrom)) ? Math.min(5000, Math.max(-5000, Number(motion.offsetXFrom))) : 0;
    motion.offsetXTo = Number.isFinite(Number(motion.offsetXTo)) ? Math.min(5000, Math.max(-5000, Number(motion.offsetXTo))) : 0;
    motion.offsetYFrom = Number.isFinite(Number(motion.offsetYFrom)) ? Math.min(5000, Math.max(-5000, Number(motion.offsetYFrom))) : 60;
    motion.offsetYTo = Number.isFinite(Number(motion.offsetYTo)) ? Math.min(5000, Math.max(-5000, Number(motion.offsetYTo))) : 0;
  }

  if (element.type === "text") {
    const text = element as TextElement;
    text.resizeMode ??= "box";
    text.fontStyle ??= "normal";
    text.textDecoration ??= "none";
    text.strikethrough ??= false;
    text.textTransform = text.textTransform === "uppercase" ? "uppercase" : "none";
    text.fontVariantCaps = text.fontVariantCaps === "small-caps" ? "small-caps" : "normal";
    text.baselineMode = text.baselineMode === "super" ? "super" : text.baselineMode === "sub" ? "sub" : "normal";
    text.baselineShift = Number.isFinite(Number(text.baselineShift)) ? Number(text.baselineShift) : 0;
    text.ligatures ??= true;
    text.lineHeight = Number.isFinite(Number(text.lineHeight)) ? Math.max(0.5, Number(text.lineHeight)) : 1.2;
    text.lineHeightAuto = text.lineHeightAuto === true;
    text.letterSpacing = Number.isFinite(Number(text.letterSpacing)) ? Number(text.letterSpacing) : 0;
    text.letterSpacingAuto = text.letterSpacingAuto === true;
    text.paragraphSpacingBefore = Number.isFinite(Number(text.paragraphSpacingBefore)) ? Math.max(0, Number(text.paragraphSpacingBefore)) : 0;
    text.paragraphSpacingAfter = Number.isFinite(Number(text.paragraphSpacingAfter)) ? Math.max(0, Number(text.paragraphSpacingAfter)) : 0;
    text.firstLineIndent = Number.isFinite(Number(text.firstLineIndent)) ? Number(text.firstLineIndent) : 0;
    text.dynamicField ??= "none";
    text.numberFormat ??= "1";
    text.dynamicPrefix ??= "";
    text.dynamicSuffix ??= "";
  }
  if (element.type === "shape") {
    const shape = element as ShapeElement;
    shape.fillType ??= "color";
    shape.fillFit ??= "cover";
    shape.gradientFrom ??= shape.fill || "#ff6b45";
    shape.gradientTo ??= "#ffb36b";
    shape.gradientAngle ??= 0;
    shape.fillPosterTime ??= 0;
  }
  if (element.type === "image") {
    const image = element as ImageElement;
    image.contentPositionX ??= 50;
    image.contentPositionY ??= 50;
    image.contentScale ??= 1;
    image.mask ??= { kind: "none" };
    if (image.mask.kind === "path" && (!image.mask.points || image.mask.points.length < 3)) image.mask.points = [{x:8,y:10},{x:88,y:5},{x:96,y:54},{x:76,y:94},{x:18,y:88},{x:4,y:48}];
  }
  if (element.type === "slideshow") {
    const slideshow = element as SlideshowElement;
    slideshow.assetIds = Array.isArray(slideshow.assetIds) ? slideshow.assetIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
    slideshow.fit = slideshow.fit === "contain" ? "contain" : slideshow.fit === "fill" ? "fill" : "cover";
    slideshow.radius = Number.isFinite(Number(slideshow.radius)) ? Math.max(0, Number(slideshow.radius)) : 12;
    slideshow.borderColor ??= "transparent";
    slideshow.borderWidth = Number.isFinite(Number(slideshow.borderWidth)) ? Math.max(0, Number(slideshow.borderWidth)) : 0;
    slideshow.contentPositionX = Number.isFinite(Number(slideshow.contentPositionX)) ? Math.min(100, Math.max(0, Number(slideshow.contentPositionX))) : 50;
    slideshow.contentPositionY = Number.isFinite(Number(slideshow.contentPositionY)) ? Math.min(100, Math.max(0, Number(slideshow.contentPositionY))) : 50;
    slideshow.contentScale = Number.isFinite(Number(slideshow.contentScale)) ? Math.min(5, Math.max(0.25, Number(slideshow.contentScale))) : 1;
    slideshow.mask ??= { kind: "none" };
    if (slideshow.mask.kind === "path" && (!slideshow.mask.points || slideshow.mask.points.length < 3)) slideshow.mask.points = [{x:8,y:10},{x:88,y:5},{x:96,y:54},{x:76,y:94},{x:18,y:88},{x:4,y:48}];
    slideshow.interval = Number.isFinite(Number(slideshow.interval)) ? Math.min(120, Math.max(0.1, Number(slideshow.interval))) : 3;
    slideshow.transition = slideshow.transition === "cut" ? "cut" : "fade";
    slideshow.transitionDuration = Number.isFinite(Number(slideshow.transitionDuration)) ? Math.min(10, Math.max(0, Number(slideshow.transitionDuration))) : 0.6;
    slideshow.startMode = slideshow.startMode === "on-click" ? "on-click" : "slide-enter";
    slideshow.loop = slideshow.loop !== false;
    slideshow.clickToggle = slideshow.clickToggle !== false;
  }
  if (element.type === "pdf") {
    const pdf = element as PdfElement;
    pdf.page ??= 1;
    pdf.pageCount ??= 1;
    pdf.fit ??= "contain";
    pdf.radius ??= 0;
    pdf.borderColor ??= "transparent";
    pdf.borderWidth ??= 0;
    pdf.contentPositionX ??= 50;
    pdf.contentPositionY ??= 50;
    pdf.contentScale ??= 1;
    pdf.mask ??= { kind: "none" };
    if (pdf.mask.kind === "path" && (!pdf.mask.points || pdf.mask.points.length < 3)) pdf.mask.points = [{x:8,y:10},{x:88,y:5},{x:96,y:54},{x:76,y:94},{x:18,y:88},{x:4,y:48}];
  }
  if (element.type === "video") {
    const video = element as VideoElement;
    video.playbackMode = video.playbackMode === "scroll" ? "scroll" : "normal";
    video.controls ??= false;
    video.startTime = Number.isFinite(Number(video.startTime)) ? Math.max(0, Number(video.startTime)) : 0;
    video.endTime = Number.isFinite(Number(video.endTime)) && Number(video.endTime) > video.startTime ? Number(video.endTime) : undefined;
    video.mask ??= { kind: "none" };
    if (video.mask.kind === "path" && (!video.mask.points || video.mask.points.length < 3)) video.mask.points = [{x:8,y:10},{x:88,y:5},{x:96,y:54},{x:76,y:94},{x:18,y:88},{x:4,y:48}];
  }
  if (element.type === "model3d") {
    const model = element as Model3DElement;
    model.interaction ??= "orbit";
    model.autoRotate ??= false;
    model.autoRotateSpeed ??= 20;
    model.orbitTheta ??= 0;
    model.orbitPhi ??= 75;
    model.fieldOfView ??= 30;
    model.cameraDistance ??= 100;
    model.parallaxStrength ??= 16;
    model.scrollRotation ??= 180;
    model.exposure ??= 1;
    model.shadowIntensity ??= 1;
    model.backgroundColor ??= "#f4f2ec";
    model.transparentBackground ??= true;
    model.interactiveInEditor ??= false;
  }
  return element;
}

export function migrateProject(value: unknown): PresentationProject {
  const project = value as PresentationProject;
  if (!project || project.format !== "presentation-studio" || !Array.isArray(project.slides)) {
    throw new Error("Ez nem érvényes Pre'on projektfájl.");
  }
  project.masters ??= [];
  project.assets ??= [];
  project.textStyles ??= [];
  project.sections ??= [];
  project.name = normalizeProjectName(project.name);
  project.width = Number(project.width) || 1920;
  project.height = Number(project.height) || 1080;
  project.presentationMode ??= "slides";
  project.htmlExportMode = project.htmlExportMode === "presenter" ? "presenter" : "standard";
  project.appVersion = APP_VERSION;
  project.textStyles = project.textStyles.filter((style) => style && style.id && style.name).map((style) => ({
    ...style,
    fontFamily: style.fontFamily || "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: Number(style.fontSize) || 30,
    fontWeight: Number(style.fontWeight) || 400,
    fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
    textDecoration: style.textDecoration === "underline" ? "underline" : "none",
    strikethrough: Boolean(style.strikethrough),
    textTransform: style.textTransform === "uppercase" ? "uppercase" : "none",
    fontVariantCaps: style.fontVariantCaps === "small-caps" ? "small-caps" : "normal",
    baselineMode: style.baselineMode === "super" ? "super" : style.baselineMode === "sub" ? "sub" : "normal",
    baselineShift: Number(style.baselineShift) || 0,
    ligatures: style.ligatures !== false,
    lineHeight: Number(style.lineHeight) || 1.2,
    lineHeightAuto: style.lineHeightAuto === true,
    letterSpacing: Number.isFinite(Number(style.letterSpacing)) ? Number(style.letterSpacing) : 0,
    letterSpacingAuto: style.letterSpacingAuto === true,
    paragraphSpacingBefore: Math.max(0, Number(style.paragraphSpacingBefore) || 0),
    paragraphSpacingAfter: Math.max(0, Number(style.paragraphSpacingAfter) || 0),
    firstLineIndent: Number(style.firstLineIndent) || 0,
    color: style.color || "#17181b",
    textAlign: style.textAlign === "center" || style.textAlign === "right" || style.textAlign === "justify" ? style.textAlign : "left",
  }));

  // v0.9 szekciójelölők -> v0.10 valódi, mappaszerű szekciók.
  if (!project.sections.length && project.slides.some((slide) => Boolean(slide.sectionTitle))) {
    const sections: SlideSection[] = [];
    let currentSectionId: string | undefined;
    for (const slide of project.slides) {
      if (slide.sectionTitle) {
        currentSectionId = `section-${slide.id}`;
        sections.push({ id: currentSectionId, name: slide.sectionTitle, collapsed: Boolean(slide.sectionCollapsed) });
      }
      if (currentSectionId) slide.sectionId = currentSectionId;
      delete slide.sectionTitle;
      delete slide.sectionCollapsed;
    }
    project.sections = sections;
  }

  const validSectionIds = new Set(project.sections.map((section) => section.id));
  project.slides.forEach((slide) => {
    slide.hidden ??= false;
    slide.guides ??= { vertical: [], horizontal: [] };
    slide.grid = { ...defaultGrid(), ...(slide.grid ?? {}) };
    slide.inheritMasterGrid ??= true;
    slide.elements ??= [];
    slide.elements.forEach(migrateElement);
    slide.notes ??= "";
    slide.notesHtml = sanitizeRichNoteHtml(slide.notesHtml?.trim() ? slide.notesHtml : plainTextToNoteHtml(slide.notes));
    if (!slide.notes.trim() && slide.notesHtml) slide.notes = noteHtmlToPlainText(slide.notesHtml);
    const hadNotesBoard = Boolean(slide.notesBoard);
    slide.notesBoard ??= defaultNotesBoard();
    const board = slide.notesBoard;
    board.name ||= "Előadói jegyzet";
    board.background = { ...defaultNotesBoard().background, ...(board.background ?? {}) };
    // v0.22.2: the old note-paper color was too close to common slide backgrounds.
    // Only migrate the exact legacy default; user-selected colors are preserved.
    if (board.background.color === "#f7f4ec") board.background.color = "#e9efe6";
    board.guides ??= { vertical: [], horizontal: [] };
    board.grid = { ...defaultGrid(), ...(board.grid ?? {}) };
    board.elements ??= [];

    // v0.22.1: notes have two deliberately different workflows. A lightweight Text Note
    // stays a scrollable document; a Visual Note keeps the free canvas. Old v0.22 boards
    // with only one text box migrate to Text Note so long notes no longer feel like a second slide.
    if (board.mode !== "text" && board.mode !== "visual") {
      const visible = board.elements.filter((element) => element.visible !== false);
      const textOnly = visible.length <= 1 && visible.every((element) => element.type === "text");
      board.mode = !hadNotesBoard || visible.length === 0 || textOnly ? "text" : "visual";
      if (board.mode === "text" && !slide.notes.trim()) {
        const legacyText = visible.length === 1 && visible[0].type === "text" ? visible[0].text : "";
        if (legacyText.trim()) slide.notes = legacyText;
      }
    }
    const defaultWidth = board.mode === "visual" && hadNotesBoard ? project.width : 900;
    const defaultHeight = board.mode === "visual" && hadNotesBoard ? project.height : 1200;
    board.width = Number.isFinite(Number(board.width)) ? Math.min(2400, Math.max(420, Number(board.width))) : defaultWidth;
    board.height = Number.isFinite(Number(board.height)) ? Math.min(3200, Math.max(480, Number(board.height))) : defaultHeight;
    if (board.mode === "text" && !slide.notes.trim() && board.elements.length === 1 && board.elements[0].type === "text") {
      if (board.elements[0].text.trim()) slide.notes = board.elements[0].text;
    }
    if (board.elements.length === 0) {
      const starter = defaultNotesTextElement();
      starter.width = Math.max(240, board.width - 144);
      starter.height = Math.max(240, board.height - 144);
      board.elements.push(starter);
    }
    board.elements.forEach(migrateElement);
    if (!slide.notesHtml?.trim() && slide.notes.trim()) slide.notesHtml = plainTextToNoteHtml(slide.notes);
    slide.transition ??= "fade";
    slide.longformHeightScale ??= 1;
    slide.longformSticky ??= false;
    if (slide.sectionId && !validSectionIds.has(slide.sectionId)) slide.sectionId = undefined;
  });
  project.masters.forEach((master) => {
    master.parentMasterId ??= null;
    master.inheritParentGrid ??= true;
    master.guides ??= { vertical: [], horizontal: [] };
    master.grid = { ...defaultGrid(), ...(master.grid ?? {}) };
    master.elements ??= [];
    master.elements.forEach(migrateElement);
  });
  return project;
}
