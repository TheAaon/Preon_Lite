import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useEditor } from "../EditorContext";
import type { ImageElement, SlideshowElement, MaskPoint, PdfElement, SlideElement, VideoElement } from "../types";
import { clamp } from "../utils";
import { uiText } from "../i18n";

function distanceToSegment(point: MaskPoint, a: MaskPoint, b: MaskPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length2, 0, 1);
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

export function MaskPathEditor({ element }: { element: ImageElement | SlideshowElement | VideoElement | PdfElement }) {
  const { updateElement, beginInteraction, finishInteraction } = useEditor();
  const rootRef = useRef<HTMLDivElement>(null);
  const points = element.mask.points ?? [];
  if (element.mask.kind !== "path" || points.length < 3) return null;

  const pointFromClient = (clientX: number, clientY: number): MaskPoint => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: clamp(((clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / Math.max(1, rect.height)) * 100, 0, 100),
    };
  };

  const setPoints = (next: MaskPoint[], recordHistory = true) => {
    updateElement(element.id, { mask: { ...element.mask, kind: "path", points: next } } as Partial<SlideElement>, recordHistory);
  };

  const insertPoint = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromClient(event.clientX, event.clientY);
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length; index += 1) {
      const distance = distanceToSegment(point, points[index], points[(index + 1) % points.length]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    const next = [...points];
    next.splice(bestIndex + 1, 0, point);
    setPoints(next);
  };

  const dragPoint = (event: ReactPointerEvent, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.altKey && points.length > 3) {
      setPoints(points.filter((_, pointIndex) => pointIndex !== index));
      return;
    }
    const snapshot = beginInteraction();
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      moved = true;
      const next = points.map((point, pointIndex) => pointIndex === index ? pointFromClient(moveEvent.clientX, moveEvent.clientY) : point);
      setPoints(next, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (moved) finishInteraction(snapshot);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  return (
    <div ref={rootRef} className="mask-path-editor" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={insertPoint} title={uiText("Dupla katt: pont hozzáadása · Alt+katt a pontra: törlés")}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
      </svg>
      {points.map((point, index) => (
        <button
          key={`${index}-${point.x}-${point.y}`}
          type="button"
          className="mask-path-point"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          onPointerDown={(event) => dragPoint(event, index)}
          title={uiText("Húzás: pont mozgatása · Alt+katt: törlés")}
        />
      ))}
    </div>
  );
}
