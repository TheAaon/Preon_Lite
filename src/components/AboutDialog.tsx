import { useEditor } from "../EditorContext";
import { tr } from "../i18n";
import { Icon } from "./Icon";
import { APP_EDITION, APP_VERSION } from "../utils";
import preonLogo from "../assets/preon-logo.svg";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { state } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  return (
    <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal about-dialog">
        <div className="about-brand">
          <img src={preonLogo} alt="Pre'on" />
          <div>
            <strong>Pre'on</strong>
            <span>{t("Verzió")} {APP_VERSION} · {APP_EDITION}</span>
          </div>
        </div>
        <p>{t("Precíz prezentációszerkesztő layoutokhoz, mozgáshoz, médiához, 3D-hez és hordozható webprezentációkhoz.")}</p>
        <button className="primary-button" onClick={onClose}>{t("Bezárás")}</button>
      </div>
    </div>
  );
}
