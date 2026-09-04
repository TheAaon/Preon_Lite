import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useEditor } from "../EditorContext";
import { tr } from "../i18n";
import type { AssetRecord, MasterSlide, PresentationProject, Slide, SlideSection } from "../types";
import { newId } from "../utils";
import { StaticScene } from "./Scene";
import { Icon } from "./Icon";

const THUMB_WIDTH = 188;
type DropEdge = "before" | "after";
type DropTarget = { kind: "slide"; id: string; edge: DropEdge } | { kind: "section"; id: string } | { kind: "outside" };

const SlideThumbnail = memo(function SlideThumbnail({ slide, project, slideNumberKey, assetById }: { slide: Slide; project: PresentationProject; slideNumberKey: string; assetById: Map<string, AssetRecord> }) {
  const scale = THUMB_WIDTH / project.width;
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const scrollRoot = node.closest(".thumbnail-list");
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: scrollRoot,
      rootMargin: "320px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={rootRef} className="slide-thumbnail" style={{ width: THUMB_WIDTH, height: project.height * scale }}>
    {visible && <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}><StaticScene project={project} slide={slide} mode="thumbnail" assetById={assetById} /></div>}
  </div>;
}, (previous, next) => previous.slide === next.slide
  && previous.slideNumberKey === next.slideNumberKey
  && previous.project.width === next.project.width
  && previous.project.height === next.project.height
  && previous.project.assets === next.project.assets
  && previous.project.masters === next.project.masters);

const MasterThumbnail = memo(function MasterThumbnail({ master, project, slideNumberKey, assetById }: { master: MasterSlide; project: PresentationProject; slideNumberKey: string; assetById: Map<string, AssetRecord> }) {
  const pseudoSlide: Slide = { id:`preview-${master.id}`, name:master.name, hidden:false, masterId:master.id, background:{...master.background,inherit:true}, guides:{vertical:[],horizontal:[]}, grid:master.grid, inheritMasterGrid:true, elements:[], notes:"", transition:"none" };
  return <SlideThumbnail slide={pseudoSlide} project={project} slideNumberKey={slideNumberKey} assetById={assetById}/>;
}, (previous, next) => previous.master === next.master
  && previous.slideNumberKey === next.slideNumberKey
  && previous.project.width === next.project.width
  && previous.project.height === next.project.height
  && previous.project.assets === next.project.assets
  && previous.project.masters === next.project.masters);

