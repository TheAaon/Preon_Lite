import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../EditorContext";
import { setAppFullscreen } from "../platform";
import { clamp } from "../utils";
import { outputSlides } from "../outputProject";
import { Icon } from "./Icon";
import { SceneBackground, StaticScene } from "./Scene";
import { ElementVisual } from "./ElementVisual";
import { resolvedSlideBackground, resolvedSlideMasterElements } from "../masterResolver";
import { uiText } from "../i18n";
import { longformLayout } from "../longformLayout";
import { elementScrollMetrics, normalizedScrollBehavior, requiredLongformScrollHeight, scrollMotionValues, type ElementScrollMetrics } from "../scrollEffects";
import { withResolvedDynamicText } from "../dynamicFields";
import type { AssetRecord, PresentationProject, Slide, SlideElement } from "../types";


interface LongformLayerEntry {
  section: ReturnType<typeof longformLayout>[number];
  element: SlideElement;
  rank: number;
  isMaster: boolean;
}

function LongformOverlayElement({
  project,
  assetById,
  entry,
  scale,
  metrics,
  scrollY,
  pinned,
  playbackActive,
  onNavigate,
  dynamicSlide,
}: {
  project: PresentationProject;
  assetById: ReadonlyMap<string, AssetRecord>;
  entry: LongformLayerEntry;
  scale: number;
  metrics?: ElementScrollMetrics;
  scrollY: number;
  pinned: boolean;
  playbackActive: boolean;
  onNavigate: (targetSlideId: string, smooth: boolean) => void;
  dynamicSlide?: Slide;
}) {
  const { section, element, rank, isMaster } = entry;
  const slide = section.slide;
  const assetId = "assetId" in element ? element.assetId : element.type === "shape" ? element.fillAssetId : undefined;
  const asset = assetId ? assetById.get(assetId) : undefined;
  const maskAssetId = (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") ? element.mask?.assetId : undefined;
  const maskAsset = maskAssetId ? assetById.get(maskAssetId) : undefined;
  const dynamicContextSlide = element.type === "text"
    && (element.dynamicField ?? "none") !== "none"
    && normalizedScrollBehavior(element).mode === "sticky"
    ? (dynamicSlide ?? slide)
    : slide;
  const visualElement = element.type === "text" ? withResolvedDynamicText(project, dynamicContextSlide, element) : element;
  const scrollDriven = !isMaster && (element.type === "video"
    ? element.playbackMode === "scroll"
    : element.type === "model3d"
      ? element.interaction === "scroll"
      : false);
  const navigationTarget = element.navigation?.type === "section" ? element.navigation.targetSlideId : undefined;
  const navigable = Boolean(navigationTarget);
  const behavior = normalizedScrollBehavior(element);
  const motion = !isMaster ? scrollMotionValues(element, metrics?.progress ?? 0) : { opacity: 1, scale: 1, offsetX: 0, offsetY: 0 };
  const postPinOffset = !pinned && !isMaster && behavior.mode === "sticky" && metrics && metrics.progress >= 1
    ? metrics.duration
    : 0;
  const projectTop = pinned
    ? element.y
    : section.top + element.y - scrollY + postPinOffset;

  return (
    <div
      className={`longform-hard-pin-element ${pinned ? "is-pinned" : "is-promoted"} ${navigable ? "static-navigation-element" : ""}`}
      role={navigable ? "button" : undefined}
      tabIndex={navigable ? 0 : -1}
      onClick={navigable ? (event) => { event.stopPropagation(); onNavigate(navigationTarget!, element.navigation?.smooth !== false); } : undefined}
      onKeyDown={navigable ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onNavigate(navigationTarget!, element.navigation?.smooth !== false);
        }
      } : undefined}
      style={{
        left: element.x * scale,
        top: projectTop * scale,
        width: element.width * scale,
        height: element.height * scale,
        transform: `translate(${motion.offsetX * scale}px, ${motion.offsetY * scale}px) rotate(${element.rotation}deg) scale(${motion.scale})`,
        transformOrigin: element.type === "shape" && element.shape === "line" ? "left center" : "center center",
        opacity: element.opacity * motion.opacity,
        pointerEvents: "auto",
        zIndex: rank,
      }}
    >
      <div
        className="longform-hard-pin-scale"
        style={{
          width: element.width,
          height: element.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: navigable ? "none" : undefined,
        }}
      >
        <ElementVisual
          element={visualElement}
          asset={asset}
          maskAsset={maskAsset}
          assetById={assetById}
          mode="present"
          active={playbackActive}
          scrollProgress={scrollDriven ? metrics?.progress : undefined}
        />
      </div>
    </div>
  );
}

