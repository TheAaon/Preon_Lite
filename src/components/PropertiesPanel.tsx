import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useEditor, type AlignReference } from "../EditorContext";
import type {
  AnimationKind,
  AnimationTrigger,
  BackgroundSettings,
  FitMode,
  MediaMaskKind,
  GridSettings,
  FontFileRecord,
  ImageElement,
  SlideshowElement,
  PdfElement,
  SlideElement,
  TextElement,
  VideoElement,
  WebElement,
  ShapeElement,
  Model3DElement,
  Model3DInteraction,
  DynamicTextField,
  SlideNumberFormat,
  Slide,
  ElementScrollBehavior,
  TextStyleRecord,
} from "../types";
import { activateLocalFontFamily, listSystemFonts, listSystemFontFiles, requestLocalFontsAccess, supportsLocalFontAccess } from "../platform";
import { assetUrl, clamp, newId, round } from "../utils";
import { Icon } from "./Icon";
import { resolvedMasterGrid, resolvedSlideGrid, wouldCreateMasterCycle } from "../masterResolver";
import { tr, uiText } from "../i18n";
import { normalizedScrollMotion } from "../scrollEffects";
import { elementStyleSignature, normalizedElementEffects, primaryElementColor, primaryFontFamily } from "../elementAppearance";

const textStyleFromElement = (element: TextElement, id: string, name: string): TextStyleRecord => ({
  id,
  name,
  fontFamily: element.fontFamily,
  fontSize: element.fontSize,
  fontWeight: element.fontWeight,
  fontStyle: element.fontStyle ?? "normal",
  textDecoration: element.textDecoration ?? "none",
  strikethrough: Boolean(element.strikethrough),
  textTransform: element.textTransform === "uppercase" ? "uppercase" : "none",
  fontVariantCaps: element.fontVariantCaps === "small-caps" ? "small-caps" : "normal",
  baselineMode: element.baselineMode === "super" ? "super" : element.baselineMode === "sub" ? "sub" : "normal",
  baselineShift: element.baselineShift ?? 0,
  ligatures: element.ligatures !== false,
  lineHeight: element.lineHeight,
  lineHeightAuto: element.lineHeightAuto === true,
  letterSpacing: element.letterSpacing,
  letterSpacingAuto: element.letterSpacingAuto === true,
  paragraphSpacingBefore: element.paragraphSpacingBefore ?? 0,
  paragraphSpacingAfter: element.paragraphSpacingAfter ?? 0,
  firstLineIndent: element.firstLineIndent ?? 0,
  color: element.color,
  textAlign: element.textAlign,
});

const textStylePatch = (style: TextStyleRecord): Partial<TextElement> => ({
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  fontWeight: style.fontWeight,
  fontStyle: style.fontStyle,
  textDecoration: style.textDecoration,
  strikethrough: style.strikethrough,
  textTransform: style.textTransform,
  fontVariantCaps: style.fontVariantCaps,
  baselineMode: style.baselineMode,
  baselineShift: style.baselineShift,
  ligatures: style.ligatures,
  lineHeight: style.lineHeight,
  lineHeightAuto: style.lineHeightAuto,
  letterSpacing: style.letterSpacing,
  letterSpacingAuto: style.letterSpacingAuto,
  paragraphSpacingBefore: style.paragraphSpacingBefore,
  paragraphSpacingAfter: style.paragraphSpacingAfter,
  firstLineIndent: style.firstLineIndent,
  color: style.color,
  textAlign: style.textAlign,
});

let systemFontCache: string[] | null = null;
let systemFontPromise: Promise<string[]> | null = null;
let localFontAccessAttempted = false;
let systemFontFileCache: FontFileRecord[] | null = null;
let systemFontFilePromise: Promise<FontFileRecord[]> | null = null;
const FONT_FAMILY_STORAGE_KEY = "preon.font-families.v1";

function normalizeFontFamilies(items: string[]): string[] {
  return Array.from(new Set(items
    .map((font) => font?.trim())
    .filter((font): font is string => Boolean(font) && !font.startsWith("."))))
    .sort((a, b) => a.localeCompare(b));
}

function storedFontFamilies(): string[] {
  try {
    const raw = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeFontFamilies(parsed.filter((item): item is string => typeof item === "string")) : [];
  } catch {
    return [];
  }
}

function persistFontFamilies(items: string[]) {
  try { localStorage.setItem(FONT_FAMILY_STORAGE_KEY, JSON.stringify(items)); } catch { /* optional cache */ }
}

function setSystemFontFamilyCache(items: string[]): string[] {
  const normalized = normalizeFontFamilies(items);
  if (normalized.length) {
    systemFontCache = normalized;
    persistFontFamilies(normalized);
  }
  return systemFontCache ?? normalized;
}

function getSystemFontFilesCached(): Promise<FontFileRecord[]> {
  if (systemFontFileCache) return Promise.resolve(systemFontFileCache);
  if (!systemFontFilePromise) {
    systemFontFilePromise = listSystemFontFiles()
      .then((items) => {
        systemFontFileCache = items.filter((item) => Boolean(item.family?.trim()) && !item.family.trim().startsWith("."));
        // A részletes scan ugyanazokat a fontfájlokat már végigolvasta, ezért ebből
        // frissítjük a family cache-t is. Így egy picker-nyitásnál nem fut két teljes scan.
        setSystemFontFamilyCache(systemFontFileCache.map((item) => item.family));
        return systemFontFileCache;
      })
      .catch(() => { systemFontFileCache = []; return []; });
  }
  return systemFontFilePromise;
}

function getSystemFontsCached(): Promise<string[]> {
  if (systemFontCache?.length) return Promise.resolve(systemFontCache);
  const stored = storedFontFamilies();
  if (stored.length) {
    // A legutóbbi lista azonnal használható. Nem indítunk mellette még egy háttér
    // font-scan-t, mert az érezhető I/O/CPU tüskét okozott az inspector megnyitásakor.
    systemFontCache = stored;
    return Promise.resolve(stored);
  }
  if (!systemFontPromise) {
    systemFontPromise = listSystemFonts()
      .then((items) => setSystemFontFamilyCache(items))
      .catch(() => {
        systemFontCache = systemFontCache ?? [];
        return systemFontCache;
      });
  }
  return systemFontPromise;
}

const INSPECTOR_SECTION_STORAGE_KEY = "preon.inspector.sections.v1";

function loadInspectorSectionState(): Map<string, boolean> {
  try {
    const raw = localStorage.getItem(INSPECTOR_SECTION_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return new Map(Object.entries(parsed).filter(([, value]) => typeof value === "boolean") as Array<[string, boolean]>);
  } catch {
    return new Map();
  }
}

const inspectorSectionOpenState = loadInspectorSectionState();
const inspectorScrollPosition = new Map<string, number>();

function persistInspectorSectionState() {
  try {
    localStorage.setItem(INSPECTOR_SECTION_STORAGE_KEY, JSON.stringify(Object.fromEntries(inspectorSectionOpenState)));
  } catch {
    // UI preference only; the inspector still works without persistence.
  }
}

function InspectorSection({ title, icon, children, stateKey }: {
  title: string;
  icon?: Parameters<typeof Icon>[0]["name"];
  children: ReactNode;
  stateKey?: string;
}) {
  const key = stateKey ?? title;
  const [open, setOpen] = useState(() => inspectorSectionOpenState.get(key) ?? false);
  useEffect(() => {
    setOpen(inspectorSectionOpenState.get(key) ?? false);
  }, [key]);
  return (
    <details
      className="inspector-section"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        inspectorSectionOpenState.set(key, next);
        persistInspectorSectionState();
        if (next !== open) setOpen(next);
      }}
    >
      <summary>
        <span>{icon && <Icon name={icon} size={15} />}{uiText(title)}</span>
        <Icon name="chevronDown" size={14} />
      </summary>
      <div className="inspector-section-body">{children}</div>
    </details>
  );
}

function parseLocalizedNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, "").replace(/,/g, ".");
  if (!normalized || normalized === "-" || normalized === "+" || normalized === "." || normalized === "-." || normalized === "+.") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function boundNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (Number.isFinite(min)) next = Math.max(min as number, next);
  if (Number.isFinite(max)) next = Math.min(max as number, next);
  return next;
}

function formatEditableNumber(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return "0";
  return String(round(value, precision));
}

function EditableNumberInput({ value, onChange, min, max, step = 1, placeholder, className, displayScale = 1, auto = false, onAutoChange }: {
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  displayScale?: number;
  auto?: boolean;
  onAutoChange?: (value: boolean) => void;
}) {
  const displayValue = value === null ? "" : formatEditableNumber(value * displayScale);
  const [draft, setDraft] = useState(auto ? uiText("Auto") : displayValue);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(auto ? uiText("Auto") : displayValue);
  }, [auto, displayValue]);

  const applyRaw = (raw: string, commit = false) => {
    if (raw.trim().toLocaleLowerCase() === uiText("Auto").toLocaleLowerCase() && onAutoChange) {
      onAutoChange(true);
      setDraft(uiText("Auto"));
      return;
    }
    const trimmed = raw.trim();
    const parsed = parseLocalizedNumber(raw);
    const unfinishedDecimal = !commit && /^[+-]?\d+[.,]$/.test(trimmed);
    if (parsed === null || unfinishedDecimal) {
      if (commit) setDraft(auto ? uiText("Auto") : displayValue);
      return;
    }
    const scaled = parsed / displayScale;
    const outsideLiveBounds = !commit && ((Number.isFinite(min) && scaled < (min as number)) || (Number.isFinite(max) && scaled > (max as number)));
    if (outsideLiveBounds) return;
    if (auto && onAutoChange) onAutoChange(false);
    const next = commit ? boundNumber(scaled, min, max) : scaled;
    onChange(next);
    if (commit) setDraft(formatEditableNumber(next * displayScale));
  };

  return <input
    type="text"
    inputMode="decimal"
    className={className}
    value={draft}
    placeholder={placeholder}
    onFocus={(event) => {
      focusedRef.current = true;
      const input = event.currentTarget;
      if (auto) setDraft("");
      requestAnimationFrame(() => input.select());
    }}
    onChange={(event) => {
      const raw = event.currentTarget.value;
      setDraft(raw);
      applyRaw(raw, false);
    }}
    onBlur={() => {
      focusedRef.current = false;
      applyRaw(draft, true);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyRaw(draft, true);
        event.currentTarget.blur();
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const parsed = parseLocalizedNumber(draft);
        const current = parsed === null ? ((value ?? 0) * displayScale) : parsed;
        const delta = step * displayScale * (event.key === "ArrowUp" ? 1 : -1);
        const next = boundNumber((current + delta) / displayScale, min, max);
        if (auto && onAutoChange) onAutoChange(false);
        onChange(next);
        setDraft(formatEditableNumber(next * displayScale));
      }
    }}
  />;
}

function NumberField({ label, value, onChange, min, max, step = 1, suffix }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="field number-field">
      <span title={uiText(label)}>{uiText(label)}</span>
      <div className="field-input-wrap">
        <EditableNumberInput value={value} min={min} max={max} step={step} onChange={onChange} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function ComboNumberField({ label, value, onChange, min, max, step = 1, suffix, presets, displayScale = 1, auto = false, onAutoChange }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  presets: Array<{ label: string; value?: number; auto?: boolean }>;
  displayScale?: number;
  auto?: boolean;
  onAutoChange?: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="field number-field combo-number-field">
      <span title={uiText(label)}>{uiText(label)}</span>
      <div className="combo-number-control" ref={rootRef}>
        <div className="field-input-wrap">
          <EditableNumberInput
            value={value}
            min={min}
            max={max}
            step={step}
            displayScale={displayScale}
            auto={auto}
            onAutoChange={onAutoChange}
            onChange={onChange}
          />
          {suffix && <em>{suffix}</em>}
        </div>
        <button type="button" className="combo-number-toggle" title={uiText("Gyors értékek")} aria-label={uiText("Gyors értékek")} onClick={() => setOpen((current) => !current)}><Icon name="chevronDown" size={12}/></button>
        {open && <div className="combo-number-menu">
          {presets.map((preset, index) => <button
            type="button"
            key={`${preset.label}-${index}`}
            className={(preset.auto && auto) || (!preset.auto && !auto && preset.value !== undefined && Math.abs(value - preset.value) < 0.0001) ? "active" : ""}
            onClick={() => {
              if (preset.auto) onAutoChange?.(true);
              else if (preset.value !== undefined) {
                onAutoChange?.(false);
                onChange(boundNumber(preset.value, min, max));
              }
              setOpen(false);
            }}
          >{uiText(preset.label)}</button>)}
        </div>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field text-field">
      <span title={uiText(label)}>{uiText(label)}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function BufferedTextarea({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <label className="field textarea-field">
      <span title={uiText("Tartalom")}>{uiText("Tartalom")}</span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function RangeNumberField({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field range-number-field">
      <span title={uiText(label)}>{uiText(label)}</span>
      <div className="range-number-control">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} />
        <div className="compact-number-wrap field-input-wrap">
          <EditableNumberInput value={value} min={min} max={max} step={step} onChange={onChange} />
          {suffix && <em>{suffix}</em>}
        </div>
      </div>
    </div>
  );
}

function SelectField<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="field select-field">
      <span title={uiText(label)}>{uiText(label)}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{uiText(option.label)}</option>)}
      </select>
    </label>
  );
}



type FontExportIndicator = { symbol: string; className: string; tooltip: string };

const UNKNOWN_FONT_INDICATOR: FontExportIndicator = { symbol: "?", className: "unknown", tooltip: uiText("HTML export státusz nem állapítható meg") };

function buildFontExportIndicatorMap(records: FontFileRecord[]): Map<string, FontExportIndicator> {
  const groups = new Map<string, { count: number; embeddable: number; webFile: number }>();
  for (const record of records) {
    const key = record.family.trim().toLocaleLowerCase();
    if (!key) continue;
    const group = groups.get(key) ?? { count: 0, embeddable: 0, webFile: 0 };
    group.count += 1;
    if (record.embeddable) group.embeddable += 1;
    if (record.format === "ttf" || record.format === "otf") group.webFile += 1;
    groups.set(key, group);
  }
  const result = new Map<string, FontExportIndicator>();
  groups.forEach((group, key) => {
    if (group.embeddable === group.count) result.set(key, { symbol: "✓", className: "embedded", tooltip: uiText("HTML exportba beágyazható") });
    else if (group.embeddable > 0) result.set(key, { symbol: "⚠", className: "restricted", tooltip: uiText("Egyes betűváltozatok beágyazhatók, mások nem") });
    else if (group.webFile > 0) result.set(key, { symbol: "⚠", className: "restricted", tooltip: uiText("HTML exportba nem ágyazható – outline vagy fallback szükséges") });
    else result.set(key, { symbol: "○", className: "system", tooltip: uiText("Rendszerfont / fontgyűjtemény – más gépen hiányozhat") });
  });
  return result;
}

const FONT_ROW_HEIGHT = 34;
const FONT_LIST_HEIGHT = 260;
const FONT_LIST_OVERSCAN = 5;

