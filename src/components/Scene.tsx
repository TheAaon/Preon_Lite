import { memo, useMemo, type CSSProperties } from "react";
import type { AssetRecord, BackgroundSettings, PresentationProject, Slide, SlideElement } from "../types";
import { resolvedSlideMasterElements, resolvedSlideBackground } from "../masterResolver";
import { assetUrl } from "../utils";
import { ElementVisual } from "./ElementVisual";
import { withResolvedDynamicText } from "../dynamicFields";
import type { LongformSectionLayout } from "../longformLayout";
import { elementScrollMetrics, normalizedScrollBehavior, scrollMotionValues } from "../scrollEffects";
import { elementEffectsFilter } from "../elementAppearance";

export function SceneBackground({
  project,
  background,
  mode,
  assetById,
}: {
  project: PresentationProject;
  background: BackgroundSettings;
  mode: "editor" | "present" | "thumbnail";
  assetById?: ReadonlyMap<string, AssetRecord>;
}) {
  const asset = background.assetId ? (assetById?.get(background.assetId) ?? project.assets.find((candidate) => candidate.id === background.assetId)) : undefined;
  const src = assetUrl(asset);
  return (
    <div className="scene-background" style={{ backgroundColor: background.color }}>
      {background.type === "image" && src && (
        <img src={src} alt="Háttér" draggable={false} loading={mode === "thumbnail" ? "lazy" : "eager"} decoding="async" style={{ objectFit: background.fit }} />
      )}
      {background.type === "video" && src && (
        <video
          src={src}
          autoPlay={mode === "present"}
          muted
          loop
          playsInline
          preload={mode === "present" ? "auto" : "metadata"}
          style={{ objectFit: background.fit }}
        />
      )}
    </div>
  );
}

function animationStyle(element: SlideElement, mode: "present" | "thumbnail", visible: boolean): CSSProperties {
  if (mode !== "present" || element.animation.kind === "none") return {};
  return {
    animationName: visible ? `ps-${element.animation.kind}` : "none",
    animationDuration: `${element.animation.duration}s`,
    animationDelay: `${element.animation.delay}s`,
    animationTimingFunction: "cubic-bezier(.2,.8,.2,1)",
    animationFillMode: "both",
    opacity: visible ? undefined : 0,
  };
}


interface LongformScrollContext {
  scrollY: number;
  viewportHeight: number;
  layout: LongformSectionLayout[];
}
function StaticElement({
  project,
  assetById,
  element,
  mode,
  revealCount,
  clickIndex,
  slide,
  interactiveHit = false,
  onNavigate,
  longformScroll,
  enableLongformScroll = false,
  playbackActive = true,
}: {
  project: PresentationProject;
  assetById: ReadonlyMap<string, AssetRecord>;
  element: SlideElement;
  slide: Slide;
  mode: "present" | "thumbnail";
  revealCount: number;
  clickIndex: number;
  interactiveHit?: boolean;
  onNavigate?: (targetSlideId: string, smooth: boolean) => void;
  longformScroll?: LongformScrollContext;
  enableLongformScroll?: boolean;
  playbackActive?: boolean;
}) {
  if (!element.visible) return null;
  const assetId = "assetId" in element ? element.assetId : element.type === "shape" ? element.fillAssetId : undefined;
  const asset = assetId ? assetById.get(assetId) : undefined;
  const maskAssetId = (element.type === "image" || element.type === "slideshow" || element.type === "video" || element.type === "pdf") ? element.mask?.assetId : undefined;
  const maskAsset = maskAssetId ? assetById.get(maskAssetId) : undefined;
  const scrollBehavior = normalizedScrollBehavior(element);
  const dynamicContextSlide = element.type === "text"
    && (element.dynamicField ?? "none") !== "none"
    && mode === "present"
    && longformScroll
    && scrollBehavior.mode === "sticky"
    ? (longformScroll.layout.find((section, sectionIndex) => {
        const probeY = longformScroll.scrollY + Math.min(longformScroll.viewportHeight * 0.5, project.height * 0.5);
        return probeY >= section.top && (probeY < section.bottom || sectionIndex === longformScroll.layout.length - 1);
      })?.slide ?? longformScroll.layout[longformScroll.layout.length - 1]?.slide ?? slide)
    : slide;
  const visualElement = element.type === "text" ? withResolvedDynamicText(project, dynamicContextSlide, element) : element;
  const requiresClick = element.animation.trigger === "on-click";
  const revealed = !requiresClick || clickIndex < revealCount;
  const navigationTarget = element.navigation?.type === "section" ? element.navigation.targetSlideId : undefined;
  const navigable = Boolean(onNavigate && navigationTarget);
  const scrollMetrics = mode === "present" && enableLongformScroll && longformScroll
    ? elementScrollMetrics(project, longformScroll.layout, slide.id, element, longformScroll.scrollY, longformScroll.viewportHeight)
    : undefined;
  const scrollDriven = element.type === "video" ? element.playbackMode === "scroll" : element.type === "model3d" ? element.interaction === "scroll" : false;
  const scrollProgress = scrollDriven ? scrollMetrics?.progress : undefined;
  // Scroll motion belongs to the One Slide runtime only. Static thumbnails, normal slide
  // presentation and PDF export must keep the authored/base layout instead of rendering
  // the motion's start state (which can be fully transparent).
  const motion = scrollMetrics
    ? scrollMotionValues(element, scrollMetrics.progress)
    : { opacity: 1, scale: 1, offsetX: 0, offsetY: 0 };
  const stickyOffset = scrollBehavior.mode === "sticky" && scrollMetrics && !scrollMetrics.active && scrollMetrics.progress >= 1
    ? scrollMetrics.duration
    : 0;
  return (
    <div
      className={`static-scene-element ${navigable ? "static-navigation-element" : ""}`}
      data-static-element-id={interactiveHit ? element.id : undefined}
      role={navigable ? "button" : undefined}
      tabIndex={navigable ? 0 : undefined}
      onClick={navigable ? (event) => { event.stopPropagation(); onNavigate?.(navigationTarget!, element.navigation?.smooth !== false); } : undefined}
      onKeyDown={navigable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onNavigate?.(navigationTarget!, element.navigation?.smooth !== false); } } : undefined}
      style={{
        position: "absolute",
        left: element.x,
        top: element.y + stickyOffset,
        width: element.width,
        height: element.height,
        transform: `translate(${motion.offsetX}px, ${motion.offsetY}px) rotate(${element.rotation}deg) scale(${motion.scale})`,
        transformOrigin: element.type === "shape" && element.shape === "line" ? "left center" : "center center",
        opacity: element.opacity * motion.opacity,
        filter: elementEffectsFilter(element.effects),
        willChange: scrollBehavior.mode === "sticky" || scrollBehavior.motion?.enabled ? "top, transform, opacity" : undefined,
      }}
    >
      <div
        className={`static-animation-content animation-${element.animation.kind}`}
        style={{ ...animationStyle(element, mode, revealed), pointerEvents: navigable ? "none" : undefined }}
      >
        <ElementVisual element={visualElement} asset={asset} maskAsset={maskAsset} assetById={assetById} mode={mode} active={revealed && playbackActive} scrollProgress={scrollProgress} />
      </div>
    </div>
  );
}

