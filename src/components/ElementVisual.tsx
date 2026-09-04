import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AssetRecord, SlideElement, TextElement, VideoElement, WebElement, ShapeElement, Model3DElement, PdfElement, SlideshowElement } from "../types";
import { assetUrl } from "../utils";
import { Icon } from "./Icon";
import { uiText } from "../i18n";
import { renderPdfPageToDataUrl } from "../pdfSupport";
import { measureTextOverflow, textVisualStyle } from "../textOverflow";

interface ElementVisualProps {
  element: SlideElement;
  asset?: AssetRecord;
  maskAsset?: AssetRecord;
  assetById?: ReadonlyMap<string, AssetRecord>;
  mode: "editor" | "present" | "thumbnail";
  editingText?: boolean;
  onTextCommit?: (text: string) => void;
  showOverflowIndicator?: boolean;
  active?: boolean;
  /** One Slide scroll progress for scroll-controlled media / 3D, 0..1. */
  scrollProgress?: number;
}


function mediaMaskStyle(element: { mask?: { kind: string; assetId?: string; points?: Array<{x:number;y:number}> }; radius?: number }, maskAsset?: AssetRecord): CSSProperties {
  const kind = element.mask?.kind ?? "none";
  if (kind === "ellipse") {
    return { clipPath: "ellipse(50% 50% at 50% 50%)" };
  }
  if (kind === "rounded-rect") {
    return { borderRadius: Math.max(0, element.radius ?? 28), overflow: "hidden" };
  }
  if (kind === "path") {
    const points = element.mask?.points ?? [];
    if (points.length >= 3) return { clipPath: `polygon(${points.map((point) => `${point.x}% ${point.y}%`).join(",")})` };
  }
  if (kind === "svg") {
    const src = assetUrl(maskAsset);
    if (src) {
      const value = `url('${src.replace(/'/g, "%27")}')`;
      return {
        WebkitMaskImage: value,
        maskImage: value,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
      };
    }
  }
  return {};
}