function FontPicker({
  value,
  recentFonts,
  favoriteFonts,
  onPreview,
  onCommit,
  onCancel,
  onToggleFavorite,
  mixed = false,
}: {
  value: string;
  mixed?: boolean;
  recentFonts: string[];
  favoriteFonts: string[];
  onPreview: (value: string) => void;
  onCommit: (value: string, original: string) => void;
  onCancel: (original: string) => void;
  onToggleFavorite: (value: string) => void;
}) {
  const [fonts, setFonts] = useState<string[]>([]);
  const [records, setRecords] = useState<FontFileRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "recent" | "favorites">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [listScrollTop, setListScrollTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);
  const hoverPreviewTimerRef = useRef<number | null>(null);
  const metadataTimerRef = useRef<number | null>(null);
  const originalRef = useRef(value);
  const committedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void getSystemFontsCached()
      .then((fontItems) => {
        if (!active) return;
        setFonts(fontItems.filter((font) => Boolean(font.trim()) && !font.trim().startsWith(".")));
      })
      .catch(() => setFonts([]));
    if (systemFontPromise) {
      void systemFontPromise.then((fontItems) => {
        if (active) setFonts(fontItems);
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, []);

  const ensureFontMetadata = () => {
    if (records.length || systemFontFileCache?.length) {
      if (!records.length && systemFontFileCache) setRecords(systemFontFileCache);
      return;
    }
    void (async () => {
      // Első futáskor a family lekérés ugyanazt a natív részletes cache-t építi.
      // Várjuk meg, hogy ne induljon vele párhuzamosan egy második teljes scan.
      if (systemFontPromise && !systemFontFileCache) await systemFontPromise.catch(() => []);
      const items = await getSystemFontFilesCached();
      setRecords(items);
      if (systemFontCache?.length) setFonts(systemFontCache);
    })().catch(() => setRecords([]));
  };

  const sourceFonts = useMemo(() => {
    if (filter === "recent") return recentFonts.filter((font) => fonts.includes(font));
    if (filter === "favorites") return favoriteFonts.filter((font) => fonts.includes(font));
    return fonts;
  }, [favoriteFonts, filter, fonts, recentFonts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const items = q ? sourceFonts.filter((font) => font.toLocaleLowerCase().includes(q)) : sourceFonts;
    return Array.from(new Set(items.filter((font) => !font.trim().startsWith("."))));
  }, [query, sourceFonts]);

  const indicatorMap = useMemo(() => buildFontExportIndicatorMap(records), [records]);
  const favoriteSet = useMemo(() => new Set(favoriteFonts), [favoriteFonts]);
  const visibleStart = Math.max(0, Math.floor(listScrollTop / FONT_ROW_HEIGHT) - FONT_LIST_OVERSCAN);
  const visibleCount = Math.ceil(FONT_LIST_HEIGHT / FONT_ROW_HEIGHT) + FONT_LIST_OVERSCAN * 2;
  const visibleEnd = Math.min(filtered.length, visibleStart + visibleCount);
  const visibleFonts = filtered.slice(visibleStart, visibleEnd);

  useEffect(() => {
    if (!open || !supportsLocalFontAccess()) return;
    visibleFonts.forEach((font) => { void activateLocalFontFamily(font, false); });
  }, [open, visibleFonts]);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, filtered.findIndex((font) => font === value));
    setActiveIndex(index >= 0 ? index : 0);
  }, [filtered, open, value]);

  useEffect(() => {
    if (!open || !listRef.current || !filtered.length) return;
    const list = listRef.current;
    const itemTop = activeIndex * FONT_ROW_HEIGHT;
    const itemBottom = itemTop + FONT_ROW_HEIGHT;
    if (itemTop < list.scrollTop) list.scrollTop = itemTop;
    else if (itemBottom > list.scrollTop + FONT_LIST_HEIGHT) list.scrollTop = itemBottom - FONT_LIST_HEIGHT;
  }, [activeIndex, filtered.length, open]);

  const cancelHoverPreview = () => {
    if (hoverPreviewTimerRef.current !== null) {
      window.clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }
  };

  const cancelMetadataTimer = () => {
    if (metadataTimerRef.current !== null) {
      window.clearTimeout(metadataTimerRef.current);
      metadataTimerRef.current = null;
    }
  };

  const closeAndCancel = () => {
    cancelHoverPreview();
    cancelMetadataTimer();
    if (!committedRef.current) onCancel(originalRef.current);
    setOpen(false);
    setQuery("");
    setFilter("all");
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeAndCancel();
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => () => {
    cancelHoverPreview();
    cancelMetadataTimer();
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const queueHoverPreview = (font: string) => {
    cancelHoverPreview();
    // A live font preview megmarad, de nem fut le minden gyors egérátlépésnél.
    // Ez különösen sok telepített fontnál és auto-size textboxnál csökkenti a mikroszaggatást.
    hoverPreviewTimerRef.current = window.setTimeout(() => {
      hoverPreviewTimerRef.current = null;
      onPreview(font);
      void activateLocalFontFamily(font, true);
    }, 90);
  };

  const handleListScroll = (scrollTop: number) => {
    pendingScrollTopRef.current = scrollTop;
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      setListScrollTop(pendingScrollTopRef.current);
    });
  };

  const openPicker = () => {
    originalRef.current = value;
    committedRef.current = false;
    setQuery("");
    setFilter("all");
    setListScrollTop(0);
    setOpen(true);

    // Chrome/Edge alatt az első kattintásból kérjük a Local Font Access engedélyt.
    // Így a böngésző nem kér jogosultságot már az app indulásakor.
    if (supportsLocalFontAccess() && !localFontAccessAttempted) {
      localFontAccessAttempted = true;
      void requestLocalFontsAccess().then(async (fontItems) => {
        const normalized = setSystemFontFamilyCache(fontItems);
        setFonts(normalized);
        systemFontFilePromise = null;
        const metadata = await listSystemFontFiles();
        systemFontFileCache = metadata;
        setRecords(metadata);
        void activateLocalFontFamily(value.split(",")[0].trim().replace(/["']/g, ""), true);
      }).catch(() => {
        // Ha a felhasználó nem engedélyezi, a beépített böngészős fontlista marad.
      });
    }

    // A fontfájl/embedding metaadat jóval drágább, mint a családlista. A picker
    // ezért azonnal megnyílik, a részletes scan pedig csak egy rövid késleltetés
    // után indul. Így maga a kattintás/nyitás nem versenyez a font I/O-val.
    cancelMetadataTimer();
    metadataTimerRef.current = window.setTimeout(() => {
      metadataTimerRef.current = null;
      ensureFontMetadata();
    }, 160);
  };

  const previewIndex = (index: number) => {
    if (!filtered.length) return;
    const safe = (index + filtered.length) % filtered.length;
    setActiveIndex(safe);
    onPreview(filtered[safe]);
    void activateLocalFontFamily(filtered[safe], true);
  };

  const commitFont = (font: string) => {
    cancelHoverPreview();
    cancelMetadataTimer();
    committedRef.current = true;
    onCommit(font, originalRef.current);
    void activateLocalFontFamily(font, true);
    setOpen(false);
    setQuery("");
    setFilter("all");
  };
  const primaryValue = value.split(",")[0].trim().replace(/["']/g, "");
  const currentIndicator = indicatorMap.get(primaryValue.toLocaleLowerCase()) ?? UNKNOWN_FONT_INDICATOR;

  return (
    <div className="field font-picker-field" ref={rootRef}>
      <span title={uiText("Betűcsalád")}>{uiText("Betűcsalád")}</span>
      <button type="button" className="font-picker-trigger" onClick={() => open ? closeAndCancel() : openPicker()} style={{ fontFamily: mixed ? undefined : value }} title={mixed ? uiText("Vegyes") : value}>
        <span>{mixed ? uiText("Vegyes") : primaryValue}</span>
        {!mixed && <span className={`font-export-status ${currentIndicator.className}`} title={currentIndicator.tooltip} aria-label={currentIndicator.tooltip}>{currentIndicator.symbol}</span>}
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="font-picker-popover" onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); previewIndex(activeIndex + 1); }
          if (event.key === "ArrowUp") { event.preventDefault(); previewIndex(activeIndex - 1); }
          if (event.key === "Enter") { event.preventDefault(); if (filtered[activeIndex]) commitFont(filtered[activeIndex]); }
          if (event.key === "Escape") { event.preventDefault(); closeAndCancel(); }
        }}>
          <input autoFocus className="font-search" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setActiveIndex(0); }} placeholder={uiText("Betűtípus keresése…")} />
          <div className="font-picker-filters">
            <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{uiText("Összes")}</button>
            <button type="button" className={filter === "recent" ? "active" : ""} onClick={() => setFilter("recent")}>{uiText("Legutóbbi")}</button>
            <button type="button" className={filter === "favorites" ? "active" : ""} onClick={() => setFilter("favorites")}>{uiText("Kedvencek")}</button>
          </div>
          <div ref={listRef} className="font-picker-list" onScroll={(event) => handleListScroll(event.currentTarget.scrollTop)} onPointerLeave={cancelHoverPreview}>
            {filtered.length ? <div className="font-picker-virtual" style={{ height: filtered.length * FONT_ROW_HEIGHT }}>
              {visibleFonts.map((font, offset) => {
              const index = visibleStart + offset;
              const indicator = indicatorMap.get(font.toLocaleLowerCase()) ?? UNKNOWN_FONT_INDICATOR;
              const favorite = favoriteSet.has(font);
              return <div key={font} className={`font-picker-row ${index === activeIndex ? "keyboard-active" : ""}`} style={{ top: index * FONT_ROW_HEIGHT }} onPointerEnter={() => queueHoverPreview(font)}>
                <button type="button" className={`font-picker-font ${!mixed && font === value ? "active" : ""}`} style={{ fontFamily: `"${font.replace(/"/g, "\\\"")}"` }} onClick={() => commitFont(font)}>
                  <span>{font}</span>
                  <span className="font-row-icons">
                    <span className={`font-export-status ${indicator.className}`} title={indicator.tooltip} aria-label={indicator.tooltip}>{indicator.symbol}</span>
                    {!mixed && font === value && <Icon name="check" size={13} />}
                  </span>
                </button>
                <button type="button" className={`font-favorite ${favorite ? "active" : ""}`} title={uiText(favorite ? "Eltávolítás a kedvencekből" : "Hozzáadás a kedvencekhez")} onClick={(event) => { event.stopPropagation(); onToggleFavorite(font); }}>{favorite ? "★" : "☆"}</button>
              </div>;
            })}</div> : <div className="font-picker-empty">{uiText("Nem található betűtípus.")}</div>}
          </div>
          <div className="font-picker-footer"><span>{fonts.length ? `${fonts.length} ${uiText("telepített betűcsalád")}` : uiText("Betűtípusok betöltése…")}</span><span>↑ ↓ · Enter · Esc</span></div>
        </div>
      )}
    </div>
  );
}

function FontVariantPicker({ family, weight, italic, onChange }: {
  family: string;
  weight: number;
  italic: boolean;
  onChange: (weight: number, italic: boolean) => void;
}) {
  const [records, setRecords] = useState<FontFileRecord[]>(() => systemFontFileCache ?? []);
  const [loading, setLoading] = useState(false);
  const loadVariants = () => {
    if (records.length || loading) return;
    setLoading(true);
    void getSystemFontFilesCached()
      .then((items) => setRecords(items))
      .finally(() => setLoading(false));
  };
  const primary = family.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || family;
  const variants = useMemo(() => {
    const matching = records.filter((record) => record.family.toLowerCase() === primary.toLowerCase());
    const unique = new Map<string, FontFileRecord>();
    matching.forEach((record) => unique.set(`${record.weight}-${record.italic}`, record));
    return [...unique.values()].sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
  }, [primary, records]);
  const current = `${Math.round(weight / 100) * 100}-${italic}`;
  return (
    <label className="field select-field">
      <span title={uiText("Telepített változat")}>{uiText("Telepített változat")}</span>
      <select
        value={variants.some((variant) => `${variant.weight}-${variant.italic}` === current) ? current : ""}
        onFocus={loadVariants}
        onPointerDown={loadVariants}
        onChange={(event) => {
        const selected = variants.find((variant) => `${variant.weight}-${variant.italic}` === event.currentTarget.value);
        if (selected) onChange(selected.weight, selected.italic);
      }}>
        <option value="">{loading ? uiText("Betűtípusok betöltése…") : uiText("Egyéni / szintetikus")}</option>
        {variants.map((variant) => <option key={`${variant.path}-${variant.weight}-${variant.italic}`} value={`${variant.weight}-${variant.italic}`}>{variant.styleName}</option>)}
      </select>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <label className="field color-field">
      <span title={uiText(label)}>{uiText(label)}</span>
      <div className="color-control">
        <input type="color" value={safeValue} onChange={(event) => onChange(event.currentTarget.value)} />
        <input value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      </div>
    </label>
  );
}

function MixedColorField({ label, value, fallback, onChange }: { label: string; value: string | null; fallback: string; onChange: (value: string) => void }) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(value ?? "") ? (value as string) : (/^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#000000");
  return (
    <label className="field color-field">
      <span title={uiText(label)}>{uiText(label)}{value === null ? <em className="mixed-indicator"> · {uiText("Vegyes")}</em> : null}</span>
      <div className="color-control">
        <input type="color" value={safeValue} onChange={(event) => onChange(event.currentTarget.value)} />
        <input value={value ?? ""} placeholder={uiText("Vegyes")} onChange={(event) => onChange(event.currentTarget.value)} />
      </div>
    </label>
  );
}

function ToggleField({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle-field" title={hint ? uiText(hint) : undefined}>
      <span>{uiText(label)}</span>
      <button type="button" className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}


function ScrollMotionControls({ behavior, onChange }: {
  behavior: ElementScrollBehavior;
  onChange: (value: ElementScrollBehavior) => void;
}) {
  const motion = normalizedScrollMotion(behavior.motion);
  const patchMotion = (patch: Partial<typeof motion>) => onChange({ ...behavior, motion: { ...motion, ...patch } });
  return (
    <div className="scroll-motion-controls">
      <ToggleField
        label="Scroll animáció"
        checked={motion.enabled}
        onChange={(enabled) => patchMotion({ enabled })}
        hint="A megadott scroll-tartomány alatt egyszerű opacity, scale és pozíció változást vezérel."
      />
      {motion.enabled && (
        <>
          <div className="subsection-label">{uiText("Opacity")}</div>
          <div className="two-column-fields">
            <NumberField label="Kezdet" value={motion.opacityFrom * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => patchMotion({ opacityFrom: clamp(value / 100, 0, 1) })} />
            <NumberField label="Vég" value={motion.opacityTo * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => patchMotion({ opacityTo: clamp(value / 100, 0, 1) })} />
          </div>
          <div className="subsection-label">{uiText("Scale")}</div>
          <div className="two-column-fields">
            <NumberField label="Kezdet" value={motion.scaleFrom * 100} min={10} max={400} step={1} suffix="%" onChange={(value) => patchMotion({ scaleFrom: clamp(value / 100, 0.1, 4) })} />
            <NumberField label="Vég" value={motion.scaleTo * 100} min={10} max={400} step={1} suffix="%" onChange={(value) => patchMotion({ scaleTo: clamp(value / 100, 0.1, 4) })} />
          </div>
          <div className="subsection-label">{uiText("Pozícióeltolás")}</div>
          <div className="two-column-fields">
            <NumberField label="X kezdet" value={motion.offsetXFrom} min={-5000} max={5000} step={1} suffix="px" onChange={(value) => patchMotion({ offsetXFrom: clamp(value, -5000, 5000) })} />
            <NumberField label="X vég" value={motion.offsetXTo} min={-5000} max={5000} step={1} suffix="px" onChange={(value) => patchMotion({ offsetXTo: clamp(value, -5000, 5000) })} />
            <NumberField label="Y kezdet" value={motion.offsetYFrom} min={-5000} max={5000} step={1} suffix="px" onChange={(value) => patchMotion({ offsetYFrom: clamp(value, -5000, 5000) })} />
            <NumberField label="Y vég" value={motion.offsetYTo} min={-5000} max={5000} step={1} suffix="px" onChange={(value) => patchMotion({ offsetYTo: clamp(value, -5000, 5000) })} />
          </div>
          <div className="inline-actions scroll-motion-presets">
            <button type="button" onClick={() => onChange({ ...behavior, motion: { ...motion, enabled: true, opacityFrom: 0, opacityTo: 1, scaleFrom: 0.96, scaleTo: 1, offsetXFrom: 0, offsetXTo: 0, offsetYFrom: 60, offsetYTo: 0 } })}>{uiText("Fade up")}</button>
            <button type="button" onClick={() => onChange({ ...behavior, motion: { ...motion, enabled: true, opacityFrom: 1, opacityTo: 1, scaleFrom: 0.78, scaleTo: 1, offsetXFrom: 0, offsetXTo: 0, offsetYFrom: 0, offsetYTo: 0 } })}>{uiText("Zoom in")}</button>
            <button type="button" onClick={() => onChange({ ...behavior, motion: { ...motion, enabled: true, opacityFrom: 1, opacityTo: 1, scaleFrom: 1, scaleTo: 1, offsetXFrom: 180, offsetXTo: 0, offsetYFrom: 0, offsetYTo: 0 } })}>{uiText("Slide in")}</button>
          </div>
          <div className="inline-hint">{uiText("A scroll animáció ugyanazt a tartományt használja, mint a Sticky, a videó scrub vagy a 3D scroll. PDF-ben a szerkesztett alapállapot marad statikus.")}</div>
        </>
      )}
    </div>
  );
}

function MixedToggleField({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean | null;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle-field" title={hint ? uiText(hint) : undefined}>
      <span>{uiText(label)}{checked === null ? <em className="mixed-indicator"> · {uiText("Vegyes")}</em> : null}</span>
      <button type="button" className={`switch ${checked === true ? "on" : ""} ${checked === null ? "mixed" : ""}`} onClick={() => onChange(checked !== true)}>
        <span />
      </button>
    </label>
  );
}


function MixedNumberField({ label, value, onChange, min, max, step = 1, suffix }: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="field number-field">
      <span title={uiText(label)}>{uiText(label)}{value === null ? <em className="mixed-indicator"> · {uiText("Vegyes")}</em> : null}</span>
      <div className="field-input-wrap">
        <EditableNumberInput value={value} placeholder={value === null ? uiText("Vegyes") : undefined} min={min} max={max} step={step} onChange={onChange} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function commonValue<T>(values: T[]): T | null {
  if (!values.length) return null;
  return values.every((value) => Object.is(value, values[0])) ? values[0] : null;
}

function VideoPosterInspector({ element, onPatch }: {
  element: VideoElement;
  onPatch: (patch: Partial<VideoElement>) => void;
}) {
  const { state } = useEditor();
  const asset = state.project.assets.find((candidate) => candidate.id === element.assetId);
  const src = assetUrl(asset);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(element.posterTime || element.startTime || 0);

  useEffect(() => {
    setTime(element.posterTime || element.startTime || 0);
  }, [element.posterTime, element.startTime]);

  const seek = (next: number) => {
    setTime(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    try {
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onPatch({ posterTime: time, posterDataUrl: canvas.toDataURL("image/jpeg", 0.9) });
    } catch {
      // Egyes külső források a böngésző CORS-védelme miatt nem rajzolhatók canvasra.
    }
  };

  if (!src) return <div className="inline-warning">{uiText("A videófájl nem található.")}</div>;
  return (
    <div className="video-poster-inspector">
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration || 0);
          video.currentTime = clamp(time, 0, video.duration || 0);
        }}
        onSeeked={(event) => setTime(event.currentTarget.currentTime)}
      />
      <input
        type="range"
        min={0}
        max={Math.max(0.01, duration)}
        step={0.01}
        value={clamp(time, 0, Math.max(0.01, duration))}
        onChange={(event) => seek(Number(event.currentTarget.value))}
      />
      <div className="poster-row">
        <span>{time.toFixed(2)} s</span>
        <button className="secondary-button" onClick={capture}>{uiText("Aktuális frame használata")}</button>
      </div>
      {element.posterDataUrl && <img className="poster-preview" src={element.posterDataUrl} alt="Kiválasztott videó frame" />}
    </div>
  );
}

