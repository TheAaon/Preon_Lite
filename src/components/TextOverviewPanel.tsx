import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../EditorContext";
import { tr } from "../i18n";
import { withResolvedDynamicText } from "../dynamicFields";
import { measureTextOverflowBatch } from "../textOverflow";
import type { PresentationProject, TextElement } from "../types";
import { Icon } from "./Icon";
import { listSystemFonts } from "../platform";
import { primaryFontFamily } from "../elementAppearance";

interface TextEntry {
  key: string;
  slideId: string;
  element: TextElement;
  displayElement: TextElement;
}

interface TextMatch {
  entryKey: string;
  slideId: string;
  elementId: string;
  start: number;
  length: number;
}

function collectMatches(entries: TextEntry[], query: string): TextMatch[] {
  const needle = query.toLocaleLowerCase();
  if (!needle) return [];
  const matches: TextMatch[] = [];
  for (const entry of entries) {
    if ((entry.element.dynamicField ?? "none") !== "none") continue;
    const source = entry.element.text ?? "";
    const lower = source.toLocaleLowerCase();
    let offset = 0;
    while (offset <= lower.length - needle.length) {
      const index = lower.indexOf(needle, offset);
      if (index < 0) break;
      matches.push({
        entryKey: entry.key,
        slideId: entry.slideId,
        elementId: entry.element.id,
        start: index,
        length: query.length,
      });
      offset = index + Math.max(1, needle.length);
    }
  }
  return matches;
}

function replaceAllInsensitive(source: string, query: string, replacement: string): string {
  const needle = query.toLocaleLowerCase();
  if (!needle) return source;
  const lower = source.toLocaleLowerCase();
  let offset = 0;
  let result = "";
  while (offset <= source.length) {
    const index = lower.indexOf(needle, offset);
    if (index < 0) {
      result += source.slice(offset);
      break;
    }
    result += source.slice(offset, index) + replacement;
    offset = index + query.length;
  }
  return result;
}

function updateTextInProject(project: PresentationProject, slideId: string, elementId: string, text: string): void {
  const slide = project.slides.find((candidate) => candidate.id === slideId);
  if (!slide) return;
  const element = slide.elements.find((candidate): candidate is TextElement => candidate.id === elementId && candidate.type === "text");
  if (!element || (element.dynamicField ?? "none") !== "none") return;
  element.text = text;
}