function TextVisual({
  element,
  editingText,
  onTextCommit,
  showOverflowIndicator = false,
}: {
  element: TextElement;
  editingText?: boolean;
  onTextCommit?: (text: string) => void;
  showOverflowIndicator?: boolean;
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (editingText) {
      ref.current?.focus();
      const selection = window.getSelection();
      if (selection && ref.current) {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [editingText]);

  useEffect(() => {
    if (!showOverflowIndicator) {
      setOverflowing(false);
      return;
    }
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try {
          setOverflowing(measureTextOverflow(element));
        } catch (error) {
          console.warn("Text overflow measurement failed", error);
          setOverflowing(false);
        }
      });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    const fonts = document.fonts;
    void fonts?.ready.then(measure).catch(() => undefined);
    fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [element, editingText, showOverflowIndicator]);

  return (
    <>
      <div
        ref={ref}
        className="text-visual"
        contentEditable={editingText}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => {
          if (!showOverflowIndicator) return;
          const node = ref.current;
          if (!node) return;
          setOverflowing(measureTextOverflow({ ...element, text: node.innerText }));
        }}
        onPointerDown={(event) => {
          if (editingText) event.stopPropagation();
        }}
        onBlur={(event) => onTextCommit?.(event.currentTarget.innerText)}
        onKeyDown={(event) => {
          if (editingText && event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        style={{ ...textVisualStyle(element), cursor: editingText ? "text" : "inherit" }}
      >
        {element.text}
      </div>
      {showOverflowIndicator && overflowing && <span className="text-overflow-badge" aria-label="Text overflow">+</span>}
    </>
  );
}

function SlideshowVisual({
  element,
  assetById,
  mode,
  active = true,
  maskAsset,
}: {
  element: SlideshowElement;
  assetById?: ReadonlyMap<string, AssetRecord>;
  mode: ElementVisualProps["mode"];
  active?: boolean;
  maskAsset?: AssetRecord;
}) {
  const validAssetIds = element.assetIds.filter((id) => Boolean(assetById?.get(id)));
  const [index, setIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);

  const count = validAssetIds.length;
  const safeIndex = count ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    setIndex(0);
    setPreviousIndex(null);
  }, [element.id, element.assetIds.join("|")]);

  useEffect(() => {
    if (mode === "thumbnail") {
      setPlaying(false);
      return;
    }
    if (mode === "present") {
      setPlaying(Boolean(active && element.startMode === "slide-enter" && count > 1));
      return;
    }
    setPlaying(false);
  }, [active, count, element.id, element.startMode, mode]);

  useEffect(() => {
    if (mode !== "editor") return;
    if (!active) setPlaying(false);
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; action?: "toggle" | "play" | "pause" }>).detail;
      if (detail?.id !== element.id) return;
      if (detail.action === "pause") setPlaying(false);
      else if (detail.action === "play") setPlaying(count > 1);
      else setPlaying((value) => count > 1 && !value);
    };
    window.addEventListener("preon-slideshow-preview", listener as EventListener);
    return () => window.removeEventListener("preon-slideshow-preview", listener as EventListener);
  }, [active, count, element.id, mode]);

  const advance = () => {
    if (count <= 1) return;
    setIndex((current) => {
      const normalized = Math.min(current, count - 1);
      const atEnd = normalized >= count - 1;
      if (atEnd && !element.loop) {
        setPlaying(false);
        return normalized;
      }
      const next = atEnd ? 0 : normalized + 1;
      if (element.transition === "fade" && element.transitionDuration > 0) {
        setPreviousIndex(normalized);
        if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = window.setTimeout(() => {
          setPreviousIndex(null);
          fadeTimerRef.current = null;
        }, Math.max(0, element.transitionDuration) * 1000 + 40);
      } else {
        setPreviousIndex(null);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!playing || count <= 1 || mode === "thumbnail") return;
    const timer = window.setTimeout(advance, Math.max(0.1, element.interval) * 1000);
    return () => window.clearTimeout(timer);
  }, [count, element.interval, element.loop, element.transition, element.transitionDuration, mode, playing, safeIndex]);

  useEffect(() => () => {
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
  }, []);

  if (!count) {
    return <div className="missing-media slideshow-missing"><Icon name="slideshow" size={28} /><span>{uiText("Adj képeket a slideshow-hoz")}</span></div>;
  }

  const imageStyle = (assetIndex: number): CSSProperties => ({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: element.fit,
    objectPosition: `${element.contentPositionX ?? 50}% ${element.contentPositionY ?? 50}%`,
    transform: `scale(${element.contentScale ?? 1})`,
    transformOrigin: `${element.contentPositionX ?? 50}% ${element.contentPositionY ?? 50}%`,
    display: "block",
    pointerEvents: "none",
    animation: element.transition === "fade" && assetIndex === safeIndex && previousIndex !== null
      ? `preon-slideshow-fade-in ${Math.max(0.01, element.transitionDuration)}s ease both`
      : undefined,
  });
  const assetSrc = (assetIndex: number) => assetUrl(assetById?.get(validAssetIds[assetIndex]));
  const currentSrc = assetSrc(safeIndex);
  const previousSrc = previousIndex !== null && previousIndex < count ? assetSrc(previousIndex) : "";

  return (
    <div
      className={`slideshow-frame-visual ${playing ? "is-playing" : "is-paused"}`}
      data-slideshow-id={element.id}
      onClick={mode === "present" && (element.startMode === "on-click" || element.clickToggle) ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!playing && !element.loop && safeIndex >= count - 1) setIndex(0);
        setPlaying((value) => count > 1 && !value);
      } : undefined}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: element.radius,
        boxSizing: "border-box",
        border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor}` : "none",
        cursor: mode === "present" && (element.startMode === "on-click" || element.clickToggle) ? "pointer" : undefined,
        ...mediaMaskStyle(element, maskAsset),
      }}
    >
      {previousSrc && previousIndex !== null && <img src={previousSrc} alt="" draggable={false} style={imageStyle(previousIndex)} />}
      {currentSrc && <img key={`${element.id}-${safeIndex}`} src={currentSrc} alt={`${element.name} ${safeIndex + 1}`} draggable={false} style={imageStyle(safeIndex)} />}
      {mode === "editor" && <div className="slideshow-editor-badge"><Icon name={playing ? "pause" : "play"} size={11} /><span>{safeIndex + 1}/{count}</span></div>}
    </div>
  );
}

function PdfVisual({ element, asset, maskAsset, mode }: { element: PdfElement; asset?: AssetRecord; maskAsset?: AssetRecord; mode: ElementVisualProps["mode"] }) {
  const [src, setSrc] = useState(element.renderedDataUrl ?? "");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(element.renderedDataUrl ? "ready" : "loading");

  useEffect(() => {
    let cancelled = false;
    if (element.renderedDataUrl) {
      setSrc(element.renderedDataUrl);
      setStatus("ready");
      return () => { cancelled = true; };
    }
    if (!asset) {
      setSrc("");
      setStatus("error");
      return () => { cancelled = true; };
    }
    setStatus("loading");
    // A bal oldali thumbnail csak ~188 px széles. A korábbi 900 px-es PDF
    // rasterizálás sok memóriát/CPU-t használt feleslegesen, főleg sok PDF-diánál.
    const targetWidth = mode === "present" ? 1600 : mode === "thumbnail" ? 360 : 1100;
    void renderPdfPageToDataUrl(asset, element.page, targetWidth)
      .then((value) => {
        if (cancelled) return;
        setSrc(value);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setSrc("");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [asset, element.page, element.renderedDataUrl, mode]);

  return (
    <div
      className="pdf-frame-visual"
      data-pdf-render-status={status}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: element.radius,
        boxSizing: "border-box",
        border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor}` : "none",
        background: "#ffffff",
        ...mediaMaskStyle(element, maskAsset),
      }}
    >
      {status === "ready" && src ? (
        <img
          src={src}
          alt={`${element.name} · ${element.page}. oldal`}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: element.fit,
            objectPosition: `${element.contentPositionX ?? 50}% ${element.contentPositionY ?? 50}%`,
            transform: `scale(${element.contentScale ?? 1})`,
            transformOrigin: `${element.contentPositionX ?? 50}% ${element.contentPositionY ?? 50}%`,
            display: "block",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div className="missing-media pdf-loading-state">
          <Icon name="pdf" size={30} />
          <span>{status === "error" ? uiText("A PDF oldal nem renderelhető") : uiText("PDF oldal renderelése…")}</span>
          <small>{element.page} / {Math.max(1, element.pageCount)}</small>
        </div>
      )}
    </div>
  );
}