export function PresentMode() {
  const { state, setPresentMode, setPresentIndex } = useEditor();
  const assetById = useMemo(() => new Map(state.project.assets.map((asset) => [asset.id, asset])), [state.project.assets]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [revealCount, setRevealCount] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [longformScrollY, setLongformScrollY] = useState(0);
  const longformScrollFrame = useRef<number | null>(null);
  const pendingLongformScrollY = useRef(0);
  const hideTimer = useRef<number | null>(null);
  const slides = useMemo(() => outputSlides(state.project), [state.project]);
  const longform = state.project.presentationMode === "longform";
  const slide = slides[state.presentIndex];
  const clickElements = useMemo(
    () => slide?.elements.filter((element) => element.animation.trigger === "on-click") ?? [],
    [slide],
  );
  const scale = slide
    ? Math.min(size.width / state.project.width, size.height / state.project.height)
    : 1;
  const longformScale = Math.max(0.08, size.width / state.project.width);
  const longformSections = useMemo(() => longformLayout(state.project, slides), [slides, state.project]);
  const longformViewportHeight = size.height / Math.max(0.0001, longformScale);
  const dynamicLongformSlide = useMemo(() => {
    const lastSection = longformSections[longformSections.length - 1];
    const rawProbeY = longformScrollY + Math.min(longformViewportHeight * 0.5, state.project.height * 0.5);
    // Longform can deliberately be taller than the authored sections because sticky ranges add
    // scroll tail. Clamp the probe to the authored content so a dynamic page number can never
    // fall out of every section and resolve back to its source slide at the very end.
    const probeY = lastSection ? clamp(rawProbeY, 0, Math.max(0, lastSection.bottom - 0.001)) : rawProbeY;
    return longformSections.find((section) => probeY >= section.top && probeY < section.bottom)?.slide
      ?? lastSection?.slide
      ?? longformSections[0]?.slide;
  }, [longformScrollY, longformSections, longformViewportHeight, state.project.height]);
  const longformScrollHeight = useMemo(
    () => requiredLongformScrollHeight(state.project, longformSections, longformViewportHeight),
    [longformSections, longformViewportHeight, state.project],
  );
  const visibleLongformSectionIds = useMemo(() => {
    const margin = longformViewportHeight * 2;
    const minY = Math.max(0, longformScrollY - margin);
    const maxY = longformScrollY + longformViewportHeight + margin;
    return new Set(longformSections
      .filter((section) => section.bottom >= minY && section.top <= maxY)
      .map((section) => section.slide.id));
  }, [longformScrollY, longformSections, longformViewportHeight]);
  const activeLongformSectionIds = useMemo(() => {
    const minY = Math.max(0, longformScrollY);
    const maxY = longformScrollY + longformViewportHeight;
    return new Set(longformSections
      .filter((section) => section.bottom >= minY && section.top <= maxY)
      .map((section) => section.slide.id));
  }, [longformScrollY, longformSections, longformViewportHeight]);

  useEffect(() => {
    let mounted = true;
    window.setTimeout(() => rootRef.current?.focus(), 0);
    void setAppFullscreen(true).then(() => {
      if (mounted) window.setTimeout(() => rootRef.current?.focus(), 40);
    }).catch(() => {
      if (mounted) setControlsVisible(true);
    });
    return () => {
      mounted = false;
      void setAppFullscreen(false).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setRevealCount(0);
  }, [state.presentIndex]);

  const exit = useCallback(async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await setAppFullscreen(false);
    } finally {
      setPresentMode(false);
    }
  }, [exiting, setPresentMode]);
  const previous = () => {
    if (revealCount > 0) {
      setRevealCount((value) => Math.max(0, value - 1));
      return;
    }
    setPresentIndex(state.presentIndex - 1);
  };
  const next = () => {
    if (revealCount < clickElements.length) {
      setRevealCount((value) => value + 1);
      return;
    }
    if (state.presentIndex < slides.length - 1) setPresentIndex(state.presentIndex + 1);
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") { void exit(); return; }
      if (longform) {
        if (["ArrowDown", "PageDown", " "].includes(event.key)) {
          event.preventDefault();
          rootRef.current?.scrollBy({ top: Math.max(220, size.height * 0.82), behavior: "smooth" });
        }
        if (["ArrowUp", "PageUp"].includes(event.key)) {
          event.preventDefault();
          rootRef.current?.scrollBy({ top: -Math.max(220, size.height * 0.82), behavior: "smooth" });
        }
        if (event.key === "Home") rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        if (event.key === "End") rootRef.current?.scrollTo({ top: rootRef.current.scrollHeight, behavior: "smooth" });
        return;
      }
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        next();
      }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        previous();
      }
      if (event.key === "Home") setPresentIndex(0);
      if (event.key === "End") setPresentIndex(slides.length - 1);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [clickElements.length, exit, longform, revealCount, size.height, state.presentIndex, slides.length, setPresentIndex]);

  useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (longformScrollFrame.current !== null) cancelAnimationFrame(longformScrollFrame.current);
  }, []);

  const handleLongformScroll = useCallback((scrollTop: number) => {
    pendingLongformScrollY.current = scrollTop / Math.max(0.0001, longformScale);
    if (longformScrollFrame.current !== null) return;
    longformScrollFrame.current = requestAnimationFrame(() => {
      longformScrollFrame.current = null;
      setLongformScrollY(pendingLongformScrollY.current);
    });
  }, [longformScale]);

  const showControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2400);
  };

  const navigateToSlide = useCallback((targetSlideId: string, smooth: boolean) => {
    const targetIndex = slides.findIndex((candidate) => candidate.id === targetSlideId);
    if (targetIndex < 0) return;
    if (longform) {
      const target = longformSections[targetIndex];
      if (!target) return;
      rootRef.current?.scrollTo({ top: target.top * longformScale, behavior: smooth ? "smooth" : "auto" });
      return;
    }
    setPresentIndex(targetIndex);
  }, [longform, longformScale, longformSections, setPresentIndex, slides]);

  const longformLayerEntries = useMemo<LongformLayerEntry[]>(() => longformSections.flatMap((section) => {
    const sectionBase = section.index * 1_000_000;
    const masters = resolvedSlideMasterElements(state.project, section.slide).map((element, index) => ({
      section,
      element,
      isMaster: true,
      rank: sectionBase + index,
    }));
    const slideElements = section.slide.elements.map((element, index) => ({
      section,
      element,
      isMaster: false,
      rank: sectionBase + 100_000 + index,
    }));
    return [...masters, ...slideElements];
  }), [longformSections, state.project]);

  const hardPinnedEntries = useMemo(() => longformLayerEntries.filter(({ element, isMaster }) => {
    if (isMaster || !element.visible) return false;
    const behavior = normalizedScrollBehavior(element);
    return behavior.mode === "sticky";
  }), [longformLayerEntries]);

  const hardPinMetrics = useMemo(() => {
    const map = new Map<string, ElementScrollMetrics>();
    for (const { section, element } of hardPinnedEntries) {
      map.set(`${section.slide.id}:${element.id}`, elementScrollMetrics(
        state.project,
        longformSections,
        section.slide.id,
        element,
        longformScrollY,
        longformViewportHeight,
      ));
    }
    return map;
  }, [hardPinnedEntries, longformScrollY, longformSections, longformViewportHeight, state.project]);

  const activeHardPins = useMemo(() => hardPinnedEntries.filter(({ section, element }) =>
    hardPinMetrics.get(`${section.slide.id}:${element.id}`)?.active,
  ), [hardPinMetrics, hardPinnedEntries]);

  const minActivePinRank = activeHardPins.length ? Math.min(...activeHardPins.map((entry) => entry.rank)) : Number.POSITIVE_INFINITY;
  const promotedEntries = useMemo(() => {
    if (!Number.isFinite(minActivePinRank)) return [] as LongformLayerEntry[];
    const margin = longformViewportHeight * 1.5;
    return longformLayerEntries.filter((entry) => {
      if (!entry.element.visible || entry.rank <= minActivePinRank) return false;
      const top = entry.section.top + entry.element.y;
      const bottom = top + Math.max(entry.element.height, entry.element.width);
      return bottom >= longformScrollY - margin && top <= longformScrollY + longformViewportHeight + margin;
    });
  }, [longformLayerEntries, longformScrollY, longformViewportHeight, minActivePinRank]);

  const overlayEntries = useMemo(() => {
    const byKey = new Map<string, { entry: LongformLayerEntry; pinned: boolean; metrics?: ElementScrollMetrics }>();
    for (const entry of promotedEntries) {
      const key = `${entry.section.slide.id}:${entry.element.id}`;
      const metrics = entry.isMaster ? undefined : elementScrollMetrics(
        state.project,
        longformSections,
        entry.section.slide.id,
        entry.element,
        longformScrollY,
        longformViewportHeight,
      );
      const behavior = normalizedScrollBehavior(entry.element);
      const pinned = !entry.isMaster && behavior.mode === "sticky" && Boolean(metrics?.active);
      byKey.set(key, { entry, pinned, metrics });
    }
    for (const entry of activeHardPins) {
      const key = `${entry.section.slide.id}:${entry.element.id}`;
      byKey.set(key, { entry, pinned: true, metrics: hardPinMetrics.get(key) });
    }
    return [...byKey.values()].sort((a, b) => a.entry.rank - b.entry.rank);
  }, [activeHardPins, hardPinMetrics, longformScrollY, longformSections, longformViewportHeight, promotedEntries, state.project]);

  const overlayElementKeys = useMemo(() => new Set(overlayEntries.map(({ entry }) => `${entry.section.slide.id}:${entry.element.id}`)), [overlayEntries]);

  if (!slide) return (
    <div className="present-overlay"><div className="empty-panel-message">{uiText("Nincs prezentálható dia. Kapcsold vissza legalább egy rejtett diát.")}</div></div>
  );
  if (longform) return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="present-overlay longform-present-overlay"
      onPointerMove={showControls}
      onScroll={(event) => handleLongformScroll(event.currentTarget.scrollTop)}
    >
      <div
        className="longform-present-shell"
        style={{ width: state.project.width * longformScale, height: longformScrollHeight * longformScale }}
      >
        <div
          className="longform-present-stage"
          style={{
            width: state.project.width,
            height: longformScrollHeight,
            transform: `scale(${longformScale})`,
          }}
        >
          {longformSections.map(({ slide: section, top, height }, sectionIndex) => {
            const background = resolvedSlideBackground(state.project, section);
            const renderMedia = visibleLongformSectionIds.has(section.id);
            return <div
              key={`longform-bg-${section.id}`}
              className="longform-present-background"
              data-longform-section-id={section.id}
              style={{ top: top - (sectionIndex > 0 ? 0.5 : 0), width: state.project.width, height: height + (sectionIndex > 0 ? 1 : 0.5), backgroundColor: background.color }}
            >
              {renderMedia && <SceneBackground project={state.project} background={background} mode="present" assetById={assetById} />}
            </div>;
          })}
          {longformSections.map(({ slide: section, top, height }) => {
            if (!visibleLongformSectionIds.has(section.id)) return null;
            const stickyActive = Boolean(section.longformSticky && height > state.project.height);
            const stickyTravel = stickyActive ? height - state.project.height : 0;
            const stickyOffset = stickyActive ? clamp(longformScrollY - top, 0, stickyTravel) : 0;
            const contentHeight = stickyActive ? state.project.height : height;
            return (
              <div
                key={`longform-scene-${section.id}`}
                className={`longform-present-section ${stickyActive ? "is-sticky" : ""}`}
                data-longform-section-id={section.id}
                style={{ top: top + stickyOffset, width: state.project.width, height: contentHeight, zIndex: 2 }}
              >
                <StaticScene
                  project={state.project}
                  assetById={assetById}
                  slide={section}
                  mode="present"
                  revealCount={Number.POSITIVE_INFINITY}
                  showBackground={false}
                  allowOverflow
                  sceneHeight={contentHeight}
                  elementFilter={(element) => !overlayElementKeys.has(`${section.id}:${element.id}`)}
                  onNavigate={navigateToSlide}
                  longformScroll={{
                    scrollY: longformScrollY,
                    viewportHeight: longformViewportHeight,
                    layout: longformSections,
                  }}
                  playbackActive={activeLongformSectionIds.has(section.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="longform-hard-pin-layer" aria-hidden={false}>
        {overlayEntries.map(({ entry, pinned, metrics }) => (
          <LongformOverlayElement
            key={`longform-overlay-${entry.section.slide.id}-${entry.element.id}`}
            project={state.project}
            assetById={assetById}
            entry={entry}
            scale={longformScale}
            metrics={metrics}
            scrollY={longformScrollY}
            pinned={pinned}
            playbackActive={pinned || activeLongformSectionIds.has(entry.section.slide.id)}
            onNavigate={navigateToSlide}
            dynamicSlide={dynamicLongformSlide}
          />
        ))}
      </div>
      <button className={`present-exit ${controlsVisible ? "visible" : ""}`} onClick={() => void exit()} disabled={exiting} title={uiText("Kilépés (Esc)")}><Icon name="close" /></button>
    </div>
  );
  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="present-overlay"
      onPointerMove={showControls}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, input, video, iframe, a, model-viewer, .model3d-frame")) return;
        next();
      }}
    >
      <div
        className="presentation-stage-frame"
        style={{
          width: state.project.width,
          height: state.project.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div key={slide.id} className={`presentation-transition-layer transition-${slide.transition}`}>
          <StaticScene
            key={`${slide.id}-${state.presentIndex}`}
            project={state.project}
            assetById={assetById}
            slide={slide}
            mode="present"
            revealCount={revealCount}
            onNavigate={navigateToSlide}
          />
        </div>
      </div>

      <div className={`present-controls ${controlsVisible ? "visible" : ""}`}>
        <button onClick={previous} disabled={state.presentIndex === 0 && revealCount === 0}><Icon name="chevronLeft" /></button>
        <span>{state.presentIndex + 1} / {slides.length}</span>
        <button onClick={next} disabled={state.presentIndex === slides.length - 1 && revealCount >= clickElements.length}><Icon name="chevronRight" /></button>
      </div>
      <button className={`present-exit ${controlsVisible ? "visible" : ""}`} onClick={() => void exit()} disabled={exiting} title={uiText("Kilépés (Esc)")}><Icon name="close" /></button>
      <div className={`present-progress ${controlsVisible ? "visible" : ""}`}>
        <span style={{ width: `${clamp(((state.presentIndex + 1) / Math.max(1, slides.length)) * 100, 0, 100)}%` }} />
      </div>
    </div>
  );
}