function TextOverviewRow({ entry, overflowing, activeMatch }: {
  entry: TextEntry;
  overflowing: boolean;
  activeMatch: boolean;
}) {
  const {
    state,
    setActiveSlide,
    setSelection,
    updateSlideElement,
    beginInteraction,
    finishInteraction,
  } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const snapshotRef = useRef<PresentationProject | null>(null);
  const changedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dynamic = (entry.element.dynamicField ?? "none") !== "none";
  const displayText = dynamic ? entry.displayElement.text : entry.element.text;

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.max(34, node.scrollHeight)}px`;
  }, [displayText]);

  const jumpToText = () => {
    if (state.activeSlideId !== entry.slideId || state.editingMasterId) setActiveSlide(entry.slideId);
    setSelection([entry.element.id]);
  };

  const startEditing = () => {
    jumpToText();
    snapshotRef.current = beginInteraction();
    changedRef.current = false;
  };

  const finishEditing = () => {
    if (snapshotRef.current && changedRef.current) finishInteraction(snapshotRef.current);
    snapshotRef.current = null;
    changedRef.current = false;
  };

  const changeText = (text: string) => {
    if (dynamic) return;
    changedRef.current = true;
    updateSlideElement(entry.slideId, entry.element.id, { text }, false);
  };

  return (
    <div className={`text-overview-row ${activeMatch ? "active-match" : ""}`}>
      <div className="text-overview-row-head">
        <button type="button" className="text-overview-jump" onClick={jumpToText} title={t("Ugr\u00e1s a sz\u00f6veghez")}>
          <Icon name="text" size={13} />
          <span>{entry.element.name || t("Sz\u00f6veg")}</span>
        </button>
        <div className="text-overview-row-meta">
          {dynamic && <span className="text-overview-auto">AUTO</span>}
          {overflowing && <span className="text-overview-overflow" title={t("A sz\u00f6veg t\u00fall\u00f3g a dobozb\u00f3l")}>+</span>}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={displayText}
        readOnly={dynamic}
        spellCheck={false}
        onFocus={startEditing}
        onChange={(event) => changeText(event.currentTarget.value)}
        onBlur={finishEditing}
        className={dynamic ? "is-readonly" : ""}
        aria-label={entry.element.name || t("Sz\u00f6veg")}
      />
    </div>
  );
}

export function TextOverviewPanel() {
  const {
    state,
    setActiveSlide,
    setSelection,
    updateProject,
    setStatus,
  } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [findText, setFindText] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [overflowMap, setOverflowMap] = useState<Record<string, boolean>>({});
  const [replaceFontFrom, setReplaceFontFrom] = useState("");
  const [replaceFontTo, setReplaceFontTo] = useState("");
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  const entries = useMemo<TextEntry[]>(() => state.project.slides.flatMap((slide) =>
    slide.elements
      .filter((element): element is TextElement => element.type === "text")
      .map((element) => ({
        key: `${slide.id}:${element.id}`,
        slideId: slide.id,
        element,
        displayElement: withResolvedDynamicText(state.project, slide, element),
      })),
  ), [state.project]);

  const grouped = useMemo(() => state.project.slides.map((slide, slideIndex) => ({
    slide,
    slideIndex,
    entries: entries.filter((entry) => entry.slideId === slide.id),
  })).filter((group) => group.entries.length > 0), [entries, state.project.slides]);

  const usedFonts = useMemo(() => {
    const values = new Set<string>();
    [...state.project.slides, ...state.project.masters].forEach((container) => container.elements.forEach((element) => {
      if (element.type === "text") values.add(primaryFontFamily(element.fontFamily));
    }));
    state.project.textStyles.forEach((style) => values.add(primaryFontFamily(style.fontFamily)));
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [state.project]);

  useEffect(() => {
    if (!replaceFontFrom || !usedFonts.includes(replaceFontFrom)) setReplaceFontFrom(usedFonts[0] ?? "");
  }, [replaceFontFrom, usedFonts]);

  const loadSystemFonts = () => {
    if (systemFonts.length) return;
    void listSystemFonts().then((fonts) => setSystemFonts(Array.from(new Set(fonts)).sort((a, b) => a.localeCompare(b)))).catch(() => undefined);
  };

  const matches = useMemo(() => collectMatches(entries, findText), [entries, findText]);
  const activeMatch = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : null;

  useEffect(() => {
    setMatchIndex((current) => matches.length ? Math.min(current, matches.length - 1) : 0);
  }, [matches.length]);

  useEffect(() => {
    let frame = 0;
    let disposed = false;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const values = measureTextOverflowBatch(entries.map((entry) => entry.displayElement));
        const next: Record<string, boolean> = {};
        entries.forEach((entry, index) => { next[entry.key] = Boolean(values[index]); });
        setOverflowMap(next);
      });
    };
    measure();
    const fonts = document.fonts;
    void fonts?.ready.then(measure).catch(() => undefined);
    fonts?.addEventListener?.("loadingdone", measure);
    window.addEventListener("resize", measure);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      fonts?.removeEventListener?.("loadingdone", measure);
      window.removeEventListener("resize", measure);
    };
  }, [entries]);

  const jumpToMatch = (index: number) => {
    if (!matches.length) return;
    const normalized = (index + matches.length) % matches.length;
    const match = matches[normalized];
    setMatchIndex(normalized);
    setActiveSlide(match.slideId);
    setSelection([match.elementId]);
  };

  const changeCurrent = () => {
    if (!activeMatch || !findText) return;
    const current = entries.find((entry) => entry.key === activeMatch.entryKey);
    if (!current) return;
    const source = current.element.text;
    const next = source.slice(0, activeMatch.start) + replacementText + source.slice(activeMatch.start + activeMatch.length);
    const changedSlideId = activeMatch.slideId;
    const changedElementId = activeMatch.elementId;
    updateProject((project) => updateTextInProject(project, changedSlideId, changedElementId, next));
    setStatus(t("Sz\u00f6veg cser\u00e9lve"));
    setActiveSlide(changedSlideId);
    setSelection([changedElementId]);
  };

  const changeAll = () => {
    if (!findText || !matches.length) return;
    updateProject((project) => {
      for (const slide of project.slides) {
        for (const element of slide.elements) {
          if (element.type !== "text" || (element.dynamicField ?? "none") !== "none") continue;
          const next = replaceAllInsensitive(element.text, findText, replacementText);
          if (next !== element.text) updateTextInProject(project, slide.id, element.id, next);
        }
      }
    });
    setStatus(t("Minden tal\u00e1lat cser\u00e9lve"));
    setMatchIndex(0);
  };

  const replaceFontEverywhere = () => {
    const from = replaceFontFrom.trim().toLocaleLowerCase();
    const to = replaceFontTo.trim();
    if (!from || !to) return;
    let changedElements = 0;
    let changedStyles = 0;
    updateProject((project) => {
      [...project.slides, ...project.masters].forEach((container) => container.elements.forEach((element) => {
        if (element.type !== "text") return;
        if (primaryFontFamily(element.fontFamily).toLocaleLowerCase() !== from) return;
        element.fontFamily = to;
        changedElements += 1;
      }));
      project.textStyles.forEach((style) => {
        if (primaryFontFamily(style.fontFamily).toLocaleLowerCase() !== from) return;
        style.fontFamily = to;
        changedStyles += 1;
      });
    });
    setStatus(changedElements || changedStyles
      ? `${changedElements} szövegdoboz és ${changedStyles} szövegstílus betűtípusa lecserélve`
      : "Nem volt cserélhető szöveg");
    setReplaceFontFrom(primaryFontFamily(to));
    setReplaceFontTo("");
  };

  return (
    <div className="text-overview-panel">
      <div className="text-find-box">
        <div className="text-find-title">Find &amp; Change</div>
        <input
          value={findText}
          onChange={(event) => { setFindText(event.currentTarget.value); setMatchIndex(0); }}
          placeholder={t("Keres\u00e9s...")}
          spellCheck={false}
        />
        <input
          value={replacementText}
          onChange={(event) => setReplacementText(event.currentTarget.value)}
          placeholder={t("Csere erre...")}
          spellCheck={false}
        />
        <div className="text-find-nav">
          <button type="button" onClick={() => jumpToMatch(matchIndex - 1)} disabled={!matches.length} title={t("El\u0151z\u0151 tal\u00e1lat")}><Icon name="chevronLeft" size={14} /></button>
          <span>{matches.length ? `${Math.min(matchIndex + 1, matches.length)} / ${matches.length}` : "0 / 0"}</span>
          <button type="button" onClick={() => jumpToMatch(matchIndex + 1)} disabled={!matches.length} title={t("K\u00f6vetkez\u0151 tal\u00e1lat")}><Icon name="chevronRight" size={14} /></button>
        </div>
        <div className="text-find-actions">
          <button type="button" onClick={changeCurrent} disabled={!activeMatch}>{t("Csere")}</button>
          <button type="button" onClick={changeAll} disabled={!matches.length}>{t("Mind cser\u00e9je")}</button>
        </div>
      </div>

      <div className="font-replace-box">
        <div className="text-find-title">Replace Font</div>
        <select value={replaceFontFrom} onChange={(event) => setReplaceFontFrom(event.currentTarget.value)} disabled={!usedFonts.length}>
          {!usedFonts.length && <option value="">{t("Nincs használt betűtípus")}</option>}
          {usedFonts.map((font) => <option key={font} value={font}>{font}</option>)}
        </select>
        <input
          value={replaceFontTo}
          onFocus={loadSystemFonts}
          onChange={(event) => setReplaceFontTo(event.currentTarget.value)}
          placeholder={t("Csere betűtípus…")}
          list="preon-replace-fonts"
          spellCheck={false}
        />
        <datalist id="preon-replace-fonts">{systemFonts.map((font) => <option key={font} value={font} />)}</datalist>
        <button type="button" className="font-replace-action" onClick={replaceFontEverywhere} disabled={!replaceFontFrom || !replaceFontTo.trim()}>{t("Betűtípus cseréje")}</button>
      </div>

      <div className="text-overview-list">
        {grouped.length === 0 && <div className="text-overview-empty">{t("Nincs sz\u00f6veg a prezent\u00e1ci\u00f3ban.")}</div>}
        {grouped.map(({ slide, slideIndex, entries: slideEntries }) => (
          <section className="text-overview-slide" key={slide.id}>
            <button type="button" className={`text-overview-slide-head ${state.activeSlideId === slide.id ? "active" : ""}`} onClick={() => setActiveSlide(slide.id)}>
              <span>{slideIndex + 1}. {slide.name}</span>
              <em>{slideEntries.length}</em>
            </button>
            <div className="text-overview-slide-rows">
              {slideEntries.map((entry) => (
                <TextOverviewRow
                  key={entry.key}
                  entry={entry}
                  overflowing={Boolean(overflowMap[entry.key])}
                  activeMatch={Boolean(activeMatch && activeMatch.entryKey === entry.key)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