function VideoVisual({ element, asset, maskAsset, mode, active = true, scrollProgress }: { element: VideoElement; asset?: AssetRecord; maskAsset?: AssetRecord; mode: ElementVisualProps["mode"]; active?: boolean; scrollProgress?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loadError, setLoadError] = useState(false);
  const src = assetUrl(asset);
  const scrollControlled = mode === "present" && element.playbackMode === "scroll" && scrollProgress !== undefined;
  const scrubTargetRef = useRef<number | null>(null);
  const scrubFrameRef = useRef<number | null>(null);
  const waitingForSeekRef = useRef(false);

  useEffect(() => {
    setLoadError(false);
  }, [src]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (mode === "present") {
      if (!active || scrollControlled) {
        video.pause();
      } else if (element.autoplay) {
        void video.play().catch(() => undefined);
      }
    }
  }, [active, element.autoplay, mode, scrollControlled, src]);

  useEffect(() => () => {
    if (scrubFrameRef.current !== null) cancelAnimationFrame(scrubFrameRef.current);
    scrubFrameRef.current = null;
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const handleLoaded = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const requested = mode === "present"
        ? element.startTime
        : (element.posterTime || element.startTime || Math.min(0.04, video.duration / 20));
      if (requested > 0) video.currentTime = clampVideoTime(requested, video.duration);
    };
    const handleTime = () => {
      if (mode === "present" && element.playbackMode === "scroll") return;
      if (element.endTime && video.currentTime >= element.endTime) {
        if (element.loop) {
          video.currentTime = element.startTime;
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      }
    };
    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTime);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTime);
    };
  }, [element.endTime, element.loop, element.posterTime, element.startTime, mode, src]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !scrollControlled || scrollProgress === undefined) return;

    const scheduleLatestSeek = () => {
      if (scrubFrameRef.current !== null) return;
      scrubFrameRef.current = requestAnimationFrame(() => {
        scrubFrameRef.current = null;
        const target = scrubTargetRef.current;
        if (target === null || !Number.isFinite(target)) return;
        if (video.seeking) {
          if (!waitingForSeekRef.current) {
            waitingForSeekRef.current = true;
            video.addEventListener("seeked", () => {
              waitingForSeekRef.current = false;
              scheduleLatestSeek();
            }, { once: true });
          }
          return;
        }
        if (Math.abs(video.currentTime - target) > 0.016) {
          try { video.currentTime = target; } catch { /* codec/browser may reject a transient seek */ }
        }
      });
    };

    const updateTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const start = clampVideoTime(Math.max(0, element.startTime || 0), video.duration);
      const requestedEnd = element.endTime && element.endTime > start ? element.endTime : video.duration;
      const end = clampVideoTime(Math.max(start, requestedEnd), video.duration);
      scrubTargetRef.current = start + (end - start) * Math.max(0, Math.min(1, scrollProgress));
      video.pause();
      scheduleLatestSeek();
    };

    if (video.readyState >= 1) updateTarget();
    video.addEventListener("loadedmetadata", updateTarget);
    return () => video.removeEventListener("loadedmetadata", updateTarget);
  }, [element.endTime, element.startTime, scrollControlled, scrollProgress, src]);

  if (!src) return <div className="missing-media">{uiText("Hiányzó videó")}</div>;
  if (mode === "thumbnail") {
    return element.posterDataUrl
      ? <div className="media-mask-frame" style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: element.radius, ...mediaMaskStyle(element, maskAsset) }}><img src={element.posterDataUrl} draggable={false} alt={`${element.name} poster`} style={{ width: "100%", height: "100%", display: "block", objectFit: element.fit }} /></div>
      : <div className="missing-media"><Icon name="video" size={26} /><span>{uiText("Válassz poster frame-et")}</span></div>;
  }
  if (loadError) {
    return (
      <div className="missing-media video-load-error">
        <Icon name="video" size={30} />
        <span>{uiText("A videó nem dekódolható")}</span>
        <small>{asset?.name ?? "Videó"}</small>
      </div>
    );
  }
  return (
    <div
      className="media-mask-frame"
      style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: element.radius, ...mediaMaskStyle(element, maskAsset) }}
    >
      <video
        ref={ref}
        src={src}
        poster={element.posterDataUrl}
        autoPlay={mode === "present" && active && element.autoplay && !(element.playbackMode === "scroll" && scrollProgress !== undefined)}
        loop={!(element.playbackMode === "scroll" && scrollProgress !== undefined) && element.loop && !element.endTime}
        muted={element.muted}
        controls={mode === "present" && !(element.playbackMode === "scroll" && scrollProgress !== undefined) ? element.controls : false}
        playsInline
        preload={mode === "present" ? "auto" : "metadata"}
        onError={() => setLoadError(true)}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: element.fit,
          pointerEvents: mode === "present" ? "auto" : "none",
        }}
      />
    </div>
  );
}

