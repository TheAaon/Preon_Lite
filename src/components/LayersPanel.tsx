import { useMemo, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { useEditor } from "../EditorContext";
import type { SlideElement } from "../types";
import { masterChain } from "../masterResolver";
import { Icon, type IconName } from "./Icon";
import { tr } from "../i18n";

function elementIcon(element: SlideElement): IconName {
  if (element.type === "shape") return element.shape === "ellipse" ? "ellipse" : element.shape === "line" ? "line" : "rect";
  return element.type === "text" ? "text" : element.type === "image" ? "image" : element.type === "slideshow" ? "slideshow" : element.type === "pdf" ? "pdf" : element.type === "video" ? "video" : element.type === "model3d" ? "model3d" : "web";
}

type DropEdge = "before" | "after";

export function LayersPanel() {
  const {
    state,
    activeContainer,
    setSelection,
    updateElement,
    updateProject,
    reorderElement,
    detachMasterElement,
    resetMasterOverride,
  } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: DropEdge } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const elements = useMemo(() => [...activeContainer.elements].reverse(), [activeContainer.elements]);
  const activeSlide = state.project.slides.find((slide) => slide.id === state.activeSlideId);
  const masterLayers = useMemo(() => {
    if (state.editingMasterId || !activeSlide?.masterId) return [];
    return masterChain(state.project, activeSlide.masterId).flatMap((master) => master.elements.map((element) => ({ master, element }))).reverse();
  }, [activeSlide?.masterId, state.editingMasterId, state.project]);
  const overriddenMasterIds = useMemo(() => new Set(activeSlide?.elements.map((element) => element.masterSourceId).filter(Boolean) ?? []), [activeSlide?.elements]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SlideElement[]>();
    elements.forEach((element) => {
      if (!element.groupId) return;
      const list = groups.get(element.groupId) ?? [];
      list.push(element);
      groups.set(element.groupId, list);
    });
    return groups;
  }, [elements]);

  const rename = (id: string, value: string) => {
    updateElement(id, { name: value.trim() || "Névtelen elem" } as Partial<SlideElement>);
    setEditingName(null);
  };

  const dropLayer = useCallback((targetId: string, edge: DropEdge, sourceId?: string | null) => {
    const movingId = sourceId ?? draggedId;
    if (!movingId || movingId === targetId) {
      setDropTarget(null);
      return;
    }
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    updateProject((project) => {
      const container = editingMasterId
        ? project.masters.find((master) => master.id === editingMasterId)
        : project.slides.find((slide) => slide.id === activeSlideId);
      if (!container) return;

      // A layer panel vizuálisan felülről lefelé mutatja a z-sorrendet,
      // míg a canvas tömbjében a későbbi elem van feljebb.
      const visual = [...container.elements].reverse();
      const from = visual.findIndex((element) => element.id === movingId);
      if (from < 0) return;
      const [moved] = visual.splice(from, 1);
      const targetIndex = visual.findIndex((element) => element.id === targetId);
      if (targetIndex < 0) return;
      const target = visual[targetIndex];
      visual.splice(targetIndex + (edge === "after" ? 1 : 0), 0, moved);

      // Csoporthatár átlépése is valódi legyen: ha egy elem másik csoport
      // gyereke mellé kerül, belép abba a csoportba; sima layer mellé húzva kilép.
      if (target?.groupId) moved.groupId = target.groupId;
      else delete moved.groupId;

      container.elements = visual.reverse();
    });
    setSelection([movingId]);
    setDraggedId(null);
    setDropTarget(null);
  }, [draggedId, setSelection, state.activeSlideId, state.editingMasterId, updateProject]);

  const startLayerPointerDrag = useCallback((event: ReactPointerEvent, elementId: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggedId(elementId);
    let currentTarget: { id: string; edge: DropEdge } | null = null;

    const move = (moveEvent: PointerEvent) => {
      const hit = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
      const row = hit?.closest<HTMLElement>("[data-layer-id]");
      const id = row?.dataset.layerId;
      if (!row || !id || id === elementId) {
        currentTarget = null;
        setDropTarget(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const edge: DropEdge = moveEvent.clientY < rect.top + rect.height / 2 ? "before" : "after";
      currentTarget = { id, edge };
      setDropTarget(currentTarget);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (currentTarget) dropLayer(currentTarget.id, currentTarget.edge, elementId);
      else { setDraggedId(null); setDropTarget(null); }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }, [dropLayer]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const renderRow = (element: SlideElement, inGroup = false) => {
    const dropClass = dropTarget?.id === element.id ? `drop-${dropTarget.edge}` : "";
    return (
      <div
        key={element.id}
        className={`layer-row ${inGroup ? "group-child-row" : ""} ${state.selection.includes(element.id) ? "active" : ""} ${draggedId === element.id ? "dragging" : ""} ${dropClass}`}
        data-layer-id={element.id}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button,input")) return;
          if (!state.selection.includes(element.id)) setSelection([element.id]);
          startLayerPointerDrag(event, element.id);
        }}
        onClick={(event) => {
          if (event.shiftKey) {
            const next = new Set(state.selection);
            if (next.has(element.id)) next.delete(element.id);
            else next.add(element.id);
            setSelection(Array.from(next));
          } else {
            setSelection([element.id]);
          }
        }}
      >
        <button className="layer-drag-handle" type="button" title={t("Húzd a réteget a kívánt helyre")} onPointerDown={(event) => startLayerPointerDrag(event, element.id)}>⋮⋮</button>
        <Icon name={elementIcon(element)} size={15} />
        {editingName === element.id ? (
          <input
            autoFocus
            defaultValue={element.name}
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => rename(element.id, event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") rename(element.id, event.currentTarget.value);
              if (event.key === "Escape") setEditingName(null);
            }}
          />
        ) : (
          <span className="layer-name" onDoubleClick={() => setEditingName(element.id)}>{element.name}</span>
        )}
        <button
          className="layer-toggle"
          onClick={(event) => {
            event.stopPropagation();
            updateElement(element.id, { visible: !element.visible } as Partial<SlideElement>);
          }}
          title={t(element.visible ? "Elrejtés" : "Megjelenítés")}
        >
          <Icon name={element.visible ? "eye" : "eyeOff"} size={14} />
        </button>
        <button
          className="layer-toggle"
          onClick={(event) => {
            event.stopPropagation();
            updateElement(element.id, { locked: !element.locked } as Partial<SlideElement>);
          }}
          title={t(element.locked ? "Feloldás" : "Zárolás")}
        >
          <Icon name={element.locked ? "lock" : "unlock"} size={13} />
        </button>
      </div>
    );
  };

  const renderedGroups = new Set<string>();

  return (
    <div className="layers-panel">
      <div className="section-heading compact">
        <div>
          <Icon name="layers" />
          <strong>{t("Rétegek")}</strong>
        </div>
        {state.selection.length === 1 && (
          <div className="inline-actions layer-order-actions">
            <button onClick={() => reorderElement(state.selection[0], "front")} title={t("Legfelülre")}><Icon name="front" /></button>
            <button onClick={() => reorderElement(state.selection[0], "forward")} title={t("Egy szinttel előrébb")}>↑</button>
            <button onClick={() => reorderElement(state.selection[0], "backward")} title={t("Egy szinttel hátrébb")}>↓</button>
            <button onClick={() => reorderElement(state.selection[0], "back")} title={t("Legalulra")}><Icon name="back" /></button>
          </div>
        )}
      </div>

      {!state.editingMasterId && masterLayers.length > 0 && (
        <div className="layer-master-group">
          <div className="layer-group-label"><Icon name="masters" size={14} /> {t("Mester elemek")}</div>
          {masterLayers.map(({ master, element }) => {
            const overridden = overriddenMasterIds.has(element.id);
            return (
              <div key={`master-${master.id}-${element.id}`} className={`layer-row master-layer-row ${overridden ? "master-overridden" : ""}`}>
                <Icon name={elementIcon(element)} size={15} />
                <span className="layer-name">{element.name}<small>{master.name}</small></span>
                {overridden ? (
                  <button className="layer-toggle" title={t("Felülírás visszaállítása")} onClick={() => resetMasterOverride(element.id)}><Icon name="reset" size={13} /></button>
                ) : (
                  <button className="layer-toggle" title={t("Leválasztás ezen a dián")} onClick={() => detachMasterElement(element.id)}><Icon name="copy" size={13} /></button>
                )}
                <Icon name="lock" size={13} />
              </div>
            );
          })}
        </div>
      )}

      <div className="layer-list">
        {elements.length === 0 && <div className="empty-panel-message">{t("Még nincs elem ezen az oldalon.")}</div>}
        {elements.map((element) => {
          if (!element.groupId) return renderRow(element);
          if (renderedGroups.has(element.groupId)) return null;
          renderedGroups.add(element.groupId);
          const members = grouped.get(element.groupId) ?? [element];
          const collapsed = collapsedGroups.has(element.groupId);
          const selectedCount = members.filter((member) => state.selection.includes(member.id)).length;
          return (
            <div key={element.groupId} className={`layer-group-block ${selectedCount === members.length ? "active-group" : ""}`}>
              <div
                className="layer-group-header"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  setSelection(members.map((member) => member.id));
                }}
              >
                <button className="layer-group-collapse" onClick={(event) => { event.stopPropagation(); toggleGroup(element.groupId!); }}>
                  <Icon name={collapsed ? "chevronRight" : "chevronDown"} size={13} />
                </button>
                <Icon name="group" size={14} />
                <span>{t("Csoport")}</span>
                <em>{members.length}</em>
              </div>
              {!collapsed && <div className="layer-group-children">{members.map((member) => renderRow(member, true))}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
