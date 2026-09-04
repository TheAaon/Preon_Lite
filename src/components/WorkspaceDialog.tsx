import { useState } from "react";
import { useEditor } from "../EditorContext";
import { defaultWorkspace } from "../defaultProject";
import { tr } from "../i18n";
import { toolbarById, toolbarDefinitions } from "../toolbarRegistry";
import { contextMenuDefinitions, contextMenuProfileLabels, defaultContextMenuItems } from "../contextMenuRegistry";
import type { ContextMenuProfile } from "../types";
import { deepClone } from "../utils";
import { Icon } from "./Icon";

export function WorkspaceDialog({ onClose, onExport, onImport }: { onClose: () => void; onExport: () => void; onImport: () => void; }) {
  const { state, updateWorkspace, replaceWorkspace, resetWorkspace } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const items = state.workspace.toolbarItems;
  const [tab, setTab] = useState<"general" | "toolbar" | "context">("general");
  const [contextProfile, setContextProfile] = useState<ContextMenuProfile>("text");

  const moveItem = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateWorkspace({ toolbarItems: next });
  };
  const removeItem = (index: number) => updateWorkspace({ toolbarItems: items.filter((_, i) => i !== index) });
  const addItem = (id: string) => {
    if (id !== "separator" && items.includes(id)) return;
    updateWorkspace({ toolbarItems: [...items, id] });
  };
  const withPrefs = (workspace: typeof defaultWorkspace) => ({
    ...workspace,
    theme: state.workspace.theme,
    darkBrightness: state.workspace.darkBrightness,
    lightBrightness: 50,
    language: state.workspace.language,
    canvasView: state.workspace.canvasView,
    trimView: state.workspace.trimView,
    recentFonts: state.workspace.recentFonts,
    favoriteFonts: state.workspace.favoriteFonts,
    selectedShape: state.workspace.selectedShape,
    contextMenuItems: deepClone(state.workspace.contextMenuItems),
  });
  const applyPreset = (preset: "presentation" | "minimal" | "media") => {
    if (preset === "presentation") replaceWorkspace(withPrefs(deepClone(defaultWorkspace)));
    else if (preset === "minimal") replaceWorkspace(withPrefs({ ...deepClone(defaultWorkspace), name: "Minimal", leftVisible: false, rightVisible: false, toolbarItems: ["select", "hand", "text", "shape", "imageFrame", "image", "video", "model3d", "web", "separator", "undo", "redo"] }));
    else replaceWorkspace(withPrefs({ ...deepClone(defaultWorkspace), name: "Media", rightTab: "properties", toolbarItems: ["select", "hand", "text", "shape", "imageFrame", "image", "video", "model3d", "web", "separator", "duplicate", "delete", "align"] }));
  };

  const contextItems = state.workspace.contextMenuItems[contextProfile] ?? [];
  const updateContextProfile = (next: string[]) => updateWorkspace({
    contextMenuItems: { ...state.workspace.contextMenuItems, [contextProfile]: next },
  });
  const moveContextItem = (index: number, delta: number) => {
    const next = [...contextItems];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateContextProfile(next);
  };
  const removeContextItem = (index: number) => updateContextProfile(contextItems.filter((_, i) => i !== index));
  const addContextItem = (id: string) => {
    if (id !== "separator" && contextItems.includes(id)) return;
    updateContextProfile([...contextItems, id]);
  };
  const resetContextProfile = () => updateContextProfile([...defaultContextMenuItems[contextProfile]]);
  const resetAllContextMenus = () => updateWorkspace({ contextMenuItems: deepClone(defaultContextMenuItems) });

  return <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal workspace-dialog">
    <header className="modal-header"><div><Icon name="settings"/><div><strong>{t("Workspace személyre szabása")}</strong><span>{t("Panelek, vonalzók, ikonsor és jobb klikk menü")}</span></div></div><button className="icon-only" onClick={onClose}><Icon name="close"/></button></header>

    <div className="workspace-dialog-tabs" role="tablist">
      <button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}>{t("Általános")}</button>
      <button className={tab === "toolbar" ? "active" : ""} onClick={() => setTab("toolbar")}>{t("Ikonsor")}</button>
      <button className={tab === "context" ? "active" : ""} onClick={() => setTab("context")}>{t("Jobb klikk")}</button>
    </div>

    <div className="workspace-dialog-body">
      {tab === "general" && <>
        <div className="workspace-presets">
          <button onClick={() => applyPreset("presentation")}><Icon name="app"/><span><strong>Presentation</strong><small>{t("Teljes szerkesztő")}</small></span></button>
          <button onClick={() => applyPreset("minimal")}><Icon name="panelLeftClose"/><span><strong>Minimal</strong><small>{t("Tiszta vászon")}</small></span></button>
          <button onClick={() => applyPreset("media")}><Icon name="video"/><span><strong>Media</strong><small>{t("Videó és web")}</small></span></button>
        </div>
        <section className="workspace-single-section">
          <h3>{t("Panelek és segédek")}</h3>
          <div className="workspace-appearance-row workspace-theme-mode-row">
            <span>{t("Megjelenés")}</span>
            <div className="segmented-control theme-mode-control">
              <button className={state.workspace.theme === "light" ? "active" : ""} onClick={() => updateWorkspace({ theme: "light" })}><Icon name="sun" size={13}/>{t("Világos")}</button>
              <button className={state.workspace.theme === "dark" ? "active" : ""} onClick={() => updateWorkspace({ theme: "dark" })}><Icon name="moon" size={13}/>{t("Sötét")}</button>
              <button className={state.workspace.theme === "system" ? "active" : ""} onClick={() => updateWorkspace({ theme: "system" })}><Icon name="app" size={13}/>{t("Automatikus")}</button>
            </div>
          </div>
          <div className="workspace-range workspace-theme-brightness">
            <span>{t("Sötét mód világossága")}</span>
            <input type="range" min={0} max={100} step={1} value={state.workspace.darkBrightness} onChange={(event) => updateWorkspace({ darkBrightness: Number(event.currentTarget.value) })}/>
            <em>{state.workspace.darkBrightness}%</em>
            <button type="button" className="icon-only theme-reset-button" title={t("Alapérték visszaállítása")} onClick={() => updateWorkspace({ darkBrightness: 50 })}><Icon name="reset" size={13}/></button>
          </div>
          <div className="inline-hint workspace-theme-hint">{t("Az Automatikus mód a macOS / Windows rendszer témáját követi. A világos mód fix Pre'on palettát használ, a sötét mód világossága külön állítható.")}</div>
          <div className="workspace-appearance-row"><span>{t("Nyelv")}</span><div className="segmented-control"><button className={state.workspace.language === "hu" ? "active" : ""} onClick={() => updateWorkspace({ language: "hu" })}>{t("Magyar")}</button><button className={state.workspace.language === "en" ? "active" : ""} onClick={() => updateWorkspace({ language: "en" })}>{t("Angol")}</button></div></div>
          <div className="workspace-appearance-row"><span>{t("Nézet")}</span><div className="segmented-control"><button className={state.workspace.canvasView === "single" ? "active" : ""} onClick={() => updateWorkspace({ canvasView: "single" })}>{t("Egy dia")}</button><button className={state.workspace.canvasView === "continuous" ? "active" : ""} onClick={() => updateWorkspace({ canvasView: "continuous" })}>{t("Folyamatos nézet")}</button></div></div>
          <div className="workspace-check-grid">
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.trimView} onChange={(event) => updateWorkspace({ trimView: event.currentTarget.checked })}/><span>{t("Trim View")}</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.leftVisible} onChange={(event) => updateWorkspace({ leftVisible: event.currentTarget.checked })}/><span>{t("Bal oldali Dia/Mester panel")}</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.rightVisible} onChange={(event) => updateWorkspace({ rightVisible: event.currentTarget.checked })}/><span>{t("Jobb oldali Tulajdonság/Réteg panel")}</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.showRulers} onChange={(event) => updateWorkspace({ showRulers: event.currentTarget.checked })}/><span>{t("Vonalzók")}</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.showGuides} onChange={(event) => updateWorkspace({ showGuides: event.currentTarget.checked })}/><span>{t("Segédvonalak")}</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.showGrid} onChange={(event) => updateWorkspace({ showGrid: event.currentTarget.checked })}/><span>Layout grid</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.smartGuides} onChange={(event) => updateWorkspace({ smartGuides: event.currentTarget.checked })}/><span>Smart Guides</span></label>
            <label className="workspace-check"><input type="checkbox" checked={state.workspace.snapEnabled} onChange={(event) => updateWorkspace({ snapEnabled: event.currentTarget.checked })}/><span>{t("Tapadás")}</span></label>
          </div>
          <div className="workspace-range"><span>{t("Bal panel szélessége")}</span><input type="range" min={210} max={420} value={state.workspace.leftWidth} onChange={(event) => updateWorkspace({ leftWidth: Number(event.currentTarget.value) })}/><em>{state.workspace.leftWidth}px</em></div>
          <div className="workspace-range"><span>{t("Jobb panel szélessége")}</span><input type="range" min={280} max={520} value={state.workspace.rightWidth} onChange={(event) => updateWorkspace({ rightWidth: Number(event.currentTarget.value) })}/><em>{state.workspace.rightWidth}px</em></div>
        </section>
      </>}

      {tab === "toolbar" && <section className="workspace-single-section">
        <h3>{t("Aktív ikonsor")}</h3>
        <div className="toolbar-custom-list">{items.map((id, index) => { const definition = toolbarById.get(id); return <div key={`${id}-${index}`} className={id === "separator" ? "toolbar-custom-item separator-item" : "toolbar-custom-item"}><span className="drag-placeholder">⋮⋮</span>{definition?.icon ? <Icon name={definition.icon}/> : <span className="separator-preview"/>}<span>{definition ? t(definition.label) : t("Elválasztó")}</span><button onClick={() => moveItem(index, -1)} disabled={index === 0} title="↑"><Icon name="chevronLeft" size={14}/></button><button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} title="↓"><Icon name="chevronRight" size={14}/></button><button onClick={() => removeItem(index)} title="×"><Icon name="close" size={14}/></button></div>; })}</div>
        <h3 className="available-heading">{t("Hozzáadható gombok")}</h3>
        <div className="toolbar-available-grid">{toolbarDefinitions.filter((definition) => !items.includes(definition.id)).map((definition) => <button key={definition.id} onClick={() => addItem(definition.id)}>{definition.icon && <Icon name={definition.icon}/>}<span>{t(definition.label)}</span><Icon name="plus" size={14}/></button>)}<button onClick={() => addItem("separator")}><span className="separator-preview"/><span>{t("Elválasztó")}</span><Icon name="plus" size={14}/></button></div>
      </section>}

      {tab === "context" && <section className="workspace-single-section context-menu-settings">
        <div className="context-settings-heading"><div><h3>{t("Jobb klikk menü")}</h3><p>{t("Külön állítsd be, mi jelenjen meg az egyes helyzetekben. A nem értelmezhető parancsokat a menü automatikusan elrejti.")}</p></div><button className="secondary-button" onClick={resetAllContextMenus}><Icon name="reset" size={14}/>{t("Minden alaphelyzetbe")}</button></div>
        <div className="context-profile-tabs">{(Object.keys(contextMenuProfileLabels) as ContextMenuProfile[]).map((profile) => <button key={profile} className={contextProfile === profile ? "active" : ""} onClick={() => setContextProfile(profile)}>{t(contextMenuProfileLabels[profile])}</button>)}</div>
        <div className="context-editor-grid">
          <div>
            <div className="context-column-title"><strong>{t("Aktív menü")}</strong><button className="secondary-button compact" onClick={resetContextProfile}>{t("Alapérték")}</button></div>
            <div className="context-custom-list">{contextItems.map((id, index) => {
              const definition = id === "separator" ? null : contextMenuDefinitions.find((item) => item.id === id);
              return <div key={`${id}-${index}`} className={`context-custom-item ${id === "separator" ? "separator-item" : ""}`}>
                <span className="drag-placeholder">⋮⋮</span><span>{id === "separator" ? t("Elválasztó") : t(definition?.label ?? id)}</span>
                {definition?.children?.length ? <small>{t("Almenü")}</small> : <small/>}
                <button onClick={() => moveContextItem(index, -1)} disabled={index === 0} title="↑"><Icon name="chevronLeft" size={14}/></button>
                <button onClick={() => moveContextItem(index, 1)} disabled={index === contextItems.length - 1} title="↓"><Icon name="chevronRight" size={14}/></button>
                <button onClick={() => removeContextItem(index)} title="×"><Icon name="close" size={14}/></button>
              </div>;
            })}</div>
          </div>
          <div>
            <div className="context-column-title"><strong>{t("Hozzáadható parancsok")}</strong><span>{t("Minden szerkesztőparancs")}</span></div>
            <div className="context-command-library">
              {contextMenuDefinitions.filter((definition) => !contextItems.includes(definition.id)).map((definition) => <button key={definition.id} onClick={() => addContextItem(definition.id)}><span>{t(definition.label)}</span>{definition.children?.length ? <small>{t("Almenü")}</small> : definition.shortcut ? <small>{definition.shortcut}</small> : null}<Icon name="plus" size={13}/></button>)}
              <button onClick={() => addContextItem("separator")}><span>{t("Elválasztó")}</span><small/><Icon name="plus" size={13}/></button>
            </div>
          </div>
        </div>
      </section>}
    </div>

    <footer className="modal-footer"><div><button className="secondary-button" onClick={onImport}><Icon name="import" size={15}/> {t("Import workspace")}</button><button className="secondary-button" onClick={onExport}><Icon name="export" size={15}/> {t("Export workspace")}</button></div><div><button className="secondary-button" onClick={resetWorkspace}><Icon name="reset" size={15}/> {t("Alaphelyzet")}</button><button className="primary-button" onClick={onClose}>{t("Kész")}</button></div></footer>
  </div></div>;
}
