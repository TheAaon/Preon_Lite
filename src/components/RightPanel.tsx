import { useEditor } from "../EditorContext";
import type { AssetRecord } from "../types";
import { Icon } from "./Icon";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { AssetsPanel } from "./AssetsPanel";
import { TextOverviewPanel } from "./TextOverviewPanel";
import { tr } from "../i18n";

export function RightPanel({
  onSetBackgroundMedia, onReplaceImage, onChooseMaskSvg, onChooseShapeMedia, onAddSlideshowImages, onUseAsset, onImportAssets, onImportPdfAsSlides,
}: {
  onSetBackgroundMedia: (kind: "image" | "video") => void;
  onReplaceImage: (elementId: string) => void;
  onChooseMaskSvg: (elementId: string) => void;
  onChooseShapeMedia: (elementId: string, kind: "image" | "video") => void;
  onAddSlideshowImages: (elementId: string) => void;
  onUseAsset: (asset: AssetRecord) => void;
  onImportAssets: () => void;
  onImportPdfAsSlides: (asset: AssetRecord) => void;
}) {
  const { state, updateWorkspace } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  return (
    <aside className="right-panel panel-shell">
      <div className="panel-tabs right-tabs">
        <button className={state.workspace.rightTab === "properties" ? "active" : ""} onClick={() => updateWorkspace({ rightTab: "properties" })} title={t("Tulajdonságok")}><Icon name="properties" /><span>{t("Tulajdonságok")}</span></button>
        <button className={state.workspace.rightTab === "layers" ? "active" : ""} onClick={() => updateWorkspace({ rightTab: "layers" })} title={t("Rétegek")}><Icon name="layers" /><span>{t("Rétegek")}</span></button>
        <button className={state.workspace.rightTab === "textOverview" ? "active" : ""} onClick={() => updateWorkspace({ rightTab: "textOverview" })} title={t("Szövegek")}><Icon name="text" /><span>{t("Szövegek")}</span></button>
        <button className={state.workspace.rightTab === "assets" ? "active" : ""} onClick={() => updateWorkspace({ rightTab: "assets" })} title="Project Assets"><Icon name="assets" /><span>{t("Assetek")}</span></button>
      </div>
      <div className="right-panel-content">
        {state.workspace.rightTab === "properties" ? <PropertiesPanel onSetBackgroundMedia={onSetBackgroundMedia} onReplaceImage={onReplaceImage} onChooseMaskSvg={onChooseMaskSvg} onChooseShapeMedia={onChooseShapeMedia} onAddSlideshowImages={onAddSlideshowImages} /> : state.workspace.rightTab === "textOverview" ? <TextOverviewPanel /> : state.workspace.rightTab === "layers" ? <LayersPanel /> : <AssetsPanel onUseAsset={onUseAsset} onImportAssets={onImportAssets} onImportPdfAsSlides={onImportPdfAsSlides} />}
      </div>
    </aside>
  );
}