function shapeClipPath(element: ShapeElement): string | undefined {
  if (element.shape === "triangle") return "polygon(50% 0%, 100% 100%, 0% 100%)";
  if (element.shape === "star") return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%)";
  if (element.shape === "polygon") return "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)";
  if (element.shape === "arrow") return "polygon(0% 32%, 62% 32%, 62% 8%, 100% 50%, 62% 92%, 62% 68%, 0% 68%)";
  return undefined;
}

function ShapeVisual({ element, asset, mode }: { element: ShapeElement; asset?: AssetRecord; mode: ElementVisualProps["mode"] }) {
  if (element.shape === "line") {
    return <div style={{ width: "100%", height: "100%", background: element.fill, borderRadius: Math.max(1, element.height / 2) }} />;
  }
  const radius = element.shape === "ellipse" ? "50%" : (element.shape === "rect" || element.shape === "rounded-rect") ? `${element.radius}px` : 0;
  const clipPath = shapeClipPath(element);
  const frameStyle: CSSProperties = {
    width: "100%", height: "100%", boxSizing: "border-box", overflow: "hidden",
    border: element.strokeWidth > 0 ? `${element.strokeWidth}px solid ${element.stroke}` : "none",
    borderRadius: radius,
    clipPath,
  };
  if (element.fillType === "gradient") {
    return <div style={{ ...frameStyle, background: `linear-gradient(${element.gradientAngle}deg, ${element.gradientFrom}, ${element.gradientTo})` }} />;
  }
  if ((element.fillType === "image" || element.fillType === "video") && asset) {
    const src = assetUrl(asset);
    if (!src) return <div style={{ ...frameStyle, background: element.fill }} />;
    if (element.fillType === "video") {
      if (mode === "thumbnail") {
        return (
          <div style={frameStyle}>
            {element.fillPosterDataUrl
              ? <img src={element.fillPosterDataUrl} draggable={false} alt={`${element.name} poster`} style={{ width: "100%", height: "100%", display: "block", objectFit: element.fillFit }} />
              : <div className="missing-media"><Icon name="video" size={24} /><span>{uiText("Válassz poster frame-et")}</span></div>}
          </div>
        );
      }
      return (
        <div style={frameStyle}>
          <video src={src} autoPlay={mode === "present"} loop muted playsInline style={{ width: "100%", height: "100%", display: "block", objectFit: element.fillFit, pointerEvents: mode === "present" ? "auto" : "none" }} />
        </div>
      );
    }
    return (
      <div style={frameStyle}>
        <img src={src} draggable={false} alt={element.name} style={{ width: "100%", height: "100%", display: "block", objectFit: element.fillFit, pointerEvents: "none" }} />
      </div>
    );
  }
  return <div style={{ ...frameStyle, background: element.fill }} />;
}

