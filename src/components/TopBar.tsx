import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, type AlignMode, type AlignReference } from "../EditorContext";
import { tr } from "../i18n";
import { toolbarById } from "../toolbarRegistry";
import type { ShapeKind, ToolId } from "../types";
import { Icon, type IconName } from "./Icon";
import preonLogo from "../assets/preon-logo.svg";
import { APP_EDITION, APP_VERSION } from "../utils";

interface TopBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onFontCheck: () => void;
  onExportPdf: () => void;
  onShareLan: () => void;
  onAddMedia: (kind: "image" | "video" | "model" | "any") => void;
  onAddSlideshow: () => void;
  onAddSlideNumber: () => void;
  onAddWeb: () => void;
  onAddHtmlApp: () => void;
  onPresent: () => void;
  onWorkspace: () => void;
  onAbout: () => void;
  onEyedropperColor: () => void;
  onEyedropperFormat: () => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  canPasteStyle: boolean;
}

function Dropdown({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const listener = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", listener);
    return () => window.removeEventListener("pointerdown", listener);
  }, [onClose]);
  return <div ref={ref} className="dropdown-menu">{children}</div>;
}

export function TopBar({
  onNew, onOpen, onSave, onSaveAs, onExportHtml, onFontCheck, onExportPdf, onShareLan,
  onAddMedia, onAddSlideshow, onAddSlideNumber, onAddWeb, onAddHtmlApp, onPresent, onWorkspace, onAbout,
  onEyedropperColor, onEyedropperFormat, onCopyStyle, onPasteStyle, canPasteStyle,
}: TopBarProps) {
  const {
    state, setTool, setZoom, updateWorkspace, updateProject, setEditingNotesBoard, undo, redo, duplicateSelection, deleteSelection,
    groupSelection, ungroupSelection, alignSelection,
  } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [openMenu, setOpenMenu] = useState<"file" | "edit" | "view" | "presentation" | "align" | "shape" | "eyedropper" | null>(null);
  const nativeMacMenuActive = false;
  const [alignReference, setAlignReference] = useState<AlignReference>("selection");
  useEffect(() => setAlignReference(state.selection.length === 1 ? "slide" : "selection"), [state.selection.length]);

  const startWindowDrag = () => {
    // Browser edition: dragging the native app window does not apply.
  };

  const shapeDefinitions: Array<{ kind: ShapeKind; label: string; icon: IconName }> = [
    { kind: "rect", label: "Téglalap", icon: "rect" },
    { kind: "rounded-rect", label: "Lekerekített téglalap", icon: "roundedRect" },
    { kind: "ellipse", label: "Kör / ellipszis", icon: "ellipse" },
    { kind: "triangle", label: "Háromszög", icon: "triangle" },
    { kind: "star", label: "Csillag", icon: "star" },
    { kind: "polygon", label: "Sokszög", icon: "polygon" },
    { kind: "line", label: "Vonal", icon: "line" },
    { kind: "arrow", label: "Nyíl", icon: "arrow" },
  ];
  const currentShape = shapeDefinitions.find((shape) => shape.kind === state.workspace.selectedShape) ?? shapeDefinitions[0];
  const shapeToolActive = shapeDefinitions.some((shape) => shape.kind === state.tool);

  const executeAlign = (mode: AlignMode) => {
    alignSelection(mode, mode.startsWith("distribute-") ? "selection" : alignReference);
    setOpenMenu(null);
  };

  const toolButton = (id: string, index: number) => {
    if (id === "separator") return <span key={`separator-${index}`} className="toolbar-separator" />;
    if (id === "shape") {
      return (
        <div className="toolbar-button-wrap shape-tool-wrap" key={`shape-${index}`}>
          <div className={`shape-tool-split ${shapeToolActive ? "active" : ""}`}>
            <button
              className="shape-tool-main"
              onClick={() => setTool(currentShape.kind)}
              title={t(currentShape.label)}
            ><Icon name={currentShape.icon} /></button>
            <button
              className="shape-tool-caret"
              onClick={() => setOpenMenu(openMenu === "shape" ? null : "shape")}
              title={t("Alakzat kiválasztása")}
            ><span>▾</span></button>
          </div>
          {openMenu === "shape" && (
            <Dropdown onClose={() => setOpenMenu(null)}>
              <div className="shape-dropdown-grid">
                {shapeDefinitions.map((shape) => (
                  <button
                    key={shape.kind}
                    className={state.workspace.selectedShape === shape.kind ? "active" : ""}
                    onClick={() => {
                      updateWorkspace({ selectedShape: shape.kind });
                      setTool(shape.kind);
                      setOpenMenu(null);
                    }}
                    title={t(shape.label)}
                  >
                    <Icon name={shape.icon} size={19} />
                    <span>{t(shape.label)}</span>
                  </button>
                ))}
              </div>
            </Dropdown>
          )}
        </div>
      );
    }
    const definition = toolbarById.get(id);
    if (!definition) return null;
    const toolIds: ToolId[] = ["select", "hand", "text", "imageFrame"];
    const isTool = toolIds.includes(id as ToolId);
    const disabled =
      (id === "undo" && state.historyPast.length === 0) ||
      (id === "redo" && state.historyFuture.length === 0) ||
      (["duplicate", "delete", "group", "align"].includes(id) && state.selection.length === 0);
    const action = () => {
      if (isTool) setTool(id as ToolId);
      if (id === "image") onAddMedia("image");
      if (id === "slideshow") onAddSlideshow();
      if (id === "video") onAddMedia("video");
      if (id === "model3d") onAddMedia("model");
      if (id === "slideNumber") onAddSlideNumber();
      if (id === "web") onAddWeb();
      if (id === "undo") undo();
      if (id === "redo") redo();
      if (id === "duplicate") duplicateSelection();
      if (id === "delete") deleteSelection();
      if (id === "group") {
        const active = state.project.slides.find((slide) => slide.id === state.activeSlideId);
        const elements = state.editingMasterId
          ? state.project.masters.find((master) => master.id === state.editingMasterId)?.elements ?? []
          : active?.elements ?? [];
        const selected = elements.filter((element) => state.selection.includes(element.id));
        if (selected.some((element) => element.groupId)) ungroupSelection(); else groupSelection();
      }
      if (id === "align") setOpenMenu(openMenu === "align" ? null : "align");
    };
    return (
      <div className="toolbar-button-wrap" key={`${id}-${index}`}>
        <button className={`icon-tool-button ${isTool && state.tool === id ? "active" : ""}`} onClick={action} disabled={disabled} title={t(definition.label)}>
          {definition.icon && <Icon name={definition.icon} />}{id === "align" && <span className="tiny-caret">▾</span>}
        </button>
        {id === "align" && openMenu === "align" && (
          <Dropdown onClose={() => setOpenMenu(null)}>
            <div className="align-reference-menu">
              <span>{t("Igazítás ehhez")}</span>
              <div className="segmented-control">
                <button type="button" className={alignReference === "selection" ? "active" : ""} disabled={state.selection.length < 2} onClick={() => setAlignReference("selection")}>{t("Kijelölés")}</button>
                <button type="button" className={alignReference === "slide" ? "active" : ""} onClick={() => setAlignReference("slide")}>{t("Dia")}</button>
              </div>
            </div>
            <div className="align-dropdown-grid">
              <button disabled={alignReference === "selection" && state.selection.length < 2} onClick={() => executeAlign("left")} title={t("Balra")}><Icon name="alignLeft" /></button>
              <button disabled={alignReference === "selection" && state.selection.length < 2} onClick={() => executeAlign("center")} title={t("Középre")}><Icon name="alignCenter" /></button>
              <button disabled={alignReference === "selection" && state.selection.length < 2} onClick={() => executeAlign("right")} title={t("Jobbra")}><Icon name="alignRight" /></button>
              <button disabled={alignReference === "selection" && state.selection.length < 2} onClick={() => executeAlign("top")} title={t("Felülre")}><Icon name="alignTop" /></button>
              <button disabled={alignReference === "selection" && state.selection.length < 2} onClick={() => executeAlign("middle")} title={t("Függőlegesen középre")}><Icon name="alignMiddle" /></button>
              <button disabled={alignReference === "selection" && state.selection.length < 2} onClick={() => executeAlign("bottom")} title={t("Alulra")}><Icon name="alignBottom" /></button>
              <button disabled={state.selection.length < 3} onClick={() => executeAlign("distribute-horizontal")} title={t("Vízszintes elosztás")}><Icon name="distributeH" /></button>
              <button disabled={state.selection.length < 3} onClick={() => executeAlign("distribute-vertical")} title={t("Függőleges elosztás")}><Icon name="distributeV" /></button>
            </div>
          </Dropdown>
        )}
      </div>
    );
  };

  return (
    <header className="top-bar" data-tauri-drag-region onPointerDown={startWindowDrag}>
      <button className="app-identity app-identity-button" onClick={onAbout} title={t("Névjegy")}>
        <div className="app-mark"><img src={preonLogo} alt="" /></div>
        <div className="document-title"><strong>{state.project.name}{state.dirty ? " •" : ""}</strong><span>Pre'on {APP_VERSION} · {APP_EDITION}</span></div>
      </button>

      {!nativeMacMenuActive && <nav className="menu-strip">
        <div className="menu-button-wrap">
          <button onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}>{t("Fájl")}</button>
          {openMenu === "file" && <Dropdown onClose={() => setOpenMenu(null)}>
            <button onClick={() => { onNew(); setOpenMenu(null); }}><Icon name="new" />{t("Új projekt")}<span>⌘N</span></button>
            <button onClick={() => { onOpen(); setOpenMenu(null); }}><Icon name="open" />{t("Megnyitás")}<span>⌘O</span></button><hr />
            <button onClick={() => { onSave(); setOpenMenu(null); }}><Icon name="save" />{t("Mentés")}<span>⌘S</span></button>
            <button onClick={() => { onSaveAs(); setOpenMenu(null); }}><Icon name="copy" />{t("Mentés másként")}<span>⇧⌘S</span></button><hr />
            <button onClick={() => { onAddMedia("any"); setOpenMenu(null); }}><Icon name="pdf" />{t("Média / PDF importálása")}</button>
            <button onClick={() => { onAddSlideshow(); setOpenMenu(null); }}><Icon name="slideshow" />{t("Slideshow létrehozása")}</button>
            <button onClick={() => { onFontCheck(); setOpenMenu(null); }}><Icon name="text" />Font Check</button>
            <button onClick={() => { onExportHtml(); setOpenMenu(null); }}><Icon name="export" />{t("HTML csomag export")}<span>⇧⌘E</span></button>
            <button onClick={() => { onExportPdf(); setOpenMenu(null); }}><Icon name="print" />{t("PDF export · slide méret")}</button>
          </Dropdown>}
        </div>
        <div className="menu-button-wrap">
          <button onClick={() => setOpenMenu(openMenu === "edit" ? null : "edit")}>{t("Szerkesztés")}</button>
          {openMenu === "edit" && <Dropdown onClose={() => setOpenMenu(null)}>
            <button onClick={() => { undo(); setOpenMenu(null); }} disabled={!state.historyPast.length}><Icon name="undo" />{t("Visszavonás")}<span>⌘Z</span></button>
            <button onClick={() => { redo(); setOpenMenu(null); }} disabled={!state.historyFuture.length}><Icon name="redo" />{t("Újra")}<span>⇧⌘Z</span></button><hr />
            <button onClick={() => { duplicateSelection(); setOpenMenu(null); }} disabled={!state.selection.length}><Icon name="duplicate" />{t("Duplikálás")}<span>⌘D</span></button>
            <button onClick={() => { deleteSelection(); setOpenMenu(null); }} disabled={!state.selection.length}><Icon name="delete" />{t("Törlés")}<span>⌫</span></button>
            <hr />
            <button onClick={() => { onCopyStyle(); setOpenMenu(null); }} disabled={!state.selection.length}><Icon name="copy" />{t("Stílus másolása")}<span>⌥⌘C</span></button>
            <button onClick={() => { onPasteStyle(); setOpenMenu(null); }} disabled={!state.selection.length || !canPasteStyle}><Icon name="copy" />{t("Stílus beillesztése")}<span>⌥⌘V</span></button>
            <hr />
            <button onClick={() => { onEyedropperColor(); setOpenMenu(null); }} disabled={!state.selection.length}><Icon name="eyedropper" />{t("Színpipetta")}</button>
            <button onClick={() => { onEyedropperFormat(); setOpenMenu(null); }} disabled={!state.selection.length}><Icon name="text" />{t("Formázáspipetta")}</button>
          </Dropdown>}
        </div>
        <div className="menu-button-wrap">
          <button onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}>{t("Nézet")}</button>
          {openMenu === "view" && <Dropdown onClose={() => setOpenMenu(null)}>
            <button onClick={() => updateWorkspace({ leftVisible: !state.workspace.leftVisible })}><Icon name={state.workspace.leftVisible ? "panelLeftClose" : "panelLeftOpen"} />{t("Bal panel")}</button>
            <button onClick={() => updateWorkspace({ rightVisible: !state.workspace.rightVisible })}><Icon name={state.workspace.rightVisible ? "panelRightClose" : "panelRightOpen"} />{t("Jobb panel")}</button><hr />
            <button onClick={() => { updateProject((project) => { project.presentationMode = "slides"; }); updateWorkspace({ canvasView: "single" }); }}><Icon name="singleView" />{t("Egy dia")}{state.project.presentationMode === "slides" && state.workspace.canvasView === "single" && <Icon name="check" size={14} />}</button>
            <button onClick={() => { updateProject((project) => { project.presentationMode = "slides"; }); updateWorkspace({ canvasView: "continuous" }); }}><Icon name="continuousView" />{t("Folyamatos nézet")}{state.project.presentationMode === "slides" && state.workspace.canvasView === "continuous" && <Icon name="check" size={14} />}</button>
            <button onClick={() => { setEditingNotesBoard(false); updateProject((project) => { project.presentationMode = "longform"; }); }}><Icon name="oneSlide" />{t("One Slide / Longform")}{state.project.presentationMode === "longform" && <Icon name="check" size={14} />}</button>
            <button onClick={() => { const next = !state.workspace.showNotesBoard; updateWorkspace({ showNotesBoard: next }); if (!next) setEditingNotesBoard(false); }}><Icon name="notes" />{t("Előadói jegyzetlap")}{state.workspace.showNotesBoard && <Icon name="check" size={14} />}</button>
            <button onClick={() => updateWorkspace({ trimView: !state.workspace.trimView })}><Icon name="trimView" />{t("Trim View")}{state.workspace.trimView && <Icon name="check" size={14} />}</button><hr />
            <button onClick={() => updateWorkspace({ showRulers: !state.workspace.showRulers })}><Icon name="ruler" />{t("Vonalzók")}{state.workspace.showRulers && <Icon name="check" size={14} />}</button>
            <button onClick={() => updateWorkspace({ showGuides: !state.workspace.showGuides })}><Icon name="ruler" />{t("Segédvonalak")}{state.workspace.showGuides && <Icon name="check" size={14} />}</button>
            <button onClick={() => updateWorkspace({ showGrid: !state.workspace.showGrid })}><Icon name="grid" />Grid{state.workspace.showGrid && <Icon name="check" size={14} />}</button>
            <button onClick={() => updateWorkspace({ snapEnabled: !state.workspace.snapEnabled })}><Icon name="snap" />{t("Tapadás")}{state.workspace.snapEnabled && <Icon name="check" size={14} />}</button><hr />
            <button onClick={() => window.dispatchEvent(new Event("ps-fit-canvas"))}><Icon name="fit" />{t("Vászon illesztése")}<span>1</span></button>
          </Dropdown>}
        </div>
        <div className="menu-button-wrap">
          <button onClick={() => setOpenMenu(openMenu === "presentation" ? null : "presentation")}>{t("Prezentáció")}</button>
          {openMenu === "presentation" && <Dropdown onClose={() => setOpenMenu(null)}>
            <div className="dropdown-section-label">{t("HTML export")}</div>
            <button onClick={() => updateProject((project) => { project.htmlExportMode = "standard"; })}><Icon name="web" />{t("Standard HTML")}{(state.project.htmlExportMode ?? "standard") === "standard" && <Icon name="check" size={14} />}</button>
            <button onClick={() => updateProject((project) => { project.htmlExportMode = "presenter"; })}><Icon name="notes" />{t("HTML + Presenter")}{state.project.htmlExportMode === "presenter" && <Icon name="check" size={14} />}</button>
            <div className="dropdown-menu-hint">{state.project.htmlExportMode === "presenter" ? t("A presenter.html és az előadói jegyzetek is bekerülnek.") : t("Csak a tiszta közönség-prezentáció készül el.")}</div>
            <hr />
            <button onClick={() => { onExportHtml(); setOpenMenu(null); }}><Icon name="export" />{t("HTML exportálása")}</button>
          </Dropdown>}
        </div>
      </nav>}

      <div className="main-toolbar">
        {state.workspace.toolbarItems.map(toolButton)}
        <span className="toolbar-separator" />
        <div className="toolbar-button-wrap eyedropper-tool-wrap">
          <div className={`shape-tool-split ${state.tool === "eyedropperColor" || state.tool === "eyedropperFormat" ? "active" : ""}`}>
            <button className="shape-tool-main" onClick={onEyedropperColor} disabled={!state.selection.length} title={t("Színpipetta")}><Icon name="eyedropper" /></button>
            <button className="shape-tool-caret" onClick={() => setOpenMenu(openMenu === "eyedropper" ? null : "eyedropper")} disabled={!state.selection.length} title={t("Pipetta mód")}><span>▾</span></button>
          </div>
          {openMenu === "eyedropper" && (
            <Dropdown onClose={() => setOpenMenu(null)}>
              <button onClick={() => { onEyedropperColor(); setOpenMenu(null); }}><Icon name="eyedropper" />{t("Színpipetta")}</button>
              <button onClick={() => { onEyedropperFormat(); setOpenMenu(null); }}><Icon name="text" />{t("Formázáspipetta")}</button>
            </Dropdown>
          )}
        </div>
      </div>

      <div className="top-actions">
        <button
          className={`icon-tool-button ${state.project.presentationMode === "longform" || state.workspace.canvasView === "continuous" ? "active" : ""}`}
          onClick={() => {
            if (state.project.presentationMode === "longform") {
              updateProject((project) => { project.presentationMode = "slides"; });
              return;
            }
            updateWorkspace({ canvasView: state.workspace.canvasView === "continuous" ? "single" : "continuous" });
          }}
          title={t(state.project.presentationMode === "longform" ? "Kilépés a One Slide nézetből" : state.workspace.canvasView === "continuous" ? "Egy dia" : "Folyamatos nézet")}
        ><Icon name={state.project.presentationMode === "longform" ? "oneSlide" : state.workspace.canvasView === "continuous" ? "continuousView" : "singleView"} /></button>
        <button className={`icon-tool-button ${state.workspace.trimView ? "active" : ""}`} onClick={() => updateWorkspace({ trimView: !state.workspace.trimView })} title={t("Trim View")}><Icon name="trimView" /></button>
        <div className="zoom-control">
          <button onClick={() => setZoom(state.zoom / 1.15)} title="−"><Icon name="zoomOut" size={15} /></button>
          <button className="zoom-value" onClick={() => window.dispatchEvent(new Event("ps-fit-canvas"))}>{Math.round(state.zoom * 100)}%</button>
          <button onClick={() => setZoom(state.zoom * 1.15)} title="+"><Icon name="zoomIn" size={15} /></button>
        </div>
        <button className="icon-tool-button" onClick={onWorkspace} title="Workspace"><Icon name="settings" /></button>
        <button className="secondary-top-button" onClick={onExportHtml}><Icon name="export" />{t("Export")}</button>
        <button className="present-button" onClick={onPresent}><Icon name="play" />{t("Prezentálás")}</button>
      </div>
    </header>
  );
}