function ShapeFillPosterInspector({ element, onPatch }: {
  element: ShapeElement;
  onPatch: (patch: Partial<ShapeElement>) => void;
}) {
  const { state } = useEditor();
  const asset = element.fillAssetId ? state.project.assets.find((candidate) => candidate.id === element.fillAssetId) : undefined;
  const src = assetUrl(asset);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(element.fillPosterTime ?? 0);
  useEffect(() => setTime(element.fillPosterTime ?? 0), [element.fillPosterTime]);
  if (!src) return <div className="inline-warning">{uiText("A videófájl nem található.")}</div>;
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onPatch({ fillPosterTime: time, fillPosterDataUrl: canvas.toDataURL("image/jpeg", 0.9) });
    } catch { /* CORS / codec */ }
  };
  return (
    <div className="video-poster-inspector">
      <video ref={videoRef} src={src} muted playsInline onLoadedMetadata={(event) => { const v=event.currentTarget; setDuration(v.duration || 0); v.currentTime = clamp(time,0,v.duration || 0); }} onSeeked={(event) => setTime(event.currentTarget.currentTime)} />
      <input type="range" min={0} max={Math.max(.01,duration)} step={.01} value={clamp(time,0,Math.max(.01,duration))} onChange={(event) => { const next=Number(event.currentTarget.value); setTime(next); if(videoRef.current) videoRef.current.currentTime=next; }} />
      <div className="poster-row"><span>{time.toFixed(2)} s</span><button className="secondary-button" type="button" onClick={capture}>{uiText("Aktuális frame használata")}</button></div>
      {element.fillPosterDataUrl && <img className="poster-preview" src={element.fillPosterDataUrl} alt="Alakzat videó poster frame" />}
    </div>
  );
}

