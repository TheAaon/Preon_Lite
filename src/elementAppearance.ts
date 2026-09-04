import type {
  ElementEffects,
  ShapeElement,
  SlideElement,
  TextElement,
  WebElement,
} from "./types";

export const defaultElementEffects = (): ElementEffects => ({
  blur: 0,
  dropShadow: {
    enabled: false,
    offsetX: 10,
    offsetY: 10,
    blur: 18,
    color: "#000000",
    opacity: 0.32,
  },
  glow: {
    enabled: false,
    blur: 20,
    color: "#ffffff",
    opacity: 0.55,
  },
});

export function normalizedElementEffects(value?: Partial<ElementEffects>): ElementEffects {
  const base = defaultElementEffects();
  const drop = value?.dropShadow ?? base.dropShadow;
  const glow = value?.glow ?? base.glow;
  return {
    blur: Number.isFinite(Number(value?.blur)) ? Math.max(0, Number(value?.blur)) : base.blur,
    dropShadow: {
      enabled: Boolean(drop.enabled),
      offsetX: Number.isFinite(Number(drop.offsetX)) ? Number(drop.offsetX) : base.dropShadow.offsetX,
      offsetY: Number.isFinite(Number(drop.offsetY)) ? Number(drop.offsetY) : base.dropShadow.offsetY,
      blur: Number.isFinite(Number(drop.blur)) ? Math.max(0, Number(drop.blur)) : base.dropShadow.blur,
      color: drop.color || base.dropShadow.color,
      opacity: Number.isFinite(Number(drop.opacity)) ? Math.max(0, Math.min(1, Number(drop.opacity))) : base.dropShadow.opacity,
    },
    glow: {
      enabled: Boolean(glow.enabled),
      blur: Number.isFinite(Number(glow.blur)) ? Math.max(0, Number(glow.blur)) : base.glow.blur,
      color: glow.color || base.glow.color,
      opacity: Number.isFinite(Number(glow.opacity)) ? Math.max(0, Math.min(1, Number(glow.opacity))) : base.glow.opacity,
    },
  };
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (short) {
    const digits = short[1].split("").map((char) => char + char).join("");
    const n = Number.parseInt(digits, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, opacity))})`;
  }
  if (full) {
    const n = Number.parseInt(full[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, opacity))})`;
  }
  return color;
}

export function elementEffectsFilter(value?: Partial<ElementEffects>): string | undefined {
  const effects = normalizedElementEffects(value);
  const filters: string[] = [];
  if (effects.blur > 0.01) filters.push(`blur(${effects.blur}px)`);
  if (effects.dropShadow.enabled) {
    filters.push(`drop-shadow(${effects.dropShadow.offsetX}px ${effects.dropShadow.offsetY}px ${effects.dropShadow.blur}px ${colorWithOpacity(effects.dropShadow.color, effects.dropShadow.opacity)})`);
  }
  if (effects.glow.enabled) {
    filters.push(`drop-shadow(0 0 ${effects.glow.blur}px ${colorWithOpacity(effects.glow.color, effects.glow.opacity)})`);
  }
  return filters.length ? filters.join(" ") : undefined;
}

export function textFormattingPatch(source: TextElement): Partial<TextElement> {
  return {
    fontFamily: source.fontFamily,
    fontSize: source.fontSize,
    fontWeight: source.fontWeight,
    fontStyle: source.fontStyle,
    textDecoration: source.textDecoration,
    strikethrough: source.strikethrough,
    textTransform: source.textTransform,
    fontVariantCaps: source.fontVariantCaps,
    baselineMode: source.baselineMode,
    baselineShift: source.baselineShift,
    ligatures: source.ligatures,
    lineHeight: source.lineHeight,
    lineHeightAuto: source.lineHeightAuto,
    letterSpacing: source.letterSpacing,
    letterSpacingAuto: source.letterSpacingAuto,
    paragraphSpacingBefore: source.paragraphSpacingBefore,
    paragraphSpacingAfter: source.paragraphSpacingAfter,
    firstLineIndent: source.firstLineIndent,
    color: source.color,
    textAlign: source.textAlign,
    verticalAlign: source.verticalAlign,
    background: source.background,
    padding: source.padding,
    effects: normalizedElementEffects(source.effects),
  };
}