export const StaticScene = memo(function StaticScene({
  project,
  slide,
  mode,
  revealCount = Number.POSITIVE_INFINITY,
  showBackground = true,
  allowOverflow = false,
  elementFilter,
  sceneHeight,
  onNavigate,
  longformScroll,
  assetById,
  playbackActive = true,
}: {
  project: PresentationProject;
  slide: Slide;
  mode: "present" | "thumbnail";
  revealCount?: number;
  showBackground?: boolean;
  allowOverflow?: boolean;
  elementFilter?: (element: SlideElement) => boolean;
  sceneHeight?: number;
  onNavigate?: (targetSlideId: string, smooth: boolean) => void;
  longformScroll?: LongformScrollContext;
  assetById?: ReadonlyMap<string, AssetRecord>;
  playbackActive?: boolean;
}) {
  const resolvedAssetById = useMemo(
    () => assetById ?? new Map(project.assets.map((asset) => [asset.id, asset])),
    [assetById, project.assets],
  );
  const background = resolvedSlideBackground(project, slide);
  const masterElements = resolvedSlideMasterElements(project, slide);
  const visibleMasterElements = elementFilter ? masterElements.filter(elementFilter) : masterElements;
  const visibleSlideElements = elementFilter ? slide.elements.filter(elementFilter) : slide.elements;
  const clickElements = visibleSlideElements.filter((element) => element.animation.trigger === "on-click");
  const clickIndexById = new Map(clickElements.map((element, index) => [element.id, index]));
  return (
    <div
      className={`static-scene static-scene-${mode} ${allowOverflow ? "static-scene-overflow" : ""}`}
      style={{ width: project.width, height: sceneHeight ?? project.height }}
    >
      {showBackground && <SceneBackground project={project} background={background} mode={mode} assetById={resolvedAssetById} />}
      {visibleMasterElements.map((element) => (
        <StaticElement
          key={`master-${element.id}`}
          project={project}
          assetById={resolvedAssetById}
          element={element}
          mode={mode}
          revealCount={Number.POSITIVE_INFINITY}
          clickIndex={-1}
          slide={slide}
          interactiveHit={false}
          onNavigate={onNavigate}
          longformScroll={longformScroll}
          enableLongformScroll={false}
          playbackActive={playbackActive}
        />
      ))}
      {visibleSlideElements.map((element) => (
        <StaticElement
          key={element.id}
          project={project}
          assetById={resolvedAssetById}
          element={element}
          mode={mode}
          revealCount={revealCount}
          clickIndex={clickIndexById.get(element.id) ?? -1}
          slide={slide}
          interactiveHit={allowOverflow}
          onNavigate={onNavigate}
          longformScroll={longformScroll}
          enableLongformScroll={Boolean(longformScroll)}
          playbackActive={playbackActive}
        />
      ))}
    </div>
  );
});
