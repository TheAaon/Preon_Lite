import type { ExportAssetItem, FontFileRecord, PresentationProject, TextElement } from "./types";
import { listSystemFontFiles, outlineText } from "./platform";
import { safeFileName } from "./utils";
import { outputSlides } from "./outputProject";

export interface FontExportStatus {
  family: string;
  status: "embedded" | "outlined" | "missing" | "system";
  detail: string;
}

export interface PreparedExport {
  fontFaces: Array<{ family: string; targetName: string; weight?: number; style?: "normal" | "italic" }>;
  fontAssets: ExportAssetItem[];
  textOutlines: Record<string, string>;
  fontStatus: FontExportStatus[];
}

function primaryFamily(value: string): string {
  return value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || value.trim();
}

function allTextElements(project: PresentationProject, includeNotes = true): TextElement[] {
  const items: TextElement[] = [];
  outputSlides(project).forEach((slide) => {
    slide.elements.forEach((element) => { if (element.type === "text") items.push(element); });
    if (includeNotes) slide.notesBoard?.elements.forEach((element) => { if (element.type === "text") items.push(element); });
  });
  project.masters.forEach((master) => master.elements.forEach((element) => { if (element.type === "text") items.push(element); }));
  return items;
}

function chooseFontRecord(records: FontFileRecord[], family: string, weight: number, italic: boolean): FontFileRecord | undefined {
  const exactFamily = records.filter((record) => record.family.toLowerCase() === family.toLowerCase());
  return [...exactFamily].sort((a, b) => {
    const aPenalty = Math.abs(a.weight - weight) + (a.italic === italic ? 0 : 350) + (a.embeddable ? 0 : 40);
    const bPenalty = Math.abs(b.weight - weight) + (b.italic === italic ? 0 : 350) + (b.embeddable ? 0 : 40);
    return aPenalty - bPenalty;
  })[0];
}

export async function prepareExport(project: PresentationProject, includeNotes = true): Promise<PreparedExport> {
  const result: PreparedExport = { fontFaces: [], fontAssets: [], textOutlines: {}, fontStatus: [] };
  const texts = allTextElements(project, includeNotes);
  const families = Array.from(new Set(texts.map((text) => primaryFamily(text.fontFamily)).filter(Boolean)));
  if (!families.length) return result;

  let records: FontFileRecord[] = [];
  try { records = await listSystemFontFiles(); } catch { records = []; }

  for (const family of families) {
    const generic = /^(serif|sans-serif|monospace|system-ui|-apple-system|arial|helvetica)$/i.test(family);
    if (generic) {
      result.fontStatus.push({ family, status: "system", detail: "Rendszerfont / fallback" });
      continue;
    }
    const affected = texts.filter((text) => primaryFamily(text.fontFamily).toLowerCase() === family.toLowerCase());
    const variants = Array.from(new Map(affected.map((text) => {
      const weight = Math.round(text.fontWeight / 100) * 100;
      const italic = text.fontStyle === "italic";
      return [`${weight}-${italic}`, { weight, italic }];
    })).values());
    if (!records.some((record) => record.family.toLowerCase() === family.toLowerCase())) {
      result.fontStatus.push({ family, status: "missing", detail: "A fontfájl nem található – a fogadó gép fallback fontot használhat" });
      continue;
    }
    let embeddedCount = 0;
    let outlinedCount = 0;
    let fallbackCount = 0;
    const outlinedIds = new Set<string>();
    const addedPaths = new Set<string>();
    for (const variant of variants) {
      const record = chooseFontRecord(records, family, variant.weight, variant.italic);
      if (!record) continue;
      const variantTexts = affected.filter((text) => Math.round(text.fontWeight / 100) * 100 === variant.weight && (text.fontStyle === "italic") === variant.italic);
      if (record.embeddable) {
        let targetName = `fonts/${safeFileName(family)}-${variant.weight}${variant.italic ? "-italic" : ""}.${record.format || "ttf"}`;
        if (!addedPaths.has(record.path)) {
          result.fontAssets.push({ sourcePath: record.path, targetName });
          addedPaths.add(record.path);
        } else {
          const previous = result.fontAssets.find((asset) => asset.sourcePath === record.path);
          if (previous) targetName = previous.targetName;
        }
        result.fontFaces.push({ family, targetName, weight: variant.weight, style: variant.italic ? "italic" : "normal" });
        embeddedCount += variantTexts.length;
        continue;
      }
      if (record.format === "ttf" || record.format === "otf") {
        for (const element of variantTexts) {
          const advancedTypography = Boolean(
            element.strikethrough
            || element.textTransform === "uppercase"
            || element.fontVariantCaps === "small-caps"
            || (element.baselineMode && element.baselineMode !== "normal")
            || (element.baselineShift ?? 0) !== 0
            || (element.paragraphSpacingBefore ?? 0) !== 0
            || (element.paragraphSpacingAfter ?? 0) !== 0
            || (element.firstLineIndent ?? 0) !== 0
            || element.textAlign === "justify"
            || element.ligatures === false
          );
          // A natív outline motor a v0.20 fejlett tipográfiai kapcsolóit még nem bontja
          // külön glyph-szintekre. Ezeknél inkább CSS/font fallback marad, mint hibás outline.
          if ((element.dynamicField ?? "none") !== "none" || advancedTypography) { fallbackCount += 1; continue; }
          if (outlinedIds.has(element.id)) continue;
          try {
            result.textOutlines[element.id] = await outlineText({
              path: record.path, text: element.text, fontSize: element.fontSize, lineHeight: element.lineHeightAuto ? 1.2 : element.lineHeight,
              letterSpacing: element.letterSpacingAuto ? 0 : element.letterSpacing, width: element.width, height: element.height, padding: element.padding,
              textAlign: element.textAlign, verticalAlign: element.verticalAlign, color: element.color,
            });
            outlinedIds.add(element.id); outlinedCount += 1;
          } catch { fallbackCount += 1; }
        }
      } else {
        fallbackCount += variantTexts.length;
      }
    }
    if (fallbackCount > 0) {
      result.fontStatus.push({
        family,
        status: "missing",
        detail: `${embeddedCount} szöveg beágyazott fonttal, ${outlinedCount} SVG outline, ${fallbackCount} elem fallback fonttal marad`,
      });
    } else if (outlinedCount > 0 && embeddedCount > 0) result.fontStatus.push({ family, status: "outlined", detail: `${embeddedCount} szöveg beágyazott fonttal, ${outlinedCount} SVG outline` });
    else if (outlinedCount > 0) result.fontStatus.push({ family, status: "outlined", detail: `${outlinedCount} szövegdoboz SVG körvonallá alakítva` });
    else if (embeddedCount > 0) result.fontStatus.push({ family, status: "embedded", detail: `${variants.length} használt változat csomagolva` });
    else result.fontStatus.push({ family, status: "missing", detail: "Nem beágyazható és outline sem készült" });
  }
  return result;
}
