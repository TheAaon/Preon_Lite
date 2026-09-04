import { useState } from "react";
import { Icon } from "./Icon";
import { useEditor } from "../EditorContext";
import { tr } from "../i18n";

export function WebEmbedDialog({ onClose, onAdd, onChooseLocal }: {
  onClose: () => void;
  onAdd: (url: string) => void;
  onChooseLocal: () => void;
}) {
  const { state } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [url, setUrl] = useState("https://example.com");
  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal web-dialog">
        <header className="modal-header">
          <div><Icon name="web" /><div><strong>{t("Webtartalom beágyazása")}</strong><span>{t("Élő weboldal vagy helyi HTML")}</span></div></div>
          <button className="icon-only" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="web-dialog-body">
          <label className="field text-field">
            <span>{t("Webcím")}</span>
            <input autoFocus value={url} onChange={(event) => setUrl(event.currentTarget.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && url.trim()) onAdd(url.trim());
            }} />
          </label>
          <div className="web-dialog-divider"><span>{t("vagy")}</span></div>
          <button className="secondary-button wide" onClick={onChooseLocal}><Icon name="open" size={15} /> {state.workspace.language === "en" ? "Choose local HTML file" : "Helyi HTML-fájl kiválasztása"}</button>
        </div>
        <footer className="modal-footer">
          <span />
          <div><button className="secondary-button" onClick={onClose}>{t("Mégse")}</button><button className="primary-button" onClick={() => url.trim() && onAdd(url.trim())}>{t("Beágyazás")}</button></div>
        </footer>
      </div>
    </div>
  );
}
