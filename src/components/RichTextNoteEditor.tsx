import { useCallback, useEffect, useRef, useState, type CSSProperties, type ClipboardEvent, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { noteHtmlToPlainText, plainTextToNoteHtml, sanitizeRichNoteHtml } from "../notesRichText";
import { uiText } from "../i18n";

interface RichTextNoteEditorProps {
  slideId: string;
  html?: string;
  plainText: string;
  placeholder: string;
  className: string;
  style?: CSSProperties;
  onChange: (plainText: string, html: string) => void;
  onFocus?: () => void;
}

interface MenuPoint { x: number; y: number; }

function noteDocumentHtml(html: string | undefined, plainText: string): string {
  const stored = String(html ?? "").trim();
  return stored ? sanitizeRichNoteHtml(stored) : plainTextToNoteHtml(plainText);
}

export function RichTextNoteEditor({ slideId, html, plainText, placeholder, className, style, onChange, onFocus }: RichTextNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastCommittedRef = useRef("");
  const [menu, setMenu] = useState<MenuPoint | null>(null);

  const commit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const clean = sanitizeRichNoteHtml(editor.innerHTML);
    const text = noteHtmlToPlainText(clean, true);
    lastCommittedRef.current = clean;
    onChange(text, clean);
  }, [onChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const next = noteDocumentHtml(html, plainText);
    if (editor.innerHTML !== next) editor.innerHTML = next;
    lastCommittedRef.current = next;
  }, [html, plainText, slideId]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".rich-note-context-menu")) return;
      setMenu(null);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", close, true); window.removeEventListener("keydown", key, true); };
  }, [menu]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const range = savedRangeRef.current;
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const command = (name: string, value?: string) => {
    restoreSelection();
    try { document.execCommand(name, false, value); } catch { /* WebView can omit individual legacy commands. */ }
    rememberSelection();
    commit();
  };

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const clean = sanitizeRichNoteHtml(event.currentTarget.innerHTML);
    if (clean === lastCommittedRef.current) return;
    const text = noteHtmlToPlainText(clean, true);
    lastCommittedRef.current = clean;
    onChange(text, clean);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    rememberSelection();
    const width = 318;
    const height = 250;
    setMenu({ x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX)), y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY)) });
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rich = event.clipboardData.getData("text/html");
    const plain = event.clipboardData.getData("text/plain");
    if (rich) document.execCommand("insertHTML", false, sanitizeRichNoteHtml(rich));
    else document.execCommand("insertText", false, plain);
    commit();
  };

  const menuUi = menu ? createPortal(
    <div className="rich-note-context-menu" style={{ left: menu.x, top: menu.y }} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => event.stopPropagation()}>
      <div className="rich-note-context-title">{uiText("Szöveg formázása")}</div>
      <div className="rich-note-context-row rich-note-format-buttons">
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("bold")} title={uiText("Félkövér")}><strong>B</strong></button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("italic")} title={uiText("Dőlt")}><em>I</em></button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("underline")} title={uiText("Aláhúzott")}><u>U</u></button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("strikeThrough")} title={uiText("Áthúzott")}><s>S</s></button>
        <label className="rich-note-color-button" title={uiText("Szövegszín")}><span>A</span><input type="color" defaultValue="#24262a" onChange={(event) => command("foreColor", event.currentTarget.value)} /></label>
        <label className="rich-note-color-button highlight" title={uiText("Kiemelés")}><span>▰</span><input type="color" defaultValue="#fff19b" onChange={(event) => { restoreSelection(); try { document.execCommand("hiliteColor", false, event.currentTarget.value); } catch { document.execCommand("backColor", false, event.currentTarget.value); } commit(); }} /></label>
      </div>
      <div className="rich-note-context-row">
        <select defaultValue="p" onChange={(event) => { command("formatBlock", event.currentTarget.value); event.currentTarget.value = "p"; }} title={uiText("Bekezdés stílusa")}>
          <option value="p">{uiText("Bekezdés")}</option><option value="h1">{uiText("Címsor 1")}</option><option value="h2">{uiText("Címsor 2")}</option><option value="h3">{uiText("Címsor 3")}</option><option value="blockquote">{uiText("Idézet")}</option>
        </select>
        <select defaultValue="3" onChange={(event) => command("fontSize", event.currentTarget.value)} title={uiText("Betűméret")}>
          <option value="2">{uiText("Kicsi")}</option><option value="3">{uiText("Normál")}</option><option value="4">{uiText("Nagy")}</option><option value="5">{uiText("Nagyobb")}</option><option value="6">{uiText("Cím")}</option><option value="7">{uiText("Óriás")}</option>
        </select>
      </div>
      <div className="rich-note-context-row rich-note-format-buttons wide">
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("justifyLeft")} title={uiText("Balra igazítás")}>≡←</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("justifyCenter")} title={uiText("Középre igazítás")}>≡</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("justifyRight")} title={uiText("Jobbra igazítás")}>→≡</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("justifyFull")} title={uiText("Sorkizárt")}>☰</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")} title={uiText("Felsorolás")}>• List</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")} title={uiText("Számozás")}>1. List</button>
      </div>
      <div className="rich-note-context-row rich-note-format-buttons wide">
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("outdent")}>{uiText("Behúzás csökkentése")}</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("indent")}>{uiText("Behúzás növelése")}</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")}>{uiText("Formázás törlése")}</button>
      </div>
      <div className="rich-note-context-hint">{uiText("Jobb klikkes jegyzetmenü · ⌘B / ⌘I / ⌘U is használható")}</div>
    </div>, document.body) : null;

  return <>
    <div
      ref={editorRef}
      className={`${className} rich-note-editor`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck
      onFocus={() => { onFocus?.(); rememberSelection(); }}
      onBlur={() => { commit(); }}
      onInput={handleInput}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onContextMenu={handleContextMenu}
      onPaste={handlePaste}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    />
    {menuUi}
  </>;
}