function clampVideoTime(value: number, duration: number) {
  return Math.max(0, Math.min(value, Math.max(0, duration - 0.001)));
}


type ModelViewerDom = HTMLElement & {
  cameraOrbit?: string;
  fieldOfView?: string;
  toDataURL?: (type?: string, encoderOptions?: number) => string;
};

let modelViewerRuntimePromise: Promise<void> | null = null;

function ensureModelViewerRuntime(): Promise<void> {
  if (typeof customElements !== "undefined" && customElements.get("model-viewer")) return Promise.resolve();
  if (!modelViewerRuntimePromise) {
    modelViewerRuntimePromise = import("@google/model-viewer")
      .then(() => undefined)
      .catch((error) => {
        modelViewerRuntimePromise = null;
        throw error;
      });
  }
  return modelViewerRuntimePromise;
}

function Model3DVisual({ element, asset, mode, scrollProgress }: { element: Model3DElement; asset?: AssetRecord; mode: ElementVisualProps["mode"]; scrollProgress?: number }) {
  const viewerRef = useRef<ModelViewerDom | null>(null);
  const [scrollTheta, setScrollTheta] = useState(0);
  const [runtimeReady, setRuntimeReady] = useState(() => typeof customElements !== "undefined" && Boolean(customElements.get("model-viewer")));
  const [runtimeError, setRuntimeError] = useState(false);
  const src = assetUrl(asset);

  useEffect(() => {
    if (!src || mode === "thumbnail" || runtimeReady) return;
    let active = true;
    setRuntimeError(false);
    void ensureModelViewerRuntime()
      .then(() => { if (active) setRuntimeReady(true); })
      .catch(() => { if (active) setRuntimeError(true); });
    return () => { active = false; };
  }, [mode, runtimeReady, src]);

  useEffect(() => {
    setScrollTheta(0);
  }, [src, element.orbitTheta]);

  const scrollDrivenTheta = mode === "present" && element.interaction === "scroll" && scrollProgress !== undefined
    ? Math.max(0, Math.min(1, scrollProgress)) * element.scrollRotation
    : scrollTheta;

  const applyOrbit = (theta: number, phi = element.orbitPhi) => {
    const viewer = viewerRef.current;
    if (viewer) viewer.cameraOrbit = `${theta}deg ${phi}deg ${element.cameraDistance ?? 100}%`;
  };

  useEffect(() => {
    applyOrbit(element.orbitTheta + scrollDrivenTheta);
  }, [element.cameraDistance, element.orbitPhi, element.orbitTheta, scrollDrivenTheta]);

  if (!src) return <div className="missing-media"><Icon name="model3d" size={30} /><span>{uiText("Hiányzó 3D modell")}</span></div>;
  if (mode === "thumbnail") {
    return element.posterDataUrl
      ? <img src={element.posterDataUrl} draggable={false} alt={`${element.name} 3D poster`} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      : <div className="model3d-thumbnail-placeholder"><Icon name="model3d" size={30} /><span>3D</span></div>;
  }
  if (!runtimeReady) {
    return <div className="model3d-thumbnail-placeholder"><Icon name="model3d" size={30} /><span>{runtimeError ? uiText("Hiányzó 3D modell") : "3D…"}</span></div>;
  }

  const interactive = mode === "present" || element.interactiveInEditor;
  const cameraControls = interactive && element.interaction === "orbit";
  const ModelViewerTag = "model-viewer" as any;
  return (
    <div
      className="model3d-frame"
      data-model3d-id={element.id}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: element.transparentBackground ? "transparent" : element.backgroundColor,
      }}
      onPointerDown={(event) => { if (interactive) event.stopPropagation(); }}
      onPointerMove={(event) => {
        if (!interactive || element.interaction !== "parallax") return;
        const rect = event.currentTarget.getBoundingClientRect();
        const nx = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
        const ny = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
        applyOrbit(element.orbitTheta + nx * element.parallaxStrength, element.orbitPhi - ny * element.parallaxStrength * 0.55);
      }}
      onPointerLeave={() => {
        if (element.interaction === "parallax") applyOrbit(element.orbitTheta + scrollDrivenTheta);
      }}
      onWheel={(event) => {
        if (!interactive || element.interaction !== "scroll" || (mode === "present" && scrollProgress !== undefined)) return;
        event.preventDefault();
        event.stopPropagation();
        const delta = Math.sign(event.deltaY) * Math.min(16, Math.abs(event.deltaY) * 0.08);
        setScrollTheta((value) => Math.max(-element.scrollRotation, Math.min(element.scrollRotation, value + delta)));
      }}
    >
      <ModelViewerTag
        ref={(node: ModelViewerDom | null) => { viewerRef.current = node; }}
        src={src}
        alt={element.name}
        loading={mode === "present" ? "eager" : "lazy"}
        reveal="auto"
        camera-controls={cameraControls ? "" : undefined}
        auto-rotate={element.autoRotate ? "" : undefined}
        auto-rotate-delay="0"
        rotation-per-second={`${element.autoRotateSpeed}deg`}
        camera-orbit={`${element.orbitTheta + scrollDrivenTheta}deg ${element.orbitPhi}deg ${element.cameraDistance ?? 100}%`}
        field-of-view={`${element.fieldOfView}deg`}
        exposure={String(element.exposure)}
        shadow-intensity={String(element.shadowIntensity)}
        interaction-prompt="none"
        touch-action={element.interaction === "orbit" ? "pan-y" : "none"}
        style={{ width: "100%", height: "100%", display: "block", background: "transparent", pointerEvents: interactive ? "auto" : "none", ["--progress-bar-height" as any]: "0px" }}
      />
      {mode === "editor" && !element.interactiveInEditor && (
        <div className="model3d-editor-shield"><Icon name="model3d" size={24} /><span>{uiText("3D modell · interakció a tulajdonságoknál")}</span></div>
      )}
    </div>
  );
}

