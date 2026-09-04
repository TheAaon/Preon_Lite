const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "MARK",
  "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "SPAN", "FONT",
]);

const ALLOWED_STYLE = new Set([
  "color", "background-color", "text-align", "font-size", "font-weight", "font-style",
  "text-decoration", "margin-left", "padding-left",
]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return char;
  });
}

export function plainTextToNoteHtml(text: string): string {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n");
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sanitizeStyle(value: string): string {
  const safe: string[] = [];
  for (const declaration of value.split(";")) {
    const index = declaration.indexOf(":");
    if (index < 0) continue;
    const key = declaration.slice(0, index).trim().toLowerCase();
    let val = declaration.slice(index + 1).trim();
    if (!ALLOWED_STYLE.has(key) || !val) continue;
    if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) continue;
    if (key === "font-size") {
      const match = val.match(/^([0-9]{1,3}(?:\.[0-9]+)?)(px|pt|em|rem|%)$/i);
      if (!match) continue;
      const number = Math.max(8, Math.min(160, Number(match[1])));
      val = `${number}${match[2].toLowerCase()}`;
    }
    safe.push(`${key}:${val}`);
  }
  return safe.join(";");
}

export function sanitizeRichNoteHtml(html: string): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return plainTextToNoteHtml(html.replace(/<[^>]*>/g, ""));
  const documentNode = new DOMParser().parseFromString(`<div id="note-root">${html}</div>`, "text/html");
  const root = documentNode.getElementById("note-root");
  if (!root) return "";

  const visit = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 8) {
        child.remove();
        continue;
      }
      if (child.nodeType !== 1) continue;
      const element = child as HTMLElement;
      if (!ALLOWED_TAGS.has(element.tagName)) {
        const fragment = documentNode.createDocumentFragment();
        while (element.firstChild) fragment.append(element.firstChild);
        element.replaceWith(fragment);
        visit(node);
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name === "style") {
          const safeStyle = sanitizeStyle(attribute.value);
          if (safeStyle) element.setAttribute("style", safeStyle); else element.removeAttribute("style");
          continue;
        }
        if (element.tagName === "FONT" && ["color", "size", "face"].includes(name)) continue;
        element.removeAttribute(attribute.name);
      }
      visit(element);
    }
  };
  visit(root);
  return root.innerHTML;
}

export function noteHtmlToPlainText(html: string, alreadySanitized = false): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").trim();
  const safeHtml = alreadySanitized ? html : sanitizeRichNoteHtml(html);
  const documentNode = new DOMParser().parseFromString(`<div id="note-root">${safeHtml}</div>`, "text/html");
  const root = documentNode.getElementById("note-root");
  return (root?.innerText ?? root?.textContent ?? "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd();
}