export function PropertiesPanel({ onSetBackgroundMedia, onReplaceImage, onChooseMaskSvg, onChooseShapeMedia, onAddSlideshowImages }: {
  onSetBackgroundMedia: (kind: "image" | "video") => void;
  onReplaceImage: (elementId: string) => void;
  onChooseMaskSvg: (elementId: string) => void;
  onChooseShapeMedia: (elementId: string, kind: "image" | "video") => void;
  onAddSlideshowImages: (elementId: string) => void;
}) {
  const {
    state,
    activeContainer,
    activeSlide,
    selectedElements,
    selectedSlides,
    updateElement,
    updateElements,
    updateProject,
    updateSlides,
    updateWorkspace,
    setEditingNotesBoard,
    alignSelection,
    bakeMasterIntoSlide,
    setStatus,
    setSelection,
  } = useEditor();
  const t = (text: string) => tr(state.workspace.language, text);
  const [alignReference, setAlignReference] = useState<AlignReference>("selection");
  useEffect(() => {
    setAlignReference(selectedElements.length === 1 ? "slide" : "selection");
  }, [selectedElements.length]);
  const selected = selectedElements[0];
  const multiple = selectedElements.length > 1;
  const selectedTexts = selectedElements.filter((element): element is TextElement => element.type === "text");
  const allTextSelected = selectedElements.length > 0 && selectedTexts.length === selectedElements.length;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelScope = selected
    ? `element:${selected.type}`
    : state.editingNotesBoard
      ? "notes-board"
      : (!state.editingMasterId && selectedSlides.length > 1 ? "multi-slide" : (state.editingMasterId ? "master" : "slide"));
  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    node.scrollTop = inspectorScrollPosition.get(panelScope) ?? 0;
  }, [panelScope]);
  const rememberPanelScroll = (node: HTMLDivElement) => {
    inspectorScrollPosition.set(panelScope, node.scrollTop);
  };

  const updateContainer = (mutator: (container: typeof activeContainer) => void, recordHistory = true) => {
    const activeSlideId = state.activeSlideId;
    const editingMasterId = state.editingMasterId;
    updateProject((project) => {
      const slide = project.slides.find((candidate) => candidate.id === activeSlideId);
      const container = editingMasterId
        ? project.masters.find((master) => master.id === editingMasterId)
        : state.editingNotesBoard
          ? slide?.notesBoard
          : slide;
      if (container) mutator(container as typeof activeContainer);
    }, recordHistory);
  };

  const patchSelected = (patch: Partial<SlideElement>) => {
    if (multiple) {
      updateElements(state.selection, (element) => Object.assign(element, patch));
      return;
    }
    if (!selected) return;
    updateElement(selected.id, patch);
  };

  const patchEffects = (mutator: (effects: ReturnType<typeof normalizedElementEffects>) => void) => {
    updateElements(state.selection, (element) => {
      const effects = normalizedElementEffects(element.effects);
      mutator(effects);
      element.effects = effects;
    });
  };

  const selectSame = (mode: "type" | "font" | "size" | "color" | "style") => {
    const source = selectedElements[0];
    if (!source) return;
    const sourceColor = primaryElementColor(source);
    const sourceStyle = elementStyleSignature(source);
    const sourceFont = source.type === "text" ? primaryFontFamily(source.fontFamily).toLocaleLowerCase() : "";
    const ids = activeContainer.elements.filter((candidate) => {
      if (!candidate.visible) return false;
      if (mode === "type") return candidate.type === source.type;
      if (mode === "color") return Boolean(sourceColor) && primaryElementColor(candidate) === sourceColor;
      if (mode === "style") return candidate.type === source.type && elementStyleSignature(candidate) === sourceStyle;
      if (source.type !== "text" || candidate.type !== "text") return false;
      if (mode === "font") return primaryFontFamily(candidate.fontFamily).toLocaleLowerCase() === sourceFont;
      return candidate.fontSize === source.fontSize;
    }).map((candidate) => candidate.id);
    setSelection(ids);
    setStatus(ids.length ? `${ids.length} azonos elem kijelölve` : "Nincs egyező elem");
  };

  const createTextStyleFromSelected = (element: TextElement) => {
    const id = newId("text-style");
    const name = `${t("Szövegstílus")} ${state.project.textStyles.length + 1}`;
    const style = textStyleFromElement(element, id, name);
    updateProject((project) => {
      project.textStyles.push(style);
      const containers = [...project.slides, ...project.masters];
      containers.forEach((container) => container.elements.forEach((candidate) => {
        if (candidate.type === "text" && candidate.id === element.id) candidate.textStyleId = id;
      }));
    });
    setStatus(t("Szövegstílus létrehozva"));
  };

  const applyTextStyleToSelected = (element: TextElement, styleId: string) => {
    if (!styleId) {
      patchSelected({ textStyleId: undefined } as Partial<SlideElement>);
      return;
    }
    const style = state.project.textStyles.find((candidate) => candidate.id === styleId);
    if (!style) return;
    patchSelected({ ...textStylePatch(style), textStyleId: style.id } as Partial<SlideElement>);
  };

  const updateTextStyleFromSelected = (element: TextElement) => {
    if (!element.textStyleId) return;
    updateProject((project) => {
      const styleIndex = project.textStyles.findIndex((candidate) => candidate.id === element.textStyleId);
      if (styleIndex < 0) return;
      const previous = project.textStyles[styleIndex];
      const next = textStyleFromElement(element, previous.id, previous.name);
      project.textStyles[styleIndex] = next;
      const patch = textStylePatch(next);
      [...project.slides, ...project.masters].forEach((container) => container.elements.forEach((candidate) => {
        if (candidate.type !== "text" || candidate.textStyleId !== next.id) return;
        Object.assign(candidate, patch);
      }));
    });
    setStatus(t("Szövegstílus frissítve"));
  };

  const renameTextStyle = (styleId: string, name: string) => {
    updateProject((project) => {
      const style = project.textStyles.find((candidate) => candidate.id === styleId);
      if (style) style.name = name.trim() || t("Névtelen stílus");
    });
  };

  const deleteTextStyle = (styleId: string) => {
    updateProject((project) => {
      project.textStyles = project.textStyles.filter((candidate) => candidate.id !== styleId);
      [...project.slides, ...project.masters].forEach((container) => container.elements.forEach((candidate) => {
        if (candidate.type === "text" && candidate.textStyleId === styleId) candidate.textStyleId = undefined;
      }));
    });
    setStatus(t("Szövegstílus törölve"));
  };

  const renderMediaMaskControls = (element: ImageElement | SlideshowElement | VideoElement | PdfElement) => {
    const mask = element.mask ?? { kind: "none" as MediaMaskKind };
    const maskAsset = mask.assetId ? state.project.assets.find((candidate) => candidate.id === mask.assetId) : undefined;
    return (
      <>
        <div className="subsection-label">Maszk</div>
        <SelectField<MediaMaskKind>
          label="Forma"
          value={mask.kind}
          onChange={(kind) => patchSelected({
            mask: {
              kind,
              assetId: kind === "svg" ? mask.assetId : undefined,
              points: kind === "path" ? (mask.points?.length ? mask.points : [{x:8,y:10},{x:88,y:5},{x:96,y:54},{x:76,y:94},{x:18,y:88},{x:4,y:48}]) : undefined,
            },
          } as Partial<SlideElement>)}
          options={[
            { value: "none", label: "Nincs maszk" },
            { value: "ellipse", label: "Kör / ellipszis" },
            { value: "rounded-rect", label: "Lekerekített keret" },
            { value: "path", label: "Szabad vektormaszk" },
            { value: "svg", label: "Importált SVG maszk" },
          ]}
        />
        {mask.kind === "path" && (
          <div className="mask-svg-row">
            <button className="secondary-button wide" type="button" onClick={() => patchSelected({ mask: { kind: "path", points: [{x:8,y:10},{x:88,y:5},{x:96,y:54},{x:76,y:94},{x:18,y:88},{x:4,y:48}] } } as Partial<SlideElement>)}>Maszkpontok alaphelyzetbe</button>

          </div>
        )}
        {mask.kind === "svg" && (
          <div className="mask-svg-row">
            <button className="secondary-button wide" type="button" onClick={() => onChooseMaskSvg(element.id)}>
              <Icon name="image" size={14} /> {maskAsset ? "SVG maszk cseréje" : "SVG maszk kiválasztása"}
            </button>
            <small>{maskAsset?.name ?? "Nincs SVG kiválasztva"}</small>
          </div>
        )}

      </>
    );
  };

  const selectionBounds = useMemo(() => {
    if (!selectedElements.length) return null;
    const x = Math.min(...selectedElements.map((element) => element.x));
    const y = Math.min(...selectedElements.map((element) => element.y));
    const right = Math.max(...selectedElements.map((element) => element.x + element.width));
    const bottom = Math.max(...selectedElements.map((element) => element.y + element.height));
    return { x, y, width: right - x, height: bottom - y };
  }, [selectedElements]);

  if (!selected && !state.editingMasterId && !state.editingNotesBoard && selectedSlides.length > 1) {
    const slideIds = selectedSlides.map((slide) => slide.id);
    const masterValue = commonValue(selectedSlides.map((slide) => slide.masterId ?? "none"));
    const hiddenValue = commonValue(selectedSlides.map((slide) => slide.hidden));
    const transitionValue = commonValue(selectedSlides.map((slide) => slide.transition));
    const inheritBackground = commonValue(selectedSlides.map((slide) => slide.background.inherit));
    const backgroundColor = commonValue(selectedSlides.map((slide) => slide.background.color));
    const backgroundFit = commonValue(selectedSlides.map((slide) => slide.background.fit));
    const anyBackgroundMedia = selectedSlides.some((slide) => Boolean(slide.background.assetId));
    const firstBackgroundColor = selectedSlides[0]?.background.color ?? "#ffffff";
    return (
      <div ref={panelRef} className="properties-panel" onScroll={(event) => rememberPanelScroll(event.currentTarget)}>
        <div className="inspector-title">
          <div><Icon name="slides" /><strong>{selectedSlides.length} {t("kijelölt dia")}</strong></div>
          <span>{t("Többszörös kijelölés")}</span>
        </div>

        <InspectorSection title={t("Oldal")} icon="properties" stateKey="slide-main">
          <TextField label={t("Projekt")} value={state.project.name} onChange={(value) => updateProject((project) => { project.name = value; })} />
          <label className="field select-field">
            <span>{t("Mester")}</span>
            <select value={masterValue ?? "__mixed__"} onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === "__mixed__") return;
              updateSlides(slideIds, (slide) => { slide.masterId = value === "none" ? null : value; });
            }}>
              {masterValue === null && <option value="__mixed__" disabled>{t("Vegyes")}</option>}
              <option value="none">{t("Nincs")}</option>
              {state.project.masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}
            </select>
          </label>
          <MixedToggleField
            label={t("Dia kihagyása prezentációból")}
            checked={hiddenValue}
            onChange={(value) => updateSlides(slideIds, (slide) => { slide.hidden = value; })}
            hint="Az összes kijelölt diára alkalmazza."
          />
          <label className="field select-field">
            <span>{t("Átmenet")}</span>
            <select value={transitionValue ?? "__mixed__"} onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === "__mixed__") return;
              updateSlides(slideIds, (slide) => { slide.transition = value as Slide["transition"]; });
            }}>
              {transitionValue === null && <option value="__mixed__" disabled>{t("Vegyes")}</option>}
              <option value="none">{t("Nincs")}</option>
              <option value="fade">{t("Áttűnés")}</option>
              <option value="slide">{t("Csúszás")}</option>
            </select>
          </label>
          <div className="two-column-fields">
            <NumberField label={t("Szélesség")} value={state.project.width} suffix="px" onChange={(value) => updateProject((project) => { project.width = Math.max(320, value); })} />
            <NumberField label={t("Magasság")} value={state.project.height} suffix="px" onChange={(value) => updateProject((project) => { project.height = Math.max(240, value); })} />
          </div>
        </InspectorSection>

        <InspectorSection title={t("Háttér")} icon="image" stateKey="slide-background">
          <MixedToggleField
            label={t("Mester hátterének használata")}
            checked={inheritBackground}
            onChange={(value) => updateSlides(slideIds, (slide) => { slide.background.inherit = value; })}
          />
          <label className="field color-field">
            <span>{t("Háttérszín")}{backgroundColor === null ? <em className="mixed-indicator"> · {t("Vegyes")}</em> : null}</span>
            <div className="color-control">
              <input type="color" value={backgroundColor ?? firstBackgroundColor} onChange={(event) => { const value=event.currentTarget.value; updateSlides(slideIds, (slide) => { slide.background.color=value; slide.background.type="color"; slide.background.inherit=false; }); }} />
              <input value={backgroundColor ?? ""} placeholder={t("Vegyes")} onChange={(event) => { const value=event.currentTarget.value; updateSlides(slideIds, (slide) => { slide.background.color=value; slide.background.type="color"; slide.background.inherit=false; }); }} />
            </div>
          </label>
          <label className="field select-field">
            <span>{t("Kitöltés")}</span>
            <select value={backgroundFit ?? "__mixed__"} onChange={(event) => {
              const value=event.currentTarget.value; if(value==="__mixed__")return;
              updateSlides(slideIds,(slide)=>{slide.background.fit=value as FitMode;});
            }}>
              {backgroundFit === null && <option value="__mixed__" disabled>{t("Vegyes")}</option>}
              <option value="cover">{t("Kitöltés / vágás")}</option>
              <option value="contain">{t("Teljes tartalom")}</option>
              <option value="fill">{t("Nyújtás")}</option>
            </select>
          </label>
          <div className="button-row">
            <button className="secondary-button" onClick={() => onSetBackgroundMedia("image")}><Icon name="image" size={15} /> {t("Kép mindegyikre")}</button>
            <button className="secondary-button" onClick={() => onSetBackgroundMedia("video")}><Icon name="video" size={15} /> {t("Videó mindegyikre")}</button>
            {anyBackgroundMedia && (
              <button className="icon-only danger-quiet" title={t("Háttérmédia eltávolítása a kijelölt diákról")} onClick={() => updateSlides(slideIds, (slide) => { slide.background.assetId=undefined; slide.background.type="color"; })}><Icon name="delete" size={15} /></button>
            )}
          </div>
          <div className="inline-hint">{t("A módosítások az összes kijelölt diára egyszerre érvényesek.")}</div>
        </InspectorSection>
      </div>
    );
  }

  if (!selected && state.editingNotesBoard) {
    const background = activeContainer.background;
    const grid = activeContainer.grid;
    return (
      <div ref={panelRef} className="properties-panel" onScroll={(event) => rememberPanelScroll(event.currentTarget)}>
        <div className="inspector-title">
          <div><Icon name="notes" /><strong>{t("Előadói jegyzetlap")}</strong></div>
          <span>{activeSlide.name}</span>
        </div>
        <InspectorSection title={t("Jegyzetkártya")} icon="properties" stateKey="notes-main">
          <TextField label={t("Jegyzet neve")} value={activeContainer.name} onChange={(value) => updateContainer((container) => { container.name = value; })} />
          <SelectField<"text" | "visual">
            label={t("Jegyzet típusa")}
            value={activeContainer.mode}
            onChange={(value) => {
              updateContainer((container) => { container.mode = value; });
              if (value === "text") setEditingNotesBoard(false);
            }}
            options={[
              { value: "text", label: t("Szöveges") },
              { value: "visual", label: t("Vizuális") },
            ]}
          />
          <div className="two-column-fields">
            <NumberField label={t("Szélesség")} value={activeContainer.width} min={420} max={2400} suffix="px" onChange={(value) => updateContainer((container) => { container.width = clamp(value, 420, 2400); })} />
            <NumberField label={t("Magasság")} value={activeContainer.height} min={480} max={3200} suffix="px" onChange={(value) => updateContainer((container) => { container.height = clamp(value, 480, 3200); })} />
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={() => updateContainer((container) => { container.width = 900; container.height = 1200; })}>{t("Álló 3:4")}</button>
            <button className="secondary-button" onClick={() => updateContainer((container) => { container.width = 1200; container.height = 900; })}>{t("Fekvő 4:3")}</button>
          </div>
          <div className="inline-hint">{t("A jegyzet mérete független a diától. A szöveges jegyzet belül görgethető; a vizuális jegyzet a normál vászoneszközöket használja.")}</div>
        </InspectorSection>
        <InspectorSection title={t("Háttér")} icon="image" stateKey="notes-background">
          <ColorField label={t("Háttérszín")} value={background.color} onChange={(value) => updateContainer((container) => { container.background.color = value; container.background.type = "color"; container.background.inherit = false; })} />
          <SelectField<FitMode>
            label={t("Kitöltés")}
            value={background.fit}
            onChange={(value) => updateContainer((container) => { container.background.fit = value; })}
            options={[
              { value: "cover", label: "Kitöltés / vágás" },
              { value: "contain", label: "Teljes tartalom" },
              { value: "fill", label: "Nyújtás" },
            ]}
          />
          <div className="button-row">
            <button className="secondary-button" onClick={() => onSetBackgroundMedia("image")}><Icon name="image" size={15} /> {t("Kép")}</button>
            <button className="secondary-button" onClick={() => onSetBackgroundMedia("video")}><Icon name="video" size={15} /> {t("Videó")}</button>
            {background.assetId && <button className="icon-only danger-quiet" title={t("Háttérmédia eltávolítása")} onClick={() => updateContainer((container) => { container.background.assetId = undefined; container.background.type = "color"; })}><Icon name="delete" size={15} /></button>}
          </div>
        </InspectorSection>
        <InspectorSection title={t("Layout grid")} icon="grid" stateKey="notes-grid">
          <ToggleField label={t("Helyi grid használata")} checked={grid.enabled} onChange={(value) => { updateContainer((container) => { container.grid.enabled = value; }); if (value) updateWorkspace({ showGrid: true }); }} />
          <div className="two-column-fields">
            <NumberField label={t("Oszlop")} value={grid.columns} min={1} max={32} onChange={(value) => updateContainer((container) => { container.grid.columns = Math.max(1, Math.round(value)); })} />
            <NumberField label={t("Köz")} value={grid.gutter} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.gutter = Math.max(0, value); })} />
            <NumberField label={t("Oldalmargó")} value={grid.marginX} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.marginX = Math.max(0, value); })} />
            <NumberField label={t("Felső/alsó")} value={grid.marginY} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.marginY = Math.max(0, value); })} />
            <NumberField label={t("Alapvonal")} value={grid.baseline} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.baseline = Math.max(0, value); })} />
          </div>
        </InspectorSection>
        <InspectorSection title={t("Segédvonalak")} icon="ruler" stateKey="notes-guides">
          <div className="guide-counts">
            <span>{activeContainer.guides.vertical.length} {t("függőleges")}</span>
            <span>{activeContainer.guides.horizontal.length} {t("vízszintes")}</span>
          </div>
          <button className="secondary-button wide" onClick={() => updateContainer((container) => { container.guides = { vertical: [], horizontal: [] }; })}>{t("Oldal guide-jainak törlése")}</button>
        </InspectorSection>
      </div>
    );
  }

  if (!selected) {
    const containerName = state.editingMasterId ? "Mesteroldal" : "Dia";
    const background = activeContainer.background;
    const grid = activeContainer.grid;
    const effectiveGrid = state.editingMasterId
      ? resolvedMasterGrid(state.project, state.editingMasterId)
      : resolvedSlideGrid(state.project, activeSlide);
    return (
      <div ref={panelRef} className="properties-panel" onScroll={(event) => rememberPanelScroll(event.currentTarget)}>
        <div className="inspector-title">
          <div><Icon name={state.editingMasterId ? "masters" : "slides"} /><strong>{containerName}</strong></div>
          <span>{state.editingMasterId ? activeContainer.name : `${state.project.slides.findIndex((slide) => slide.id === activeSlide.id) + 1}/${state.project.slides.length}`}</span>
        </div>

        <InspectorSection title={t("Oldal")} icon="properties" stateKey="slide-main">
          <TextField
            label={t("Projekt")}
            value={state.project.name}
            onChange={(value) => updateProject((project) => { project.name = value; })}
          />
          <TextField
            label={t("Oldal neve")}
            value={activeContainer.name}
            onChange={(value) => updateContainer((container) => { container.name = value; })}
          />
          {state.editingMasterId && "parentMasterId" in activeContainer && (
            <>
              <SelectField
                label={t("Szülő mester")}
                value={activeContainer.parentMasterId ?? "none"}
                onChange={(value) => updateContainer((container) => {
                  if ("parentMasterId" in container) container.parentMasterId = value === "none" ? null : value;
                })}
                options={[
                  { value: "none", label: "Nincs / alap mester" },
                  ...state.project.masters
                    .filter((master) => master.id !== state.editingMasterId && !wouldCreateMasterCycle(state.project, state.editingMasterId!, master.id))
                    .map((master) => ({ value: master.id, label: master.name })),
                ]}
              />
            </>
          )}
          {!state.editingMasterId && (
            <>
              <SelectField
                label={t("Mester")}
                value={activeSlide.masterId ?? "none"}
                onChange={(value) => updateContainer((container) => {
                  if ("masterId" in container) container.masterId = value === "none" ? null : value;
                })}
                options={[
                  { value: "none", label: "Nincs" },
                  ...state.project.masters.map((master) => ({ value: master.id, label: master.name })),
                ]}
              />
              {activeSlide.masterId && (
                <>
                  <button className="secondary-button wide" type="button" title={t("A teljes mesterláncot helyi, szerkeszthető tartalommá alakítja.")} onClick={bakeMasterIntoSlide}>{t("Mester ráégetése a diára")}</button>
                </>
              )}
              <ToggleField
                label={t("Dia kihagyása prezentációból")}
                checked={activeSlide.hidden}
                onChange={(value) => updateContainer((container) => { if ("hidden" in container) container.hidden = value; })}
                hint="A dia megmarad a projektben, de Present/HTML/PDF/LAN módban kimarad."
              />
              <SelectField
                label={t("Átmenet")}
                value={activeSlide.transition}
                onChange={(value) => updateContainer((container) => {
                  if ("transition" in container) container.transition = value;
                })}
                options={[
                  { value: "none", label: "Nincs" },
                  { value: "fade", label: "Áttűnés" },
                  { value: "slide", label: "Csúszás" },
                ]}
              />
            </>
          )}
          <div className="two-column-fields">
            <NumberField label={t("Szélesség")} value={state.project.width} suffix="px" onChange={(value) => updateProject((project) => { project.width = Math.max(320, value); })} />
            <NumberField label={t("Magasság")} value={state.project.height} suffix="px" onChange={(value) => updateProject((project) => { project.height = Math.max(240, value); })} />
          </div>
        </InspectorSection>

        <InspectorSection title={t("Háttér")} icon="image" stateKey="slide-background">
          {!state.editingMasterId && (
            <ToggleField
              label={t("Mester hátterének használata")}
              checked={background.inherit}
              onChange={(value) => updateContainer((container) => { container.background.inherit = value; })}
            />
          )}
          {state.editingMasterId && "parentMasterId" in activeContainer && activeContainer.parentMasterId && (
            <ToggleField
              label={t("Szülő mester hátterének használata")}
              checked={background.inherit}
              onChange={(value) => updateContainer((container) => { container.background.inherit = value; })}
            />
          )}
          <ColorField label={t("Háttérszín")} value={background.color} onChange={(value) => updateContainer((container) => { container.background.color = value; container.background.type = "color"; container.background.inherit = false; })} />
          <SelectField<FitMode>
            label={t("Kitöltés")}
            value={background.fit}
            onChange={(value) => updateContainer((container) => { container.background.fit = value; })}
            options={[
              { value: "cover", label: "Kitöltés / vágás" },
              { value: "contain", label: "Teljes tartalom" },
              { value: "fill", label: "Nyújtás" },
            ]}
          />
          <div className="button-row">
            <button className="secondary-button" onClick={() => onSetBackgroundMedia("image")}><Icon name="image" size={15} /> {t("Kép")}</button>
            <button className="secondary-button" onClick={() => onSetBackgroundMedia("video")}><Icon name="video" size={15} /> {t("Videó")}</button>
            {background.assetId && (
              <button className="icon-only danger-quiet" title={t("Háttérmédia eltávolítása")} onClick={() => updateContainer((container) => {
                container.background.assetId = undefined;
                container.background.type = "color";
              })}><Icon name="delete" size={15} /></button>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title={t("Layout grid")} icon="grid" stateKey="layout-grid">
          {!state.editingMasterId && activeSlide.masterId && (
            <ToggleField
              label={t("Mester gridjének öröklése")}
              checked={activeSlide.inheritMasterGrid}
              onChange={(value) => updateContainer((container) => { if ("inheritMasterGrid" in container) container.inheritMasterGrid = value; })}
            />
          )}
          {state.editingMasterId && "parentMasterId" in activeContainer && activeContainer.parentMasterId && (
            <ToggleField
              label={t("Szülő gridjének öröklése")}
              checked={activeContainer.inheritParentGrid}
              onChange={(value) => updateContainer((container) => { if ("inheritParentGrid" in container) container.inheritParentGrid = value; })}
            />
          )}
          <ToggleField label={t("Helyi grid használata")} checked={grid.enabled} onChange={(value) => { updateContainer((container) => { container.grid.enabled = value; }); if (value) updateWorkspace({ showGrid: true }); }} />

          <div className="two-column-fields">
            <NumberField label={t("Oszlop")} value={grid.columns} min={1} max={32} onChange={(value) => updateContainer((container) => { container.grid.columns = Math.max(1, Math.round(value)); })} />
            <NumberField label={t("Köz")} value={grid.gutter} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.gutter = Math.max(0, value); })} />
            <NumberField label={t("Oldalmargó")} value={grid.marginX} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.marginX = Math.max(0, value); })} />
            <NumberField label={t("Felső/alsó")} value={grid.marginY} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.marginY = Math.max(0, value); })} />
            <NumberField label={t("Alapvonal")} value={grid.baseline} min={0} suffix="px" onChange={(value) => updateContainer((container) => { container.grid.baseline = Math.max(0, value); })} />
          </div>
        </InspectorSection>

        <InspectorSection title={t("Segédvonalak")} icon="ruler" stateKey="guides">
          <div className="guide-counts">
            <span>{activeContainer.guides.vertical.length} {t("függőleges")}</span>
            <span>{activeContainer.guides.horizontal.length} {t("vízszintes")}</span>
          </div>
          <button className="secondary-button wide" onClick={() => updateContainer((container) => { container.guides = { vertical: [], horizontal: [] }; })}>{t("Oldal guide-jainak törlése")}</button>

        </InspectorSection>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="properties-panel" onScroll={(event) => rememberPanelScroll(event.currentTarget)}>
      <div className="inspector-title">
        <div><Icon name={selected.type === "text" ? "text" : selected.type === "shape" ? "rect" : selected.type === "image" ? "image" : selected.type === "slideshow" ? "slideshow" : selected.type === "pdf" ? "pdf" : selected.type === "video" ? "video" : selected.type === "model3d" ? "model3d" : "web"} /><strong>{multiple ? `${selectedElements.length} elem` : selected.name}</strong></div>
        <span>{selected.type}</span>
      </div>

      <InspectorSection title={t("Pozíció és méret")} icon="move" stateKey="element-position-size">
        {selectionBounds && (
          <div className="two-column-fields">
            <NumberField label="X" value={selectionBounds.x} suffix="px" onChange={(value) => {
              const delta = value - selectionBounds.x;
              updateElements(state.selection, (element) => { element.x += delta; });
            }} />
            <NumberField label="Y" value={selectionBounds.y} suffix="px" onChange={(value) => {
              const delta = value - selectionBounds.y;
              updateElements(state.selection, (element) => { element.y += delta; });
            }} />
            {!multiple && <NumberField label="W" value={selected.width} min={1} suffix="px" onChange={(value) => patchSelected({ width: Math.max(1, value) } as Partial<SlideElement>)} />}
            {!multiple && <NumberField label="H" value={selected.height} min={1} suffix="px" onChange={(value) => patchSelected({ height: Math.max(1, value) } as Partial<SlideElement>)} />}
            {!multiple && <ComboNumberField label="Forgatás" value={selected.rotation} suffix="°" onChange={(value) => patchSelected({ rotation: value } as Partial<SlideElement>)} presets={[{ label: "0°", value: 0 }, { label: "45°", value: 45 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }]} />}
            <ComboNumberField label="Átlátszóság" value={selected.opacity * 100} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ opacity: clamp(value / 100, 0, 1) } as Partial<SlideElement>)} presets={[{ label: "100%", value: 100 }, { label: "75%", value: 75 }, { label: "50%", value: 50 }, { label: "25%", value: 25 }, { label: "0%", value: 0 }]} />
          </div>
        )}
        <ToggleField label="Zárolás" checked={selectedElements.every((element) => element.locked)} onChange={(value) => patchSelected({ locked: value } as Partial<SlideElement>)} />
      </InspectorSection>

      <InspectorSection title={t("Igazítás")} icon="alignCenter" stateKey="element-align">
        <div className="subsection-label">{t("Igazítás ehhez")}</div>
        <div className="segmented-control align-reference-control">
          <button type="button" className={alignReference === "selection" ? "active" : ""} disabled={selectedElements.length < 2} onClick={() => setAlignReference("selection")}>{t("Kijelölés")}</button>
          <button type="button" className={alignReference === "slide" ? "active" : ""} onClick={() => setAlignReference("slide")}>{t("Dia")}</button>
        </div>
        <div className="align-grid">
          <button title={t("Balra")} disabled={alignReference === "selection" && selectedElements.length < 2} onClick={() => alignSelection("left", alignReference)}><Icon name="alignLeft" /></button>
          <button title={t("Középre vízszintesen")} disabled={alignReference === "selection" && selectedElements.length < 2} onClick={() => alignSelection("center", alignReference)}><Icon name="alignCenter" /></button>
          <button title={t("Jobbra")} disabled={alignReference === "selection" && selectedElements.length < 2} onClick={() => alignSelection("right", alignReference)}><Icon name="alignRight" /></button>
          <button title={t("Felülre")} disabled={alignReference === "selection" && selectedElements.length < 2} onClick={() => alignSelection("top", alignReference)}><Icon name="alignTop" /></button>
          <button title={t("Középre függőlegesen")} disabled={alignReference === "selection" && selectedElements.length < 2} onClick={() => alignSelection("middle", alignReference)}><Icon name="alignMiddle" /></button>
          <button title={t("Alulra")} disabled={alignReference === "selection" && selectedElements.length < 2} onClick={() => alignSelection("bottom", alignReference)}><Icon name="alignBottom" /></button>
          <button title={t("Vízszintes elosztás")} disabled={selectedElements.length < 3} onClick={() => alignSelection("distribute-horizontal", "selection")}><Icon name="distributeH" /></button>
          <button title={t("Függőleges elosztás")} disabled={selectedElements.length < 3} onClick={() => alignSelection("distribute-vertical", "selection")}><Icon name="distributeV" /></button>
        </div>
      </InspectorSection>

      {!multiple && (
        <InspectorSection title={t("Azonos kijelölése")} icon="select" stateKey="select-same">
          <div className="select-same-grid">
            <button type="button" onClick={() => selectSame("type")}>{t("Objektumtípus")}</button>
            <button type="button" onClick={() => selectSame("color")}>{t("Szín")}</button>
            <button type="button" onClick={() => selectSame("style")}>{t("Stílus")}</button>
            {selected.type === "text" && <button type="button" onClick={() => selectSame("font")}>{t("Betűtípus")}</button>}
            {selected.type === "text" && <button type="button" onClick={() => selectSame("size")}>{t("Betűméret")}</button>}
          </div>
          <div className="inline-hint">{t("Az aktív dián jelöli ki az egyező elemeket.")}</div>
        </InspectorSection>
      )}

      <InspectorSection title={t("Effektek")} icon="more" stateKey="element-effects">
        {(() => {
          const effects = selectedElements.map((element) => normalizedElementEffects(element.effects));
          const dropEnabled = commonValue(effects.map((value) => value.dropShadow.enabled));
          const dropX = commonValue(effects.map((value) => value.dropShadow.offsetX));
          const dropY = commonValue(effects.map((value) => value.dropShadow.offsetY));
          const dropBlur = commonValue(effects.map((value) => value.dropShadow.blur));
          const dropOpacity = commonValue(effects.map((value) => value.dropShadow.opacity));
          const dropColor = commonValue(effects.map((value) => value.dropShadow.color));
          const blurValue = commonValue(effects.map((value) => value.blur));
          const blurEnabled = commonValue(effects.map((value) => value.blur > 0.01));
          const glowEnabled = commonValue(effects.map((value) => value.glow.enabled));
          const glowBlur = commonValue(effects.map((value) => value.glow.blur));
          const glowOpacity = commonValue(effects.map((value) => value.glow.opacity));
          const glowColor = commonValue(effects.map((value) => value.glow.color));
          return <>
            <MixedToggleField label={t("Drop Shadow")} checked={dropEnabled} onChange={(enabled) => patchEffects((value) => { value.dropShadow.enabled = enabled; })} />
            {dropEnabled !== false && <>
              <div className="two-column-fields">
                <MixedNumberField label="X" value={dropX} step={1} suffix="px" onChange={(next) => patchEffects((value) => { value.dropShadow.offsetX = next; })} />
                <MixedNumberField label="Y" value={dropY} step={1} suffix="px" onChange={(next) => patchEffects((value) => { value.dropShadow.offsetY = next; })} />
                <MixedNumberField label={t("Elmosás")} value={dropBlur} min={0} step={1} suffix="px" onChange={(next) => patchEffects((value) => { value.dropShadow.blur = Math.max(0, next); })} />
                <MixedNumberField label={t("Átlátszóság")} value={dropOpacity === null ? null : dropOpacity * 100} min={0} max={100} step={1} suffix="%" onChange={(next) => patchEffects((value) => { value.dropShadow.opacity = clamp(next / 100, 0, 1); })} />
              </div>
              <MixedColorField label={t("Árnyék színe")} value={dropColor} fallback={effects[0]?.dropShadow.color ?? "#000000"} onChange={(next) => patchEffects((value) => { value.dropShadow.color = next; })} />
            </>}

            <div className="subsection-label">{t("Blur")}</div>
            <MixedToggleField label={t("Elmosás")} checked={blurEnabled} onChange={(enabled) => patchEffects((value) => { value.blur = enabled ? Math.max(1, value.blur || 6) : 0; })} />
            {blurEnabled !== false && <MixedNumberField label={t("Mérték")} value={blurValue} min={0} max={100} step={0.5} suffix="px" onChange={(next) => patchEffects((value) => { value.blur = Math.max(0, next); })} />}

            <div className="subsection-label">{t("Glow")}</div>
            <MixedToggleField label={t("Fénylés")} checked={glowEnabled} onChange={(enabled) => patchEffects((value) => { value.glow.enabled = enabled; })} />
            {glowEnabled !== false && <>
              <div className="two-column-fields">
                <MixedNumberField label={t("Méret")} value={glowBlur} min={0} max={160} step={1} suffix="px" onChange={(next) => patchEffects((value) => { value.glow.blur = Math.max(0, next); })} />
                <MixedNumberField label={t("Átlátszóság")} value={glowOpacity === null ? null : glowOpacity * 100} min={0} max={100} step={1} suffix="%" onChange={(next) => patchEffects((value) => { value.glow.opacity = clamp(next / 100, 0, 1); })} />
              </div>
              <MixedColorField label={t("Glow színe")} value={glowColor} fallback={effects[0]?.glow.color ?? "#ffffff"} onChange={(next) => patchEffects((value) => { value.glow.color = next; })} />
            </>}
          </>;
        })()}
      </InspectorSection>

      {multiple && allTextSelected && (() => {
        const first = selectedTexts[0];
        const fontFamily = commonValue(selectedTexts.map((element) => element.fontFamily));
        const fontSize = commonValue(selectedTexts.map((element) => element.fontSize));
        const fontWeight = commonValue(selectedTexts.map((element) => element.fontWeight));
        const italic = commonValue(selectedTexts.map((element) => (element.fontStyle ?? "normal") === "italic"));
        const underline = commonValue(selectedTexts.map((element) => (element.textDecoration ?? "none") === "underline"));
        const strike = commonValue(selectedTexts.map((element) => Boolean(element.strikethrough)));
        const lineHeight = commonValue(selectedTexts.map((element) => element.lineHeight));
        const letterSpacing = commonValue(selectedTexts.map((element) => element.letterSpacing));
        const color = commonValue(selectedTexts.map((element) => element.color));
        const align = commonValue(selectedTexts.map((element) => element.textAlign));
        return (
          <InspectorSection title={t("Szöveg")} icon="text" stateKey="multi-text-format">
            <div className="inline-hint">{selectedTexts.length} {t("szövegdoboz közös formázása")}</div>
            <FontPicker
              value={fontFamily ?? first.fontFamily}
              mixed={fontFamily === null}
              recentFonts={state.workspace.recentFonts}
              favoriteFonts={state.workspace.favoriteFonts}
              onPreview={() => undefined}
              onCommit={(value) => {
                patchSelected({ fontFamily: value, textStyleId: undefined } as Partial<SlideElement>);
                updateWorkspace({ recentFonts: [value, ...state.workspace.recentFonts.filter((font) => font !== value)].slice(0, 12) });
              }}
              onCancel={() => undefined}
              onToggleFavorite={(font) => updateWorkspace({ favoriteFonts: state.workspace.favoriteFonts.includes(font) ? state.workspace.favoriteFonts.filter((item) => item !== font) : [...state.workspace.favoriteFonts, font] })}
            />
            <div className="text-format-toolbar" role="toolbar" aria-label={t("Karakterformázás")}>
              <button type="button" className={fontWeight !== null && fontWeight >= 650 ? "active" : fontWeight === null ? "mixed" : ""} onClick={() => patchSelected({ fontWeight: fontWeight !== null && fontWeight >= 650 ? 400 : 700, textStyleId: undefined } as Partial<SlideElement>)}><strong>B</strong></button>
              <button type="button" className={italic === true ? "active" : italic === null ? "mixed" : ""} onClick={() => patchSelected({ fontStyle: italic === true ? "normal" : "italic", textStyleId: undefined } as Partial<SlideElement>)}><em>I</em></button>
              <button type="button" className={underline === true ? "active" : underline === null ? "mixed" : ""} onClick={() => patchSelected({ textDecoration: underline === true ? "none" : "underline", textStyleId: undefined } as Partial<SlideElement>)}><u>U</u></button>
              <button type="button" className={strike === true ? "active" : strike === null ? "mixed" : ""} onClick={() => patchSelected({ strikethrough: strike !== true, textStyleId: undefined } as Partial<SlideElement>)}><span className="format-strike">S</span></button>
            </div>
            <div className="two-column-fields compact-text-fields">
              <MixedNumberField label={t("Méret")} value={fontSize} min={1} step={1} suffix="px" onChange={(value) => patchSelected({ fontSize: value, textStyleId: undefined } as Partial<SlideElement>)} />
              <MixedNumberField label={t("Betűvastagság")} value={fontWeight} min={100} max={900} step={10} onChange={(value) => patchSelected({ fontWeight: value, textStyleId: undefined } as Partial<SlideElement>)} />
              <MixedNumberField label={t("Sorköz")} value={lineHeight === null ? null : lineHeight * 100} min={50} max={400} step={5} suffix="%" onChange={(value) => patchSelected({ lineHeight: value / 100, lineHeightAuto: false, textStyleId: undefined } as Partial<SlideElement>)} />
              <MixedNumberField label={t("Betűköz")} value={letterSpacing} step={0.1} suffix="px" onChange={(value) => patchSelected({ letterSpacing: value, letterSpacingAuto: false, textStyleId: undefined } as Partial<SlideElement>)} />
            </div>
            <MixedColorField label={t("Szín")} value={color} fallback={first.color} onChange={(value) => patchSelected({ color: value, textStyleId: undefined } as Partial<SlideElement>)} />
            <div className="text-align-toolbar" role="toolbar" aria-label={t("Szöveg igazítása")}>
              <button type="button" className={align === "left" ? "active" : align === null ? "mixed" : ""} onClick={() => patchSelected({ textAlign: "left", textStyleId: undefined } as Partial<SlideElement>)}><Icon name="alignLeft" size={16} /></button>
              <button type="button" className={align === "center" ? "active" : align === null ? "mixed" : ""} onClick={() => patchSelected({ textAlign: "center", textStyleId: undefined } as Partial<SlideElement>)}><Icon name="alignCenter" size={16} /></button>
              <button type="button" className={align === "right" ? "active" : align === null ? "mixed" : ""} onClick={() => patchSelected({ textAlign: "right", textStyleId: undefined } as Partial<SlideElement>)}><Icon name="alignRight" size={16} /></button>
              <button type="button" className={align === "justify" ? "active" : align === null ? "mixed" : ""} onClick={() => patchSelected({ textAlign: "justify", textStyleId: undefined } as Partial<SlideElement>)}><span className="justify-icon">=</span></button>
            </div>
          </InspectorSection>
        );
      })()}

      {!multiple && selected.type === "text" && (() => {
        const element = selected as TextElement;
        const activeTextStyle = element.textStyleId ? state.project.textStyles.find((style) => style.id === element.textStyleId) : undefined;
        const decoration = element.textDecoration ?? "none";
        const baselineMode = element.baselineMode ?? "normal";
        return (
          <>
            <InspectorSection title={t("Szöveg")} icon="text" stateKey="text-content">
              <SelectField<DynamicTextField>
                label={t("Tartalom")}
                value={element.dynamicField ?? "none"}
                onChange={(value) => patchSelected({ dynamicField: value } as Partial<SlideElement>)}
                options={[
                  { value: "none", label: t("Normál szöveg") },
                  { value: "slide-number", label: t("Automatikus oldalszám") },
                  { value: "total-slides", label: t("Összes látható dia") },
                  { value: "slide-number-total", label: t("Oldalszám / összes") },
                ]}
              />
              {(element.dynamicField ?? "none") === "none" ? (
                <BufferedTextarea value={element.text} onCommit={(value) => patchSelected({ text: value } as Partial<SlideElement>)} />
              ) : (
                <>
                  <SelectField<SlideNumberFormat>
                    label={t("Számformátum")}
                    value={element.numberFormat ?? "1"}
                    onChange={(value) => patchSelected({ numberFormat: value } as Partial<SlideElement>)}
                    options={[
                      { value: "1", label: "1, 2, 3" },
                      { value: "01", label: "01, 02, 03" },
                      { value: "001", label: "001, 002, 003" },
                    ]}
                  />
                  <div className="two-column-fields">
                    <TextField label={t("Előtag")} value={element.dynamicPrefix ?? ""} onChange={(value) => patchSelected({ dynamicPrefix: value } as Partial<SlideElement>)} placeholder="pl. Slide " />
                    <TextField label={t("Utótag")} value={element.dynamicSuffix ?? ""} onChange={(value) => patchSelected({ dynamicSuffix: value } as Partial<SlideElement>)} placeholder="pl. . oldal" />
                  </div>
                </>
              )}

              <div className="subsection-label">{t("Betű")}</div>
              <FontPicker
                value={element.fontFamily}
                recentFonts={state.workspace.recentFonts}
                favoriteFonts={state.workspace.favoriteFonts}
                onPreview={(value) => {
                  updateElement(element.id, { fontFamily: value } as Partial<SlideElement>, false);
                }}
                onCommit={(value, original) => {
                  if (element.fontFamily !== original) {
                    updateElement(element.id, { fontFamily: original } as Partial<SlideElement>, false);
                  }
                  patchSelected({ fontFamily: value } as Partial<SlideElement>);
                  updateWorkspace({ recentFonts: [value, ...state.workspace.recentFonts.filter((font) => font !== value)].slice(0, 12) });
                }}
                onCancel={(original) => {
                  if (element.fontFamily === original) return;
                  updateElement(element.id, { fontFamily: original } as Partial<SlideElement>, false);
                }}
                onToggleFavorite={(font) => updateWorkspace({ favoriteFonts: state.workspace.favoriteFonts.includes(font) ? state.workspace.favoriteFonts.filter((item) => item !== font) : [...state.workspace.favoriteFonts, font] })}
              />
              <FontVariantPicker
                family={element.fontFamily}
                weight={element.fontWeight}
                italic={(element.fontStyle ?? "normal") === "italic"}
                onChange={(weight, italic) => patchSelected({ fontWeight: weight, fontStyle: italic ? "italic" : "normal" } as Partial<SlideElement>)}
              />

              <div className="text-format-toolbar" role="toolbar" aria-label={t("Karakterformázás")}>
                <button type="button" className={element.fontWeight >= 650 ? "active" : ""} title={t("Félkövér")} aria-label={t("Félkövér")} onClick={() => patchSelected({ fontWeight: element.fontWeight >= 650 ? 400 : 700 } as Partial<SlideElement>)}><strong>B</strong></button>
                <button type="button" className={(element.fontStyle ?? "normal") === "italic" ? "active" : ""} title={t("Dőlt")} aria-label={t("Dőlt")} onClick={() => patchSelected({ fontStyle: element.fontStyle === "italic" ? "normal" : "italic" } as Partial<SlideElement>)}><em>I</em></button>
                <button type="button" className={decoration === "underline" ? "active" : ""} title={t("Aláhúzott")} aria-label={t("Aláhúzott")} onClick={() => patchSelected({ textDecoration: decoration === "underline" ? "none" : "underline" } as Partial<SlideElement>)}><u>U</u></button>
                <button type="button" className={element.strikethrough ? "active" : ""} title={t("Áthúzott")} aria-label={t("Áthúzott")} onClick={() => patchSelected({ strikethrough: !element.strikethrough } as Partial<SlideElement>)}><span className="format-strike">S</span></button>
                <span className="toolbar-separator" />
                <button type="button" className={element.textTransform === "uppercase" ? "active" : ""} title={t("Nagybetűs")} aria-label={t("Nagybetűs")} onClick={() => patchSelected({ textTransform: element.textTransform === "uppercase" ? "none" : "uppercase", fontVariantCaps: element.textTransform === "uppercase" ? (element.fontVariantCaps ?? "normal") : "normal" } as Partial<SlideElement>)}>TT</button>
                <button type="button" className={element.fontVariantCaps === "small-caps" ? "active" : ""} title={t("Kiskapitális")} aria-label={t("Kiskapitális")} onClick={() => patchSelected({ fontVariantCaps: element.fontVariantCaps === "small-caps" ? "normal" : "small-caps", textTransform: element.fontVariantCaps === "small-caps" ? (element.textTransform ?? "none") : "none" } as Partial<SlideElement>)}><span className="smallcaps-icon">Tᴛ</span></button>
                <span className="toolbar-separator" />
                <button type="button" className={baselineMode === "super" ? "active" : ""} title={t("Felső index")} aria-label={t("Felső index")} onClick={() => patchSelected({ baselineMode: baselineMode === "super" ? "normal" : "super" } as Partial<SlideElement>)}>x²</button>
                <button type="button" className={baselineMode === "sub" ? "active" : ""} title={t("Alsó index")} aria-label={t("Alsó index")} onClick={() => patchSelected({ baselineMode: baselineMode === "sub" ? "normal" : "sub" } as Partial<SlideElement>)}>x₂</button>
              </div>

              <div className="two-column-fields compact-text-fields">
                <NumberField label={t("Méret")} value={element.fontSize} min={1} suffix="px" onChange={(value) => patchSelected({ fontSize: value } as Partial<SlideElement>)} />
                <ComboNumberField
                  label={t("Sorköz")}
                  value={element.lineHeight}
                  min={0.5}
                  max={4}
                  step={0.05}
                  displayScale={100}
                  suffix="%"
                  auto={element.lineHeightAuto === true}
                  onAutoChange={(auto) => patchSelected({ lineHeightAuto: auto } as Partial<SlideElement>)}
                  onChange={(value) => patchSelected({ lineHeight: value, lineHeightAuto: false } as Partial<SlideElement>)}
                  presets={[
                    { label: t("Auto"), auto: true },
                    { label: "100%", value: 1 },
                    { label: "110%", value: 1.1 },
                    { label: "120%", value: 1.2 },
                    { label: "130%", value: 1.3 },
                    { label: "150%", value: 1.5 },
                    { label: "200%", value: 2 },
                  ]}
                />
                <ComboNumberField
                  label={t("Betűköz")}
                  value={element.letterSpacing}
                  step={0.1}
                  suffix="px"
                  auto={element.letterSpacingAuto === true}
                  onAutoChange={(auto) => patchSelected({ letterSpacingAuto: auto } as Partial<SlideElement>)}
                  onChange={(value) => patchSelected({ letterSpacing: value, letterSpacingAuto: false } as Partial<SlideElement>)}
                  presets={[
                    { label: t("Auto"), auto: true },
                    { label: "-2", value: -2 },
                    { label: "-1", value: -1 },
                    { label: "0", value: 0 },
                    { label: "1", value: 1 },
                    { label: "2", value: 2 },
                    { label: "4", value: 4 },
                  ]}
                />
              </div>
              <ColorField label={t("Szín")} value={element.color} onChange={(value) => patchSelected({ color: value } as Partial<SlideElement>)} />
            </InspectorSection>

            <InspectorSection title={t("Bekezdés és szövegdoboz")} icon="properties" stateKey="text-paragraph-box">
              <div className="text-align-toolbar" role="toolbar" aria-label={t("Szöveg igazítása")}>
                <button type="button" className={element.textAlign === "left" ? "active" : ""} title={t("Balra zárt")} onClick={() => patchSelected({ textAlign: "left" } as Partial<SlideElement>)}><Icon name="alignLeft" size={16} /></button>
                <button type="button" className={element.textAlign === "center" ? "active" : ""} title={t("Középre zárt")} onClick={() => patchSelected({ textAlign: "center" } as Partial<SlideElement>)}><Icon name="alignCenter" size={16} /></button>
                <button type="button" className={element.textAlign === "right" ? "active" : ""} title={t("Jobbra zárt")} onClick={() => patchSelected({ textAlign: "right" } as Partial<SlideElement>)}><Icon name="alignRight" size={16} /></button>
                <button type="button" className={element.textAlign === "justify" ? "active" : ""} title={t("Sorkizárt")} onClick={() => patchSelected({ textAlign: "justify" } as Partial<SlideElement>)}><span className="justify-icon">≡</span></button>
              </div>
              <div className="two-column-fields">
                <NumberField label={t("Első sor behúzás")} value={element.firstLineIndent ?? 0} step={1} suffix="px" onChange={(value) => patchSelected({ firstLineIndent: value } as Partial<SlideElement>)} />
                <NumberField label={t("Előtte")} value={element.paragraphSpacingBefore ?? 0} min={0} step={1} suffix="px" onChange={(value) => patchSelected({ paragraphSpacingBefore: Math.max(0, value) } as Partial<SlideElement>)} />
                <NumberField label={t("Utána")} value={element.paragraphSpacingAfter ?? 0} min={0} step={1} suffix="px" onChange={(value) => patchSelected({ paragraphSpacingAfter: Math.max(0, value) } as Partial<SlideElement>)} />
                <NumberField label={t("Belső margó")} value={element.padding} min={0} suffix="px" onChange={(value) => patchSelected({ padding: value } as Partial<SlideElement>)} />
              </div>
              <div className="text-resize-mode">
                <span>{t("Méretezés húzáskor")}</span>
                <div className="segmented-control">
                  <button type="button" className={element.resizeMode === "box" ? "active" : ""} onClick={() => patchSelected({ resizeMode: "box" } as Partial<SlideElement>)}>{t("Doboz")}</button>
                  <button type="button" className={element.resizeMode === "scale" ? "active" : ""} onClick={() => patchSelected({ resizeMode: "scale" } as Partial<SlideElement>)}>{t("Szöveg méretezése")}</button>
                </div>
              </div>
              <SelectField
                label={t("Függőleges igazítás")}
                value={element.verticalAlign}
                onChange={(value) => patchSelected({ verticalAlign: value } as Partial<SlideElement>)}
                options={[
                  { value: "top", label: t("Felül") },
                  { value: "middle", label: t("Középen") },
                  { value: "bottom", label: t("Alul") },
                ]}
              />
            </InspectorSection>

            <InspectorSection title={t("További tipográfia")} icon="more" stateKey="text-advanced-typography">
              <RangeNumberField label={t("Betűvastagság")} value={element.fontWeight} min={100} max={900} step={10} onChange={(value) => patchSelected({ fontWeight: value } as Partial<SlideElement>)} />
              <NumberField label={t("Alapvonal eltolás")} value={element.baselineShift ?? 0} step={1} suffix="px" onChange={(value) => patchSelected({ baselineShift: value } as Partial<SlideElement>)} />
              <ToggleField label={t("Ligatúrák")} checked={element.ligatures !== false} onChange={(value) => patchSelected({ ligatures: value } as Partial<SlideElement>)} />
              <div className="inline-hint">{t("A ritkább tipográfiai beállítások itt maradnak, hogy a fő szövegpanel ne legyen zsúfolt.")}</div>
            </InspectorSection>

            <InspectorSection title={t("Szövegstílusok")} icon="text" stateKey="text-styles">
              <label className="field select-field">
                <span>{t("Stílus")}</span>
                <select value={element.textStyleId ?? ""} onChange={(event) => applyTextStyleToSelected(element, event.currentTarget.value)}>
                  <option value="">{t("Nincs hozzárendelt stílus")}</option>
                  {state.project.textStyles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
                </select>
              </label>
              {activeTextStyle ? (
                <>
                  <TextField label={t("Stílus neve")} value={activeTextStyle.name} onChange={(value) => renameTextStyle(activeTextStyle.id, value)} />
                  <div className="text-style-actions">
                    <button type="button" className="secondary-button" onClick={() => updateTextStyleFromSelected(element)} title={t("A stílus frissítése a kijelölt szöveg jelenlegi beállításaiból")}>{t("Stílus frissítése")}</button>
                    <button type="button" className="secondary-button danger-soft" onClick={() => deleteTextStyle(activeTextStyle.id)} title={t("Stílus törlése. A szövegek formázása megmarad.")}>{t("Törlés")}</button>
                  </div>
                  <div className="inline-hint">{t("A stílus frissítése minden ehhez a stílushoz kapcsolt szövegdobozt egységesít.")}</div>
                </>
              ) : (
                <button type="button" className="secondary-button wide" onClick={() => createTextStyleFromSelected(element)}><Icon name="plus" size={14} /> {t("Új stílus a kijelölt szövegből")}</button>
              )}
              <div className="inline-hint">{t("A Pre'on nem hoz létre automatikus Főcím / Alcím / Body preseteket. A stílusokat te hozod létre és nevezed el.")}</div>
            </InspectorSection>
          </>
        );
      })()}

      {!multiple && selected.type === "shape" && (() => {
        const shape = selected as ShapeElement;
        const fillAsset = shape.fillAssetId ? state.project.assets.find((candidate) => candidate.id === shape.fillAssetId) : undefined;
        return (
          <InspectorSection title="Alakzat" icon="rect" stateKey="shape">
            {shape.shape !== "line" && (
              <>
                <SelectField
                  label="Kitöltés típusa"
                  value={shape.fillType}
                  onChange={(value) => patchSelected({ fillType: value } as Partial<SlideElement>)}
                  options={[
                    { value: "color", label: "Szín" },
                    { value: "gradient", label: "Átmenet" },
                    { value: "image", label: "Kép / GIF" },
                    { value: "video", label: "Videó" },
                  ]}
                />
                {shape.fillType === "color" && <ColorField label={t("Kitöltés")} value={shape.fill} onChange={(value) => patchSelected({ fill: value } as Partial<SlideElement>)} />}
                {shape.fillType === "gradient" && (
                  <>
                    <ColorField label="Átmenet eleje" value={shape.gradientFrom} onChange={(value) => patchSelected({ gradientFrom: value } as Partial<SlideElement>)} />
                    <ColorField label="Átmenet vége" value={shape.gradientTo} onChange={(value) => patchSelected({ gradientTo: value } as Partial<SlideElement>)} />
                    <NumberField label="Szög" value={shape.gradientAngle} suffix="°" onChange={(value) => patchSelected({ gradientAngle: value } as Partial<SlideElement>)} />
                  </>
                )}
                {(shape.fillType === "image" || shape.fillType === "video") && (
                  <>
                    <button className="secondary-button wide" type="button" onClick={() => onChooseShapeMedia(shape.id, shape.fillType === "video" ? "video" : "image")}><Icon name={shape.fillType === "video" ? "video" : "image"} size={15} /> {t(fillAsset ? "Média cseréje" : "Média kiválasztása")}</button>
                    <small className="media-fill-name">{fillAsset?.name ?? t("Nincs kiválasztott média")}</small>
                    <SelectField<FitMode> label="Média illesztése" value={shape.fillFit} onChange={(value) => patchSelected({ fillFit: value } as Partial<SlideElement>)} options={[{value:"cover",label:"Kitöltés / vágás"},{value:"contain",label:"Teljes tartalom"},{value:"fill",label:"Nyújtás"}]} />
                    {shape.fillType === "video" && <>
                      <div className="subsection-label">{t("PDF / előnézeti képkocka")}</div>
                      <ShapeFillPosterInspector element={shape} onPatch={(patch) => patchSelected(patch as Partial<SlideElement>)} />
                    </>}
                  </>
                )}
              </>
            )}
            {shape.shape === "line" && <ColorField label="Szín" value={shape.fill} onChange={(value) => patchSelected({ fill: value } as Partial<SlideElement>)} />}
            <ColorField label="Körvonal" value={shape.stroke} onChange={(value) => patchSelected({ stroke: value } as Partial<SlideElement>)} />
            <div className="two-column-fields">
              <NumberField label="Vonalvastagság" value={shape.strokeWidth} min={0} suffix="px" onChange={(value) => patchSelected({ strokeWidth: value } as Partial<SlideElement>)} />
              {(shape.shape === "rect" || shape.shape === "rounded-rect") && <NumberField label={t("Sarok")} value={shape.radius} min={0} suffix="px" onChange={(value) => patchSelected({ radius: value } as Partial<SlideElement>)} />}
            </div>

          </InspectorSection>
        );
      })()}

      {!multiple && selected.type === "image" && (
        <InspectorSection title={t("Kép")} icon="image" stateKey="image">
          <SelectField<FitMode>
            label="Illesztés"
            value={selected.fit}
            onChange={(value) => patchSelected({ fit: value } as Partial<SlideElement>)}
            options={[
              { value: "cover", label: "Kitöltés / vágás" },
              { value: "contain", label: "Teljes kép" },
              { value: "fill", label: "Nyújtás" },
            ]}
          />
          <div className="button-row image-actions-row">
            <button className="secondary-button wide" type="button" onClick={() => onReplaceImage(selected.id)}><Icon name="image" size={15} /> {t("Kép cseréje")}</button>
          </div>
          <div className="subsection-label">{t("Gyors illesztés a diához")}</div>
          <div className="image-fit-grid">
            <button type="button" onClick={() => patchSelected({ x: 0, y: 0, width: state.project.width, height: state.project.height, fit: "contain", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>Fit to Slide</button>
            <button type="button" onClick={() => patchSelected({ x: 0, y: 0, width: state.project.width, height: state.project.height, fit: "cover", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>Fill Slide</button>
            <button type="button" onClick={() => { const ratio = selected.height / Math.max(1, selected.width); patchSelected({ x: 0, width: state.project.width, height: state.project.width * ratio, y: (state.project.height - state.project.width * ratio) / 2 } as Partial<SlideElement>); }}>Fit Width</button>
            <button type="button" onClick={() => { const ratio = selected.width / Math.max(1, selected.height); patchSelected({ y: 0, height: state.project.height, width: state.project.height * ratio, x: (state.project.width - state.project.height * ratio) / 2 } as Partial<SlideElement>); }}>Fit Height</button>
            <button type="button" onClick={() => patchSelected({ x: (state.project.width - selected.width) / 2, y: (state.project.height - selected.height) / 2 } as Partial<SlideElement>)}>{t("Középre")}</button>
            <button type="button" onClick={() => patchSelected({ fit: "contain", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>{t("Kép a keretbe")}</button>
            <button type="button" onClick={() => {
              const asset = state.project.assets.find((candidate) => candidate.id === selected.assetId);
              const src = assetUrl(asset);
              if (!src) return;
              const image = new Image();
              image.onload = () => {
                const centerX = selected.x + selected.width / 2;
                const centerY = selected.y + selected.height / 2;
                patchSelected({ width: image.naturalWidth, height: image.naturalHeight, x: centerX - image.naturalWidth / 2, y: centerY - image.naturalHeight / 2, fit: "contain", contentScale: 1 } as Partial<SlideElement>);
              };
              image.src = src;
            } }>{t("Keret a képhez")}</button>
            <button type="button" onClick={() => {
              const assetId = selected.assetId;
              updateContainer((container) => {
                container.background = { inherit: false, color: container.background.color, type: "image", fit: "cover", assetId };
                container.elements = container.elements.filter((candidate) => candidate.id !== selected.id);
              });
              setStatus(t("Kép háttérként beállítva"));
            } }>{t("Háttérként")}</button>
          </div>
          <div className="subsection-label">{t("Kép a kereten belül")}</div>
          <div className="two-column-fields">
            <NumberField label="Pozíció X" value={selected.contentPositionX ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ contentPositionX: clamp(value, 0, 100) } as Partial<SlideElement>)} />
            <NumberField label="Pozíció Y" value={selected.contentPositionY ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ contentPositionY: clamp(value, 0, 100) } as Partial<SlideElement>)} />
            <NumberField label="Nagyítás" value={(selected.contentScale ?? 1) * 100} min={25} max={500} suffix="%" onChange={(value) => patchSelected({ contentScale: clamp(value / 100, 0.25, 5) } as Partial<SlideElement>)} />
          </div>
          <button className="secondary-button wide" type="button" onClick={() => patchSelected({ contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>{t("Kép pozíciójának visszaállítása")}</button>
          {renderMediaMaskControls(selected)}
          <div className="subsection-label">{t("Keret")}</div>
          <div className="two-column-fields">
            <NumberField label={t("Sarok")} value={selected.radius} min={0} suffix="px" onChange={(value) => patchSelected({ radius: value } as Partial<SlideElement>)} />
            <NumberField label="Keret" value={selected.borderWidth} min={0} suffix="px" onChange={(value) => patchSelected({ borderWidth: value } as Partial<SlideElement>)} />
          </div>
          <ColorField label="Keretszín" value={selected.borderColor} onChange={(value) => patchSelected({ borderColor: value } as Partial<SlideElement>)} />

        </InspectorSection>
      )}

      {!multiple && selected.type === "slideshow" && (() => {
        const element = selected as SlideshowElement;
        const moveAsset = (from: number, to: number) => {
          if (to < 0 || to >= element.assetIds.length || from === to) return;
          const next = [...element.assetIds];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          patchSelected({ assetIds: next } as Partial<SlideElement>);
        };
        const removeAsset = (index: number) => {
          patchSelected({ assetIds: element.assetIds.filter((_, itemIndex) => itemIndex !== index) } as Partial<SlideElement>);
        };
        return (
          <InspectorSection title={t("Slideshow")} icon="slideshow" stateKey="slideshow">
            <div className="slideshow-summary-row">
              <strong>{element.assetIds.length} {t("kép")}</strong>
              <button className="secondary-button" type="button" onClick={() => onAddSlideshowImages(element.id)}><Icon name="plus" size={14} /> {t("Képek hozzáadása")}</button>
            </div>
            <div className="slideshow-asset-list">
              {!element.assetIds.length && <div className="inline-hint">{t("Adj legalább két képet a slideshow-hoz.")}</div>}
              {element.assetIds.map((assetId, index) => {
                const asset = state.project.assets.find((candidate) => candidate.id === assetId);
                const src = assetUrl(asset);
                return (
                  <div
                    className="slideshow-asset-row"
                    key={`${assetId}-${index}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-preon-slideshow-index", String(index));
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = Number(event.dataTransfer.getData("application/x-preon-slideshow-index"));
                      if (Number.isInteger(from)) moveAsset(from, index);
                    }}
                    title={t("Húzd a képek sorrendjének módosításához")}
                  >
                    <span className="slideshow-drag-handle" aria-hidden="true"><Icon name="menu" size={13} /></span>
                    <div className="slideshow-asset-thumb">{src ? <img src={src} alt="" draggable={false} /> : <Icon name="image" size={16} />}</div>
                    <div className="slideshow-asset-meta"><strong>{index + 1}. {asset?.name ?? t("Hiányzó kép")}</strong></div>
                    <button type="button" className="icon-only" disabled={index === 0} onClick={() => moveAsset(index, index - 1)} title={t("Előrébb")}><Icon name="chevronLeft" size={14} /></button>
                    <button type="button" className="icon-only" disabled={index === element.assetIds.length - 1} onClick={() => moveAsset(index, index + 1)} title={t("Hátrébb")}><Icon name="chevronRight" size={14} /></button>
                    <button type="button" className="icon-only danger" onClick={() => removeAsset(index)} title={t("Eltávolítás a slideshow-ból")}><Icon name="delete" size={14} /></button>
                  </div>
                );
              })}
            </div>
            <button className="secondary-button wide" type="button" disabled={element.assetIds.length < 2} onClick={() => window.dispatchEvent(new CustomEvent("preon-slideshow-preview", { detail: { id: element.id, action: "toggle" } }))}><Icon name="play" size={14} /> {t("Slideshow előnézet indítás / megállítás")}</button>

            <div className="subsection-label">{t("Lejátszás")}</div>
            <SelectField<"slide-enter" | "on-click">
              label={t("Slideshow indítása")}
              value={element.startMode}
              onChange={(value) => patchSelected({ startMode: value } as Partial<SlideElement>)}
              options={[
                { value: "slide-enter", label: t("Dia betöltésekor automatikusan") },
                { value: "on-click", label: t("Kattintásra") },
              ]}
            />
            <div className="two-column-fields">
              <NumberField label={t("Kép ideje")} value={element.interval} min={0.1} max={120} step={0.1} suffix="s" onChange={(value) => patchSelected({ interval: clamp(value, 0.1, 120) } as Partial<SlideElement>)} />
              <SelectField<"cut" | "fade"> label={t("Váltás")} value={element.transition} onChange={(value) => patchSelected({ transition: value } as Partial<SlideElement>)} options={[{ value: "cut", label: t("Gyors váltás") }, { value: "fade", label: t("Áttűnés") }]} />
            </div>
            {element.transition === "fade" && <NumberField label={t("Áttűnés ideje")} value={element.transitionDuration} min={0.05} max={10} step={0.05} suffix="s" onChange={(value) => patchSelected({ transitionDuration: clamp(value, 0.05, 10) } as Partial<SlideElement>)} />}
            <ToggleField label={t("Ismétlés")} checked={element.loop} onChange={(value) => patchSelected({ loop: value } as Partial<SlideElement>)} />
            <ToggleField label={t("Kattintás: indítás / megállítás")} checked={element.clickToggle} onChange={(value) => patchSelected({ clickToggle: value } as Partial<SlideElement>)} />
            <div className="inline-hint">{t("A slideshow a dia elhagyásakor automatikusan leáll. Kattintásos módban az első kattintás indítja, további kattintások megállítják vagy folytatják.")}</div>

            <div className="subsection-label">{t("Képkeret")}</div>
            <SelectField<FitMode>
              label={t("Illesztés")}
              value={element.fit}
              onChange={(value) => patchSelected({ fit: value } as Partial<SlideElement>)}
              options={[{ value: "cover", label: t("Kitöltés / vágás") }, { value: "contain", label: t("Teljes kép") }, { value: "fill", label: t("Nyújtás") }]}
            />
            <div className="image-fit-grid">
              <button type="button" onClick={() => patchSelected({ x: 0, y: 0, width: state.project.width, height: state.project.height, fit: "contain", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>Fit to Slide</button>
              <button type="button" onClick={() => patchSelected({ x: 0, y: 0, width: state.project.width, height: state.project.height, fit: "cover", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>Fill Slide</button>
              <button type="button" onClick={() => patchSelected({ x: (state.project.width - element.width) / 2, y: (state.project.height - element.height) / 2 } as Partial<SlideElement>)}>{t("Középre")}</button>
              <button type="button" onClick={() => patchSelected({ fit: "contain", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>{t("Kép a keretbe")}</button>
            </div>
            <div className="two-column-fields">
              <NumberField label="Pozíció X" value={element.contentPositionX ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ contentPositionX: clamp(value, 0, 100) } as Partial<SlideElement>)} />
              <NumberField label="Pozíció Y" value={element.contentPositionY ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ contentPositionY: clamp(value, 0, 100) } as Partial<SlideElement>)} />
              <NumberField label={t("Nagyítás")} value={(element.contentScale ?? 1) * 100} min={25} max={500} suffix="%" onChange={(value) => patchSelected({ contentScale: clamp(value / 100, 0.25, 5) } as Partial<SlideElement>)} />
            </div>
            <button className="secondary-button wide" type="button" onClick={() => patchSelected({ contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>{t("Kép pozíciójának visszaállítása")}</button>
            {renderMediaMaskControls(element)}
            <div className="two-column-fields">
              <NumberField label={t("Sarok")} value={element.radius} min={0} suffix="px" onChange={(value) => patchSelected({ radius: value } as Partial<SlideElement>)} />
              <NumberField label={t("Keret")} value={element.borderWidth} min={0} suffix="px" onChange={(value) => patchSelected({ borderWidth: value } as Partial<SlideElement>)} />
            </div>
            <ColorField label={t("Keretszín")} value={element.borderColor} onChange={(value) => patchSelected({ borderColor: value } as Partial<SlideElement>)} />
          </InspectorSection>
        );
      })()}

      {!multiple && selected.type === "pdf" && (() => {
        const element = selected as PdfElement;
        const pageCount = Math.max(1, element.pageCount || state.project.assets.find((candidate) => candidate.id === element.assetId)?.pageCount || 1);
        const setPage = (value: number) => patchSelected({ page: clamp(Math.round(value), 1, pageCount), pageCount } as Partial<SlideElement>);
        return (
          <InspectorSection title={t("PDF")} icon="pdf" stateKey="pdf">
            <div className="pdf-page-control">
              <button className="icon-only" type="button" disabled={element.page <= 1} onClick={() => setPage(element.page - 1)} title={t("Előző PDF oldal")}><Icon name="chevronLeft" size={15}/></button>
              <NumberField label={t("PDF oldal")} value={element.page} min={1} max={pageCount} step={1} suffix={` / ${pageCount}`} onChange={setPage} />
              <button className="icon-only" type="button" disabled={element.page >= pageCount} onClick={() => setPage(element.page + 1)} title={t("Következő PDF oldal")}><Icon name="chevronRight" size={15}/></button>
            </div>
            <SelectField<FitMode>
              label="Illesztés"
              value={element.fit}
              onChange={(value) => patchSelected({ fit: value } as Partial<SlideElement>)}
              options={[
                { value: "cover", label: "Kitöltés / vágás" },
                { value: "contain", label: "Teljes PDF oldal" },
                { value: "fill", label: "Nyújtás" },
              ]}
            />
            <div className="subsection-label">{t("Gyors illesztés a diához")}</div>
            <div className="image-fit-grid">
              <button type="button" onClick={() => patchSelected({ x: 0, y: 0, width: state.project.width, height: state.project.height, fit: "contain", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>Fit to Slide</button>
              <button type="button" onClick={() => patchSelected({ x: 0, y: 0, width: state.project.width, height: state.project.height, fit: "cover", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>Fill Slide</button>
              <button type="button" onClick={() => patchSelected({ x: (state.project.width - element.width) / 2, y: (state.project.height - element.height) / 2 } as Partial<SlideElement>)}>{t("Középre")}</button>
              <button type="button" onClick={() => patchSelected({ fit: "contain", contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>{t("PDF oldal a keretbe")}</button>
            </div>
            <div className="subsection-label">{t("PDF oldal a kereten belül")}</div>
            <div className="two-column-fields">
              <NumberField label="Pozíció X" value={element.contentPositionX ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ contentPositionX: clamp(value, 0, 100) } as Partial<SlideElement>)} />
              <NumberField label="Pozíció Y" value={element.contentPositionY ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchSelected({ contentPositionY: clamp(value, 0, 100) } as Partial<SlideElement>)} />
              <NumberField label="Nagyítás" value={(element.contentScale ?? 1) * 100} min={25} max={500} suffix="%" onChange={(value) => patchSelected({ contentScale: clamp(value / 100, 0.25, 5) } as Partial<SlideElement>)} />
            </div>
            <button className="secondary-button wide" type="button" onClick={() => patchSelected({ contentPositionX: 50, contentPositionY: 50, contentScale: 1 } as Partial<SlideElement>)}>{t("PDF pozíció visszaállítása")}</button>
            {renderMediaMaskControls(element)}
            <div className="subsection-label">{t("Keret")}</div>
            <div className="two-column-fields">
              <NumberField label={t("Sarok")} value={element.radius} min={0} suffix="px" onChange={(value) => patchSelected({ radius: value } as Partial<SlideElement>)} />
              <NumberField label="Keret" value={element.borderWidth} min={0} suffix="px" onChange={(value) => patchSelected({ borderWidth: value } as Partial<SlideElement>)} />
            </div>
            <ColorField label="Keretszín" value={element.borderColor} onChange={(value) => patchSelected({ borderColor: value } as Partial<SlideElement>)} />
          </InspectorSection>
        );
      })()}

      {!multiple && selected.type === "video" && (() => {
        const element = selected as VideoElement;
        return (
          <InspectorSection title={t("Videó")} icon="video" stateKey="video">
            <SelectField<"normal" | "scroll">
              label={t("Lejátszás")}
              value={state.project.presentationMode === "longform" ? (element.playbackMode ?? "normal") : "normal"}
              onChange={(value) => patchSelected({ playbackMode: value } as Partial<SlideElement>)}
              options={[
                { value: "normal", label: t("Normál lejátszás") },
                ...(state.project.presentationMode === "longform" && !state.editingMasterId ? [{ value: "scroll" as const, label: t("Görgetés vezérli") }] : []),
              ]}
            />
            {(element.playbackMode ?? "normal") === "scroll" && state.project.presentationMode === "longform" && !state.editingMasterId && (
              <div className="inline-hint">{t("A videó scroll-tartománya és rögzítése ugyanabban a One Slide / görgetés panelben állítható, mint a képeknél és szövegeknél.")}</div>
            )}
            <SelectField<FitMode>
              label={t("Illesztés")}
              value={element.fit}
              onChange={(value) => patchSelected({ fit: value } as Partial<SlideElement>)}
              options={[
                { value: "cover", label: t("Kitöltés / vágás") },
                { value: "contain", label: t("Teljes videó") },
                { value: "fill", label: t("Nyújtás") },
              ]}
            />
            <div className="two-column-fields">
              <NumberField label={t("Kezdés")} value={element.startTime} min={0} step={0.01} suffix="s" onChange={(value) => patchSelected({ startTime: Math.max(0, value) } as Partial<SlideElement>)} />
              <NumberField label={t("Vége")} value={element.endTime ?? 0} min={0} step={0.01} suffix="s" onChange={(value) => patchSelected({ endTime: value > 0 ? value : undefined } as Partial<SlideElement>)} />
              <NumberField label={t("Sarok")} value={element.radius} min={0} suffix="px" onChange={(value) => patchSelected({ radius: value } as Partial<SlideElement>)} />
            </div>
            {(element.playbackMode ?? "normal") !== "scroll" && (
              <>
                <ToggleField label={t("Automatikus indulás")} checked={element.autoplay} onChange={(value) => patchSelected({ autoplay: value } as Partial<SlideElement>)} />
                <ToggleField label={t("Ismétlés")} checked={element.loop} onChange={(value) => patchSelected({ loop: value } as Partial<SlideElement>)} />
                <ToggleField label={t("Lejátszó vezérlői")} checked={element.controls} onChange={(value) => patchSelected({ controls: value } as Partial<SlideElement>)} />
              </>
            )}
            <ToggleField label={t("Némítva")} checked={element.muted} onChange={(value) => patchSelected({ muted: value } as Partial<SlideElement>)} />
            {renderMediaMaskControls(element)}
            <div className="subsection-label">{t("PDF / előnézeti képkocka")}</div>
            <VideoPosterInspector element={element} onPatch={(patch) => patchSelected(patch as Partial<SlideElement>)} />
          </InspectorSection>
        );
      })()}

      {!multiple && selected.type === "model3d" && (() => {
        const element = selected as Model3DElement;
        const capturePoster = async () => {
          const viewer = document.querySelector(`[data-model3d-id="${element.id}"] model-viewer`) as (HTMLElement & { toDataURL?: (type?: string, quality?: number) => string }) | null;
          if (!viewer?.toDataURL) {
            setStatus(t("A 3D nézet még nem töltődött be – próbáld újra pár pillanat múlva."));
            return;
          }
          try {
            const dataUrl = viewer.toDataURL("image/png", 0.92);
            patchSelected({ posterDataUrl: dataUrl } as Partial<SlideElement>);
            setStatus("3D poster frame mentve");
          } catch (error) {
            setStatus(`3D poster mentése nem sikerült: ${String(error)}`);
          }
        };
        return (
          <InspectorSection title={t("3D modell")} icon="model3d" stateKey="model3d">
            <SelectField<Model3DInteraction>
              label={t("Interakció")}
              value={element.interaction}
              onChange={(value) => patchSelected({ interaction: value } as Partial<SlideElement>)}
              options={[
                { value: "none", label: "Nincs" },
                { value: "orbit", label: "Egérrel forgatható" },
                { value: "parallax", label: "Egérmozgás / parallax" },
                { value: "scroll", label: "Görgetésre forog" },
              ]}
            />
            <ToggleField label="Automatikus körbeforgás" checked={element.autoRotate} onChange={(value) => patchSelected({ autoRotate: value } as Partial<SlideElement>)} />
            {element.autoRotate && <RangeNumberField label={t("Forgási sebesség")} value={element.autoRotateSpeed} min={1} max={90} step={1} suffix="°/s" onChange={(value) => patchSelected({ autoRotateSpeed: value } as Partial<SlideElement>)} />}
            {element.interaction === "parallax" && <RangeNumberField label="Parallax erősség" value={element.parallaxStrength} min={2} max={45} step={1} suffix="°" onChange={(value) => patchSelected({ parallaxStrength: value } as Partial<SlideElement>)} />}
            {element.interaction === "scroll" && <RangeNumberField label={t("Forgási tartomány")} value={element.scrollRotation} min={45} max={720} step={15} suffix="°" onChange={(value) => patchSelected({ scrollRotation: value } as Partial<SlideElement>)} />}
            <div className="subsection-label">Kamera</div>
            <div className="camera-preset-grid">
              <button type="button" onClick={() => patchSelected({ orbitTheta: 0, orbitPhi: 75 } as Partial<SlideElement>)}>{t("Elöl")}</button>
              <button type="button" onClick={() => patchSelected({ orbitTheta: 90, orbitPhi: 75 } as Partial<SlideElement>)}>Jobb</button>
              <button type="button" onClick={() => patchSelected({ orbitTheta: 180, orbitPhi: 75 } as Partial<SlideElement>)}>{t("Hátul")}</button>
              <button type="button" onClick={() => patchSelected({ orbitTheta: -90, orbitPhi: 75 } as Partial<SlideElement>)}>Bal</button>
              <button type="button" onClick={() => patchSelected({ orbitTheta: 0, orbitPhi: 15 } as Partial<SlideElement>)}>{t("Felül")}</button>
            </div>
            <div className="two-column-fields">
              <NumberField label={t("Vízszintes")} value={element.orbitTheta} step={1} suffix="°" onChange={(value) => patchSelected({ orbitTheta: value } as Partial<SlideElement>)} />
              <NumberField label={t("Függőleges")} value={element.orbitPhi} min={1} max={179} step={1} suffix="°" onChange={(value) => patchSelected({ orbitPhi: clamp(value, 1, 179) } as Partial<SlideElement>)} />
              <NumberField label={t("Látószög")} value={element.fieldOfView} min={10} max={90} step={1} suffix="°" onChange={(value) => patchSelected({ fieldOfView: clamp(value, 10, 90) } as Partial<SlideElement>)} />
              <NumberField label={t("Kamera távolság")} value={element.cameraDistance ?? 100} min={45} max={300} step={5} suffix="%" onChange={(value) => patchSelected({ cameraDistance: clamp(value, 45, 300) } as Partial<SlideElement>)} />
            </div>
            <div className="subsection-label">{t("Megjelenés")}</div>
            <RangeNumberField label={t("Expozíció")} value={element.exposure} min={0.1} max={2.5} step={0.05} onChange={(value) => patchSelected({ exposure: value } as Partial<SlideElement>)} />
            <RangeNumberField label={t("Árnyék")} value={element.shadowIntensity} min={0} max={2} step={0.05} onChange={(value) => patchSelected({ shadowIntensity: value } as Partial<SlideElement>)} />
            <ToggleField label={t("Átlátszó háttér")} checked={element.transparentBackground} onChange={(value) => patchSelected({ transparentBackground: value } as Partial<SlideElement>)} />
            {!element.transparentBackground && <ColorField label="Háttér" value={element.backgroundColor} onChange={(value) => patchSelected({ backgroundColor: value } as Partial<SlideElement>)} />}
            <ToggleField label={t("Interakció az editorban")} checked={element.interactiveInEditor} onChange={(value) => patchSelected({ interactiveInEditor: value } as Partial<SlideElement>)} hint="Kikapcsolva a 3D nem fogja el az egérmozdulatokat szerkesztés közben." />
            <button className="secondary-button wide" type="button" onClick={() => void capturePoster()}>{t("Aktuális 3D nézet mentése posternek")}</button>
            {element.posterDataUrl && <img className="poster-preview" src={element.posterDataUrl} alt="3D poster" />}

          </InspectorSection>
        );
      })()}

      {!multiple && selected.type === "web" && (() => {
        const element = selected as WebElement;
        return (
          <InspectorSection title={t("Webtartalom")} icon="web" stateKey="web">
            <SelectField
              label={t("Forrás")}
              value={element.sourceType}
              onChange={(value) => patchSelected({ sourceType: value } as Partial<SlideElement>)}
              options={[
                { value: "url", label: "Élő URL" },
                { value: "local", label: "Helyi HTML" },
              ]}
            />
            {element.sourceType === "url" ? (
              <TextField label="URL" value={element.url} onChange={(value) => patchSelected({ url: value } as Partial<SlideElement>)} placeholder="https://…" />
            ) : (
              <></>
            )}
            <NumberField label={t("Sarok")} value={element.radius} min={0} suffix="px" onChange={(value) => patchSelected({ radius: value } as Partial<SlideElement>)} />
            <ToggleField
              label={t("Interakció az editorban")}
              checked={element.interactiveInEditor}
              onChange={(value) => patchSelected({ interactiveInEditor: value } as Partial<SlideElement>)}
              hint="Bekapcsolva a weboldal fogadja az egérkattintást; kijelöléshez használd a rétegpanelt."
            />

          </InspectorSection>
        );
      })()}

      {!multiple && !state.editingMasterId && state.project.presentationMode === "longform" && (() => {
        const scrollBehavior: ElementScrollBehavior = selected.scrollBehavior ?? { mode: "normal", rangeMode: "screens", screens: 2 };
        const patchScrollBehavior = (patch: Partial<typeof scrollBehavior>) => patchSelected({ scrollBehavior: { ...scrollBehavior, ...patch } } as Partial<SlideElement>);
        const activeIndex = state.project.slides.findIndex((slide) => slide.id === activeSlide.id);
        const futureSlides = state.project.slides.filter((slide, index) => index > activeIndex && !slide.hidden);
        const scrollDriven3d = selected.type === "model3d" && selected.interaction === "scroll";
        const scrollDrivenVideo = selected.type === "video" && (selected.playbackMode ?? "normal") === "scroll";
        const motionEnabled = normalizedScrollMotion(scrollBehavior.motion).enabled;
        const showRange = scrollBehavior.mode === "sticky" || scrollDriven3d || scrollDrivenVideo || motionEnabled;
        return (
          <InspectorSection title={t("One Slide / görgetés")} icon="move" stateKey="one-slide-scroll">
            <SelectField<"normal" | "sticky">
              label={t("Viselkedés")}
              value={scrollBehavior.mode}
              onChange={(value) => patchScrollBehavior({ mode: value })}
              options={[
                { value: "normal", label: t("Oldallal együtt") },
                { value: "sticky", label: t("Rögzített / Pin") },
              ]}
            />
            {showRange && (
              <>
                <SelectField<"screens" | "until-section">
                  label={t("Tartomány")}
                  value={scrollBehavior.rangeMode}
                  onChange={(value) => patchScrollBehavior({ rangeMode: value })}
                  options={[
                    { value: "screens", label: t("Görgetési távolság") },
                    { value: "until-section", label: t("Következő szekcióig") },
                  ]}
                />
                {scrollBehavior.rangeMode === "screens" ? (
                  <RangeNumberField label={t("Hossz")} value={scrollBehavior.screens ?? 2} min={0.25} max={12} step={0.25} suffix={t(" képernyő")} onChange={(value) => patchScrollBehavior({ screens: clamp(value, 0.25, 12) })} />
                ) : (
                  <label className="field select-field">
                    <span>{t("Cél szekció")}</span>
                    <select value={scrollBehavior.targetSlideId ?? ""} onChange={(event) => patchScrollBehavior({ targetSlideId: event.currentTarget.value || undefined })}>
                      <option value="">{t("Válassz célt…")}</option>
                      {futureSlides.map((slide) => { const index = state.project.slides.findIndex((candidate) => candidate.id === slide.id); return <option key={slide.id} value={slide.id}>{index + 1}. {slide.name}</option>; })}
                    </select>
                  </label>
                )}
                <div className="inline-hint">{scrollDrivenVideo ? t("A scroll a videó képkockáját vezérli; Rögzített / Pin módban a videó pixelstabil marad a megadott tartomány alatt.") : scrollDriven3d ? t("A 3D forgás és a Pin ugyanazt a scroll tartományt használja.") : t("Rögzített / Pin módban az elem pixelstabilan ugyanazon a képernyőpozíción marad, majd továbbgördül az oldallal.")}</div>
              </>
            )}
            <ScrollMotionControls behavior={scrollBehavior} onChange={(value) => patchSelected({ scrollBehavior: value } as Partial<SlideElement>)} />
            {motionEnabled && scrollBehavior.mode === "normal" && !scrollDriven3d && !scrollDrivenVideo && <div className="inline-hint">{t("Scroll animációnál az elem haladhat az oldallal, miközben opacity / scale / pozíció változik.")}</div>}
          </InspectorSection>
        );
      })()}

      {!multiple && (
        <InspectorSection title={t("Navigáció / kattintás")} icon="link" stateKey="navigation">
          <SelectField<"none" | "section">
            label={t("Művelet")}
            value={selected.navigation?.type ?? "none"}
            onChange={(value) => patchSelected({
              navigation: value === "section"
                ? { type: "section", targetSlideId: selected.navigation?.targetSlideId ?? state.project.slides.find((slide) => slide.id !== activeSlide.id && !slide.hidden)?.id, smooth: true }
                : { type: "none", smooth: true },
            } as Partial<SlideElement>)}
            options={[
              { value: "none", label: "Nincs" },
              { value: "section", label: state.project.presentationMode === "longform" ? "Ugrás One Slide szekcióra" : "Ugrás diára" },
            ]}
          />
          {(selected.navigation?.type ?? "none") === "section" && (
            <>
              <label className="field select-field">
                <span>{t(state.project.presentationMode === "longform" ? "Cél szekció" : "Cél dia")}</span>
                <select
                  value={selected.navigation?.targetSlideId ?? ""}
                  onChange={(event) => patchSelected({ navigation: { type: "section", targetSlideId: event.currentTarget.value || undefined, smooth: selected.navigation?.smooth ?? true } } as Partial<SlideElement>)}
                >
                  <option value="">{t("Válassz célt…")}</option>
                  {state.project.slides.filter((slide) => !slide.hidden).map((slide, index) => (
                    <option key={slide.id} value={slide.id}>{index + 1}. {slide.name}</option>
                  ))}
                </select>
              </label>
              {state.project.presentationMode === "longform" && (
                <ToggleField
                  label={t("Sima görgetés")}
                  checked={selected.navigation?.smooth ?? true}
                  onChange={(value) => patchSelected({ navigation: { type: "section", targetSlideId: selected.navigation?.targetSlideId, smooth: value } } as Partial<SlideElement>)}
                />
              )}
              <div className="inline-hint">{t("Present és HTML/LAN módban az elem kattintható navigációs pontként működik.")}</div>
            </>
          )}
        </InspectorSection>
      )}

      <InspectorSection title={t("Belépő animáció")} icon="play" stateKey="entrance-animation">
        <SelectField<AnimationKind>
          label={t("Effekt")}
          value={selected.animation.kind}
          onChange={(value) => patchSelected({ animation: { ...selected.animation, kind: value } } as Partial<SlideElement>)}
          options={[
            { value: "none", label: "Nincs" },
            { value: "fade", label: "Áttűnés" },
            { value: "fade-up", label: "Felúszás" },
            { value: "scale", label: "Nagyítás" },
          ]}
        />
        <SelectField<AnimationTrigger>
          label={t("Slideshow indítása")}
          value={selected.animation.trigger}
          onChange={(value) => patchSelected({ animation: { ...selected.animation, trigger: value } } as Partial<SlideElement>)}
          options={[
            { value: "with-slide", label: "A diával" },
            { value: "on-click", label: "Kattintásra" },
          ]}
        />
        <div className="two-column-fields">
          <NumberField label={t("Időtartam")} value={selected.animation.duration} min={0.05} step={0.05} suffix="s" onChange={(value) => patchSelected({ animation: { ...selected.animation, duration: value } } as Partial<SlideElement>)} />
          <NumberField label={t("Késleltetés")} value={selected.animation.delay} min={0} step={0.05} suffix="s" onChange={(value) => patchSelected({ animation: { ...selected.animation, delay: value } } as Partial<SlideElement>)} />
        </div>
      </InspectorSection>

      <InspectorSection title={t("Elem adatai")} icon="properties" stateKey="element-data">
        <TextField label={t("Rétegnév")} value={selected.name} onChange={(value) => patchSelected({ name: value } as Partial<SlideElement>)} />
        <div className="element-id">ID: {selected.id}</div>
        <button className="secondary-button wide" onClick={() => {
          navigator.clipboard.writeText(selected.id).then(() => setStatus("Elem ID másolva")).catch(() => undefined);
        }}>{t("ID másolása")}</button>
      </InspectorSection>
    </div>
  );
}
