import { useMemo, useState } from "react";
import { useEditor } from "../EditorContext";
import type { AssetRecord, PresentationProject, SlideElement } from "../types";
import { assetUrl } from "../utils";
import { deleteImportedAsset } from "../platform";
import { releasePdfAsset } from "../pdfSupport";
import { Icon, type IconName } from "./Icon";
import { tr } from "../i18n";

function assetIcon(asset: AssetRecord): IconName {
  if (["image", "svg", "gif"].includes(asset.kind)) return "image";
  if (asset.kind === "video") return "video";
  if (asset.kind === "pdf") return "pdf";
  if (asset.kind === "model3d") return "model3d";
  return "web";
}


function assetUsageMap(project: PresentationProject): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (assetId?: string) => {
    if (!assetId) return;
    counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
  };
  const scanElement = (element: SlideElement) => {
    if ("assetId" in element) add(element.assetId);
    if (element.type === "slideshow") element.assetIds.forEach(add);
    if (element.type === "shape") add(element.fillAssetId);
    if (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") add(element.mask?.assetId);
  };
  project.slides.forEach((slide) => {
    add(slide.background.assetId);
    slide.elements.forEach(scanElement);
    if (slide.notesBoard) {
      add(slide.notesBoard.background.assetId);
      slide.notesBoard.elements.forEach(scanElement);
    }
  });
  project.masters.forEach((master) => {
    add(master.background.assetId);
    master.elements.forEach(scanElement);
  });
  return counts;
}
export function AssetsPanel({ onUseAsset, onImportAssets, onImportPdfAsSlides }: { onUseAsset: (asset: AssetRecord) => void; onImportAssets: () => void; onImportPdfAsSlides: (asset: AssetRecord) => void }) {
  const { state, updateProject, setStatus } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [query, setQuery] = useState("");
  const assets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.project.assets.filter((asset) => !q || asset.name.toLowerCase().includes(q) || asset.kind.toLowerCase().includes(q));
  }, [query, state.project.assets]);
  const usageByAsset = useMemo(() => assetUsageMap(state.project), [state.project.slides, state.project.masters]);
  const deleteAsset = async (asset: AssetRecord) => {
    const usage = usageByAsset.get(asset.id) ?? 0;
    if (usage > 0) {
      window.alert(state.workspace.language === "en" ? `This asset is still used in ${usage} place(s). Remove it from the slide/master first.` : `Ez az asset még ${usage} helyen használatban van. Előbb távolítsd el a diáról/mesterről.`);
      return;
    }
    if (!window.confirm(`${t("Asset törlése")}: ${asset.name}?`)) return;
    if (asset.path) await deleteImportedAsset(asset.path).catch(() => undefined);
    if (asset.kind === "pdf") releasePdfAsset(asset.id);
    updateProject((project) => { project.assets = project.assets.filter((candidate) => candidate.id !== asset.id); });
    setStatus(t("Asset törölve"));
  };
  const removeUnused = async () => {
    const unused = state.project.assets.filter((asset) => (usageByAsset.get(asset.id) ?? 0) === 0);
    if (!unused.length) { setStatus(t("Nincs törölhető, nem használt asset")); return; }
    if (!window.confirm(`${t("Nem használt assetek törlése")}: ${unused.length}?`)) return;
    await Promise.all(unused.filter((asset) => asset.path).map((asset) => deleteImportedAsset(asset.path!).catch(() => undefined)));
    unused.forEach((asset) => { if (asset.kind === "pdf") releasePdfAsset(asset.id); });
    const ids = new Set(unused.map((asset) => asset.id));
    updateProject((project) => { project.assets = project.assets.filter((asset) => !ids.has(asset.id)); });
    setStatus(`${unused.length} ${t("nem használt asset törölve")}`);
  };
  return <div className="assets-panel">
    <div className="section-heading compact"><div><Icon name="assets" /><strong>{t("Projekt assetek")}</strong></div><div className="asset-heading-actions"><button className="icon-only" onClick={()=>void removeUnused()} title={t("Nem használt assetek törlése")}><Icon name="delete" size={14}/></button><button className="icon-only" onClick={onImportAssets} title={t("Média importálása")}><Icon name="plus" size={15}/></button></div></div>
    <div className="asset-search-wrap"><input value={query} onChange={(e)=>setQuery(e.currentTarget.value)} placeholder={t("Keresés az assetek között…")} /></div>
    <div className="asset-list">
      {!assets.length && <div className="empty-panel-message">{t("Még nincs média a projektben.")}</div>}
      {assets.map((asset) => { const src=assetUrl(asset); const usage=usageByAsset.get(asset.id) ?? 0; return <div key={asset.id} className="asset-card-wrap">
        <button className="asset-card" onClick={()=>onUseAsset(asset)} title={t("Kattints a beszúráshoz")}>
          <div className="asset-preview">{["image","svg","gif"].includes(asset.kind) && src ? <img src={src} draggable={false} loading="lazy" decoding="async"/> : asset.kind === "video" && src ? <video src={src} muted preload="none"/> : <Icon name={assetIcon(asset)} size={24}/>}</div>
          <div className="asset-meta"><strong>{asset.name}</strong><span>{asset.kind}{asset.size ? ` · ${(asset.size/1024/1024).toFixed(asset.size>1024*1024?1:2)} MB` : ""}{usage ? ` · ${usage}×` : ""}</span></div>
          <Icon name="plus" size={14}/>
        </button>
        {asset.kind === "pdf" && <button className="asset-pdf-slides-button" onClick={()=>onImportPdfAsSlides(asset)} title={t("PDF oldalak importálása diákként")}><Icon name="slides" size={13}/></button>}
        <button className="asset-delete-button" onClick={()=>void deleteAsset(asset)} title={usage ? t("Az asset használatban van") : t("Asset törlése")}><Icon name="delete" size={13}/></button>
      </div>})}
    </div>
  </div>;
}