function WebVisual({ element, asset, mode }: { element: WebElement; asset?: AssetRecord; mode: ElementVisualProps["mode"] }) {
  const src = element.sourceType === "local" ? assetUrl(asset) : element.url;
  if (mode === "thumbnail") {
    return (
      <div className="web-placeholder">
        <Icon name="web" size={42} />
        <span>{element.sourceType === "url" ? element.url : asset?.name ?? "Helyi HTML"}</span>
      </div>
    );
  }
  return (
    <div className="web-frame-wrap" style={{ borderRadius: element.radius }}>
      {src ? (
        <iframe
          src={src}
          title={element.name}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
          allow="fullscreen; autoplay; clipboard-read; clipboard-write"
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
            pointerEvents: mode === "present" || element.interactiveInEditor ? "auto" : "none",
          }}
        />
      ) : (
        <div className="missing-media">{uiText("Nincs megadva webcím")}</div>
      )}
      {mode === "editor" && !element.interactiveInEditor && (
        <div className="web-editor-shield" title={uiText("Az interakció a tulajdonságoknál kapcsolható be.")}><Icon name="web" size={28} /></div>
      )}
    </div>
  );
}

export function ElementVisual({ element, asset, maskAsset, assetById, mode, editingText, onTextCommit, showOverflowIndicator = false, active = true, scrollProgress }: ElementVisualProps) {
  if (element.type === "text") {
    return <TextVisual element={element} editingText={editingText} onTextCommit={onTextCommit} showOverflowIndicator={showOverflowIndicator} />;
  }
  if (element.type === "shape") {
    return <ShapeVisual element={element} asset={asset} mode={mode} />;
  }
  if (element.type === "image") {
    const src = assetUrl(asset);
    return src ? (
      <div
        className="image-frame-visual"
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: element.radius,
          boxSizing: "border-box",
          border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor}` : "none",
          ...mediaMaskStyle(element, maskAsset),
        }}
      >
        <img
          src={src}
          alt={element.name}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: element.fit,
            objectPosition: `${element.contentPositionX ?? 50}% ${element.contentPositionY ?? 50}%`,
            transform: `scale(${element.contentScale ?? 1})`,
            transformOrigin: `${element.contentPositionX ?? 50}% ${element.contentPositionY ?? 50}%`,
            display: "block",
            pointerEvents: "none",
          }}
        />
      </div>
    ) : (
      <div className="missing-media">{uiText("Húzz ide képet")}</div>
    );
  }
  if (element.type === "slideshow") {
    return <SlideshowVisual element={element} assetById={assetById} maskAsset={maskAsset} mode={mode} active={active} />;
  }
  if (element.type === "pdf") {
    return <PdfVisual element={element} asset={asset} maskAsset={maskAsset} mode={mode} />;
  }
  if (element.type === "video") {
    return <VideoVisual element={element} asset={asset} maskAsset={maskAsset} mode={mode} active={active} scrollProgress={scrollProgress} />;
  }
  if (element.type === "model3d") {
    return <Model3DVisual element={element} asset={asset} mode={mode} scrollProgress={scrollProgress} />;
  }
  return <WebVisual element={element} asset={asset} mode={mode} />;
}
