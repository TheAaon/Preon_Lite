import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import ReactDOM from "react-dom/client";
import { tr } from "./i18n";
import { APP_EDITION, APP_VERSION } from "./utils";
import type { AppLanguage, AppTheme } from "./types";
import { applyWorkspaceAppearance } from "./theme";
import frogVideo from "./assets/beka.mp4";
import preonLogo from "./assets/preon-logo.svg";
import { loadBrowserSession, setPreloadedBrowserSession } from "./browserPersistence";
import "./styles.css";

const WORKSPACE_KEY = "presentation-studio.workspace.v1";
const MINIMUM_SPLASH_MS = 4000;

function storedWorkspacePrefs(): { language: AppLanguage; theme: AppTheme; darkBrightness: number; lightBrightness: number } {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return { language: "hu", theme: "dark", darkBrightness: 50, lightBrightness: 50 };
    const parsed = JSON.parse(raw);
    const theme: AppTheme = parsed?.theme === "light" || parsed?.theme === "system" ? parsed.theme : "dark";
    return {
      language: parsed?.language === "en" ? "en" : "hu",
      theme,
      darkBrightness: Number.isFinite(Number(parsed?.darkBrightness)) ? Math.max(0, Math.min(100, Number(parsed.darkBrightness))) : 50,
      lightBrightness: 50,
    };
  } catch {
    return { language: "hu", theme: "dark", darkBrightness: 50, lightBrightness: 50 };
  }
}

async function prepareSplashWindow() {
  // Browser build: there is no native window to resize or decorate.
}

async function prepareEditorWindow() {
  // Browser build: the editor already fills the current tab.
}

function SplashScreen({ status, language }: { status: string; language: AppLanguage }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    const start = () => void video.play().catch(() => undefined);
    start();
    video.addEventListener("canplay", start, { once: true });
    return () => video.removeEventListener("canplay", start);
  }, []);
  return (
    <div className="preon-splash" role="status" aria-live="polite">
      <div className="splash-card">
        <img className="splash-logo" src={preonLogo} alt="Pre'on" />
        <video ref={videoRef} className="splash-frog" src={frogVideo} autoPlay loop muted playsInline preload="auto" />
        <div className="splash-meta">
          <strong>Pre'on</strong>
          <span>{APP_VERSION} · {APP_EDITION}</span>
        </div>
        <div className="splash-status">{tr(language, status)}</div>
        <div className="splash-credit">Made by Vásárhelyi Áron</div>
      </div>
    </div>
  );
}

function Boot() {
  const prefs = useMemo(storedWorkspacePrefs, []);
  const language = prefs.language;
  applyWorkspaceAppearance(prefs);
  document.documentElement.lang = language === "en" ? "en" : "hu";
  const [status, setStatus] = useState("Indulás…");
  const [AppComponent, setAppComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const boot = async () => {
      await prepareSplashWindow();
      if (cancelled) return;

      setStatus("Workspace betöltése…");
      const appPromise = import("./App");
      await delay(180);
      if (cancelled) return;

      setStatus("Betűtípusok előkészítése…");
      try { await Promise.race([document.fonts?.ready ?? Promise.resolve(), delay(450)]); } catch { /* non-blocking */ }
      await delay(140);
      if (cancelled) return;

      setStatus("Projekt visszaállítása…");
      const [appModule, browserSession] = await Promise.all([appPromise, loadBrowserSession()]);
      if (cancelled) return;
      setPreloadedBrowserSession(browserSession);
      await delay(160);

      const elapsed = performance.now() - started;
      if (elapsed < MINIMUM_SPLASH_MS) await delay(MINIMUM_SPLASH_MS - elapsed);
      if (cancelled) return;

      setStatus("Készen áll");
      await delay(120);
      await prepareEditorWindow();
      if (!cancelled) setAppComponent(() => appModule.default);
    };
    void boot();
    return () => { cancelled = true; };
  }, []);

  return AppComponent ? <AppComponent /> : <SplashScreen status={status} language={language} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Boot />);