export function primaryElementColor(element: SlideElement): string | null {
  if (element.type === "text") return element.color || null;
  if (element.type === "shape") {
    if (element.shape === "line") return element.fill || element.stroke || null;
    if (element.fillType === "gradient") return element.gradientFrom || element.fill || null;
    if (element.fillType === "color") return element.fill || null;
    return element.stroke && element.stroke !== "transparent" ? element.stroke : null;
  }
  if (element.type === "image" || element.type === "slideshow" || element.type === "pdf") {
    return element.borderWidth > 0 && element.borderColor !== "transparent" ? element.borderColor : null;
  }
  if (element.type === "model3d") return element.transparentBackground ? null : element.backgroundColor;
  return null;
}

export function applyColorToElement(element: SlideElement, color: string): boolean {
  if (element.type === "text") {
    element.color = color;
    element.textStyleId = undefined;
    return true;
  }
  if (element.type === "shape") {
    element.fill = color;
    if (element.shape !== "line") element.fillType = "color";
    return true;
  }
  return false;
}

export interface ElementStyleSnapshot {
  sourceType: SlideElement["type"];
  opacity: number;
  effects: ElementEffects;
  text?: Partial<TextElement>;
  shape?: Pick<ShapeElement, "fill" | "fillType" | "fillFit" | "gradientFrom" | "gradientTo" | "gradientAngle" | "stroke" | "strokeWidth" | "radius">;
  frame?: { radius: number; borderColor: string; borderWidth: number };
  web?: Pick<WebElement, "radius">;
}

export function createElementStyleSnapshot(source: SlideElement): ElementStyleSnapshot {
  const snapshot: ElementStyleSnapshot = {
    sourceType: source.type,
    opacity: source.opacity,
    effects: normalizedElementEffects(source.effects),
  };
  if (source.type === "text") snapshot.text = textFormattingPatch(source);
  if (source.type === "shape") snapshot.shape = {
    fill: source.fill,
    fillType: source.fillType,
    fillFit: source.fillFit,
    gradientFrom: source.gradientFrom,
    gradientTo: source.gradientTo,
    gradientAngle: source.gradientAngle,
    stroke: source.stroke,
    strokeWidth: source.strokeWidth,
    radius: source.radius,
  };
  if (source.type === "image" || source.type === "slideshow" || source.type === "pdf") snapshot.frame = {
    radius: source.radius,
    borderColor: source.borderColor,
    borderWidth: source.borderWidth,
  };
  if (source.type === "video") snapshot.frame = {
    radius: source.radius,
    borderColor: "transparent",
    borderWidth: 0,
  };
  if (source.type === "web") snapshot.web = { radius: source.radius };
  return snapshot;
}

export function applyElementStyleSnapshot(target: SlideElement, snapshot: ElementStyleSnapshot): void {
  target.opacity = snapshot.opacity;
  target.effects = normalizedElementEffects(snapshot.effects);
  if (target.type !== snapshot.sourceType) return;
  if (target.type === "text" && snapshot.text) {
    Object.assign(target, snapshot.text);
    target.textStyleId = undefined;
  } else if (target.type === "shape" && snapshot.shape) {
    Object.assign(target, snapshot.shape);
  } else if ((target.type === "image" || target.type === "slideshow" || target.type === "pdf") && snapshot.frame) {
    target.radius = snapshot.frame.radius;
    target.borderColor = snapshot.frame.borderColor;
    target.borderWidth = snapshot.frame.borderWidth;
  } else if (target.type === "video" && snapshot.frame) {
    target.radius = snapshot.frame.radius;
  } else if (target.type === "web" && snapshot.web) {
    target.radius = snapshot.web.radius;
  }
}

export function primaryFontFamily(value: string): string {
  return (value.split(",")[0] || value).trim().replace(/^['"]|['"]$/g, "");
}

export function elementStyleSignature(element: SlideElement): string {
  return JSON.stringify(createElementStyleSnapshot(element));
}