export function SlidesPanel() {
  const { state, updateWorkspace, setActiveSlide, setSlideSelection, setEditingMaster, addSlide, duplicateSlides, deleteSlides, addMaster, duplicateMaster, deleteMaster, updateProject } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [editingName,setEditingName]=useState<string|null>(null);
  const [editingSection,setEditingSection]=useState<string|null>(null);
  const [draggedIds,setDraggedIds]=useState<string[]>([]);
  const selectionAnchorRef = useRef<string | null>(state.activeSlideId || null);
  const [dropTarget,setDropTarget]=useState<DropTarget|null>(null);
  const activeSlide=state.project.slides.find(s=>s.id===state.activeSlideId) ?? state.project.slides[0];
  const slideNumberKey = useMemo(() => state.project.slides.map((slide) => `${slide.id}:${slide.hidden ? 1 : 0}`).join("|"), [state.project.slides]);
  const assetById = useMemo(() => new Map(state.project.assets.map((asset) => [asset.id, asset])), [state.project.assets]);

  useEffect(() => {
    if (state.slideSelection.length <= 1 && state.activeSlideId) selectionAnchorRef.current = state.activeSlideId;
  }, [state.activeSlideId, state.slideSelection.length]);

  const sectionMap = useMemo(() => new Map(state.project.sections.map(section => [section.id, section])), [state.project.sections]);
  const sectionMembers = useMemo(() => {
    const map = new Map<string, Slide[]>();
    for (const slide of state.project.slides) {
      if (!slide.sectionId) continue;
      const list = map.get(slide.sectionId) ?? [];
      list.push(slide);
      map.set(slide.sectionId, list);
    }
    return map;
  }, [state.project.slides]);

  const renameSlide=(id:string,value:string)=>{ updateProject(project=>{const slide=project.slides.find(s=>s.id===id); if(slide) slide.name=value.trim()||t("Névtelen dia");}); setEditingName(null); };
  const renameMaster=(id:string,value:string)=>{ updateProject(project=>{const master=project.masters.find(m=>m.id===id); if(master) master.name=value.trim()||t("Névtelen mester");}); setEditingName(null); };
  const renameSection=(id:string,value:string)=>{ updateProject(project=>{const section=project.sections.find(s=>s.id===id); if(section) section.name=value.trim()||t("Szekció");}); setEditingSection(null); };

  const selectedSlideIds = state.slideSelection.length ? state.slideSelection : [state.activeSlideId];

  const addSection=()=>{
    const id = newId("section");
    const selected = new Set(selectedSlideIds);
    updateProject(project=>{
      project.sections.push({ id, name:t("Új szekció"), collapsed:false });
      const firstSelectedIndex = project.slides.findIndex((slide) => selected.has(slide.id));
      const members = project.slides.filter((slide) => selected.has(slide.id));
      members.forEach((slide) => { slide.sectionId = id; });
      if (members.length && firstSelectedIndex >= 0) {
        const remaining = project.slides.filter((slide) => !selected.has(slide.id));
        const insertAt = project.slides.slice(0, firstSelectedIndex).filter((slide) => !selected.has(slide.id)).length;
        remaining.splice(insertAt, 0, ...members);
        project.slides = remaining;
      }
    });
    setEditingSection(id);
  };

  const removeSection=(id:string)=> updateProject(project=>{
    project.sections=project.sections.filter(section=>section.id!==id);
    project.slides.forEach(slide=>{ if(slide.sectionId===id) slide.sectionId=undefined; });
  });
  const removeSlidesFromSection=(slideId:string)=> {
    const ids = state.slideSelection.includes(slideId) ? state.slideSelection : [slideId];
    const selected = new Set(ids);
    updateProject(project=>project.slides.forEach((slide)=>{ if(selected.has(slide.id)) slide.sectionId=undefined; }));
  };
  const toggleSection=(id:string)=> updateProject(project=>{const section=project.sections.find(s=>s.id===id);if(section)section.collapsed=!section.collapsed;},false);

  const selectionForPointer = useCallback((event: ReactPointerEvent, slideId: string): string[] => {
    const command = event.metaKey || event.ctrlKey;
    const current = state.slideSelection.length ? state.slideSelection : [state.activeSlideId];
    let next = current;
    if (event.shiftKey) {
      const anchor = selectionAnchorRef.current ?? state.activeSlideId ?? slideId;
      const a = state.project.slides.findIndex((slide) => slide.id === anchor);
      const b = state.project.slides.findIndex((slide) => slide.id === slideId);
      if (a >= 0 && b >= 0) {
        const range = state.project.slides.slice(Math.min(a,b), Math.max(a,b)+1).map((slide)=>slide.id);
        next = command ? Array.from(new Set([...current, ...range])) : range;
      } else next = [slideId];
      setSlideSelection(next, slideId);
      return next;
    }
    if (command) {
      if (current.includes(slideId)) {
        const reduced = current.filter((id) => id !== slideId);
        next = reduced.length ? reduced : [slideId];
      } else next = [...current, slideId];
      selectionAnchorRef.current = slideId;
      setSlideSelection(next, next.includes(slideId) ? slideId : next.at(-1));
      return next;
    }
    selectionAnchorRef.current = slideId;
    if (!current.includes(slideId)) {
      next = [slideId];
      setSlideSelection(next, slideId);
    }
    return next.includes(slideId) ? next : [slideId];
  }, [setSlideSelection, state.activeSlideId, state.project.slides, state.slideSelection]);

  const commitDrop = useCallback((target: DropTarget, movingIds: string[]) => {
    const movingSet = new Set(movingIds);
    if (!movingSet.size) return;
    if (target.kind === "slide" && movingSet.has(target.id)) { setDraggedIds([]); setDropTarget(null); return; }
    updateProject(project => {
      const moving = project.slides.filter((slide) => movingSet.has(slide.id));
      if (!moving.length) return;
      let remaining = project.slides.filter((slide) => !movingSet.has(slide.id));
      if (target.kind === "section") {
        moving.forEach((slide) => { slide.sectionId = target.id; });
        let insert = -1;
        remaining.forEach((slide,index)=>{ if(slide.sectionId===target.id) insert=index; });
        remaining.splice(insert + 1, 0, ...moving);
        project.slides = remaining;
        return;
      }
      if (target.kind === "outside") {
        moving.forEach((slide) => { slide.sectionId = undefined; });
        project.slides = [...remaining, ...moving];
        return;
      }
      const targetIndex = remaining.findIndex((slide) => slide.id === target.id);
      if (targetIndex < 0) return;
      const targetSection = remaining[targetIndex].sectionId;
      moving.forEach((slide) => { slide.sectionId = targetSection; });
      const insert = targetIndex + (target.edge === "after" ? 1 : 0);
      remaining.splice(insert, 0, ...moving);
      project.slides = remaining;
    });
    setDraggedIds([]);
    setDropTarget(null);
  },[updateProject]);

  const startSlideDrag=useCallback((event:ReactPointerEvent,slideId:string)=>{
    if(event.button!==0)return;
    const target=event.target as HTMLElement;
    if(target.closest("button,input,textarea"))return;
    event.preventDefault();
    const command = event.metaKey || event.ctrlKey;
    const shift = event.shiftKey;
    const wasSelected = state.slideSelection.includes(slideId);
    const movingIds = selectionForPointer(event, slideId);
    setDraggedIds(movingIds);
    const startX=event.clientX,startY=event.clientY;
    let moved=false;
    let current:DropTarget|null=null;
    const move=(e:PointerEvent)=>{
      if(!moved && Math.hypot(e.clientX-startX,e.clientY-startY)<4)return;
      moved=true;
      const hit=document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null;
      const section=hit?.closest<HTMLElement>("[data-section-drop]");
      if(section?.dataset.sectionDrop){ current={kind:"section",id:section.dataset.sectionDrop}; setDropTarget(current); return; }
      const outside=hit?.closest<HTMLElement>("[data-outside-sections]");
      if(outside){ current={kind:"outside"}; setDropTarget(current); return; }
      const row=hit?.closest<HTMLElement>("[data-slide-id]");
      const id=row?.dataset.slideId;
      if(!row||!id||movingIds.includes(id)){current=null;setDropTarget(null);return;}
      const rect=row.getBoundingClientRect(); const edge:DropEdge=e.clientY<rect.top+rect.height/2?"before":"after";
      current={kind:"slide",id,edge};setDropTarget(current);
    };
    const up=()=>{
      window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);
      if(moved&&current)commitDrop(current,movingIds);
      else {
        setDraggedIds([]);setDropTarget(null);
        if(!moved&&!command&&!shift&&wasSelected&&state.slideSelection.length>1)setSlideSelection([slideId],slideId);
        else if(!moved&&!command&&!shift)setActiveSlide(slideId);
      }
    };
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
  },[commitDrop,selectionForPointer,setActiveSlide,setSlideSelection,state.slideSelection]);

  const renderSlideRow=(slide:Slide,index:number,insideSection=false)=>{
    const dropClass=dropTarget?.kind==="slide"&&dropTarget.id===slide.id?`drop-${dropTarget.edge}`:"";
    const isSelected=state.slideSelection.includes(slide.id);
    const isDragging=draggedIds.includes(slide.id);
    return <div key={slide.id} className={`slide-list-item ${insideSection?"in-section":""}`}>
      <div data-slide-id={slide.id} data-hidden-label={t("KIHAGYVA")} className={`thumbnail-row ${state.activeSlideId===slide.id&&!state.editingMasterId?"active":""} ${isSelected?"slide-selected":""} ${slide.hidden?"hidden-slide":""} ${isDragging?"dragging":""} ${dropClass}`} onPointerDown={e=>startSlideDrag(e,slide.id)}>
        <div className="thumbnail-index">{index+1}</div>
        <button className={`slide-visibility-toggle ${slide.hidden?"is-hidden":""}`} title={t(slide.hidden?"Dia visszakapcsolása":"Dia elrejtése")} onClick={e=>{e.stopPropagation();const ids=state.slideSelection.includes(slide.id)?state.slideSelection:[slide.id];const next=!slide.hidden;const selected=new Set(ids);updateProject(project=>project.slides.forEach((candidate)=>{if(selected.has(candidate.id))candidate.hidden=next;}));}}><Icon name={slide.hidden?"eyeOff":"eye"} size={13}/></button>
        <div className="thumbnail-content"><SlideThumbnail slide={slide} project={state.project} slideNumberKey={slideNumberKey} assetById={assetById}/>{editingName===slide.id?<input className="thumbnail-name-input" defaultValue={slide.name} autoFocus onBlur={e=>renameSlide(slide.id,e.currentTarget.value)} onKeyDown={e=>{if(e.key==="Enter")renameSlide(slide.id,e.currentTarget.value);if(e.key==="Escape")setEditingName(null);}}/>:<div className="thumbnail-name" onDoubleClick={()=>setEditingName(slide.id)}>{slide.name}</div>}</div>
        {insideSection && <button className="slide-section-eject" title={t("Dia kivétele a szekcióból")} onClick={e=>{e.stopPropagation();removeSlidesFromSection(slide.id);}}>↗</button>}
      </div>
    </div>;
  };

  const slideIndex = (id:string)=>state.project.slides.findIndex(slide=>slide.id===id);
  const renderedSectionIds = new Set<string>();
  const slideRows: ReactNode[] = [];
  const renderSectionFolder = (section: SlideSection) => {
    const members = sectionMembers.get(section.id) ?? [];
    return (
      <div key={`folder-${section.id}`} className={`section-folder ${dropTarget?.kind === "section" && dropTarget.id === section.id ? "drop-active" : ""}`}>
        <div className="section-folder-header" data-section-drop={section.id}>
          <button className="section-collapse" title={t(section.collapsed ? "Szekció kinyitása" : "Szekció becsukása")} onClick={() => toggleSection(section.id)}><Icon name={section.collapsed ? "chevronRight" : "chevronDown"} size={13}/></button>
          <Icon name="section" size={14}/>
          {editingSection === section.id
            ? <input autoFocus defaultValue={section.name} onBlur={(e) => renameSection(section.id, e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") renameSection(section.id, e.currentTarget.value); if (e.key === "Escape") setEditingSection(null); }}/>
            : <strong title={t("Szekció átnevezése")} onDoubleClick={() => setEditingSection(section.id)}>{section.name}</strong>}
          <span>{members.length}</span>
          <button title={t("Szekció átnevezése")} onClick={() => setEditingSection(section.id)}>✎</button>
          <button title={t("Szekció törlése")} onClick={() => removeSection(section.id)}>×</button>
        </div>
        {!section.collapsed && <div className="section-folder-content">{members.map((member) => renderSlideRow(member, slideIndex(member.id), true))}<div className="section-drop-hint" data-section-drop={section.id}>{t("Húzd ide a diát")}</div></div>}
      </div>
    );
  };

  for (const slide of state.project.slides) {
    if (!slide.sectionId || !sectionMap.has(slide.sectionId)) {
      slideRows.push(renderSlideRow(slide, slideIndex(slide.id)));
      continue;
    }
    if (renderedSectionIds.has(slide.sectionId)) continue;
    renderedSectionIds.add(slide.sectionId);
    const section = sectionMap.get(slide.sectionId)!;
    slideRows.push(renderSectionFolder(section));
  }
  for (const section of state.project.sections) {
    if (!renderedSectionIds.has(section.id)) slideRows.push(renderSectionFolder(section));
  }

  return <aside className="left-panel panel-shell">
    <div className="panel-tabs">
      <button className={state.workspace.leftTab==="slides"?"active":""} onClick={()=>{updateWorkspace({leftTab:"slides"});setEditingMaster(null);}}><Icon name="slides"/><span>{t("Diák")}</span></button>
      <button className={state.workspace.leftTab==="masters"?"active":""} onClick={()=>{updateWorkspace({leftTab:"masters"});setEditingMaster(state.project.masters[0]?.id??null);}}><Icon name="masters"/><span>{t("Mesterek")}</span></button>
    </div>
    {state.workspace.leftTab==="slides" ? <>
      <div className="panel-toolbar"><strong>{state.project.slides.filter(s=>!s.hidden).length}/{state.project.slides.length} {t("dia")}{state.slideSelection.length>1?` · ${state.slideSelection.length} ${t("kijelölve")}`:""}</strong><div className="panel-toolbar-actions"><button onClick={addSection} title={t("Új szekció létrehozása")}><Icon name="section"/></button><button onClick={()=>duplicateSlides()} title={t(state.slideSelection.length>1?"Kijelölt diák duplikálása":"Aktív dia duplikálása")}><Icon name="duplicate"/></button><button onClick={()=>deleteSlides()} title={t(state.slideSelection.length>1?"Kijelölt diák törlése":"Aktív dia törlése")}><Icon name="delete"/></button><button className="primary-icon" onClick={addSlide} title={t("Új dia")}><Icon name="plus"/></button></div></div>
      <div className="thumbnail-list">
        {slideRows}
        <div className={`outside-section-drop ${dropTarget?.kind==="outside"?"drop-active":""}`} data-outside-sections>{t("Szekción kívüli diák")}</div>
      </div>
    </> : <><div className="panel-toolbar"><strong>{state.project.masters.length} {t("mester")}</strong><div className="panel-toolbar-actions"><button onClick={()=>duplicateMaster()}><Icon name="duplicate"/></button><button onClick={()=>deleteMaster()}><Icon name="delete"/></button><button className="primary-icon" onClick={addMaster}><Icon name="plus"/></button></div></div><div className="thumbnail-list">{state.project.masters.map((master,index)=><div key={master.id} className={`thumbnail-row ${state.editingMasterId===master.id?"active":""}`} onClick={()=>setEditingMaster(master.id)}><div className="thumbnail-index">M{index+1}</div><div className="thumbnail-content"><MasterThumbnail master={master} project={state.project} slideNumberKey={slideNumberKey} assetById={assetById}/>{editingName===master.id?<input className="thumbnail-name-input" defaultValue={master.name} autoFocus onBlur={e=>renameMaster(master.id,e.currentTarget.value)} onKeyDown={e=>{if(e.key==="Enter")renameMaster(master.id,e.currentTarget.value);if(e.key==="Escape")setEditingName(null);}}/>:<><div className="thumbnail-name" onDoubleClick={()=>setEditingName(master.id)}>{master.name}</div>{master.parentMasterId&&<div className="master-parent-label">↳ {state.project.masters.find(c=>c.id===master.parentMasterId)?.name??t("Szülő mester")}</div>}</>}</div></div>)}</div></>}
  </aside>;
}
