import { useEffect, useMemo, useRef, useState } from "react";
import { contextMenuById, type ContextMenuCommandId } from "../contextMenuRegistry";
import { tr } from "../i18n";
import type { AppLanguage } from "../types";

interface ContextMenuProps {
  x: number;
  y: number;
  items: string[];
  language: AppLanguage;
  onCommand: (id: ContextMenuCommandId) => void;
  isVisible: (id: ContextMenuCommandId) => boolean;
  isEnabled: (id: ContextMenuCommandId) => boolean;
  onClose: () => void;
}

function compactItems(items: string[], isVisible: (id: ContextMenuCommandId) => boolean): string[] {
  const out: string[] = [];
  for (const raw of items) {
    if (raw === "separator") {
      if (out.length && out[out.length - 1] !== "separator") out.push(raw);
      continue;
    }
    const id = raw as ContextMenuCommandId;
    const definition = contextMenuById.get(id);
    if (!definition || !isVisible(id)) continue;
    out.push(id);
  }
  while (out[out.length - 1] === "separator") out.pop();
  return out;
}

export function ContextMenu({ x, y, items, language, onCommand, isVisible, isEnabled, onClose }: ContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<ContextMenuCommandId | null>(null);
  const visibleItems = useMemo(() => compactItems(items, isVisible), [items, isVisible]);
  const t = (text: string) => tr(language, text);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const passiveClose = () => onClose();
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("resize", passiveClose);
    window.addEventListener("blur", passiveClose);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", passiveClose);
      window.removeEventListener("blur", passiveClose);
    };
  }, [onClose]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }, [x, y, visibleItems.length]);

  const run = (id: ContextMenuCommandId) => {
    if (!isEnabled(id)) return;
    onCommand(id);
    onClose();
  };

  const renderItem = (raw: string, index: number) => {
    if (raw === "separator") return <div key={`sep-${index}`} className="preon-context-separator" />;
    const id = raw as ContextMenuCommandId;
    const definition = contextMenuById.get(id);
    if (!definition) return null;
    const children = definition.children ? compactItems(definition.children, isVisible) : [];
    const enabled = isEnabled(id) && (children.length > 0 || !definition.children);
    if (children.length) {
      const isOpen = openSubmenu === id;
      return <div key={id} className="preon-context-submenu-wrap" onPointerEnter={() => setOpenSubmenu(id)} onPointerLeave={() => setOpenSubmenu((current) => current === id ? null : current)}>
        <button type="button" className="preon-context-item" disabled={!enabled}>
          <span>{t(definition.label)}</span><span className="preon-context-chevron">›</span>
        </button>
        {isOpen && <div className="preon-context-menu preon-context-submenu">
          {children.map((childRaw) => {
            const childId = childRaw as ContextMenuCommandId;
            const child = contextMenuById.get(childId);
            if (!child) return null;
            return <button key={childId} type="button" className="preon-context-item" disabled={!isEnabled(childId)} onClick={() => run(childId)}>
              <span>{t(child.label)}</span>{child.shortcut && <kbd>{child.shortcut}</kbd>}
            </button>;
          })}
        </div>}
      </div>;
    }
    return <button key={id} type="button" className="preon-context-item" disabled={!enabled} onClick={() => run(id)}>
      <span>{t(definition.label)}</span>{definition.shortcut && <kbd>{definition.shortcut}</kbd>}
    </button>;
  };

  if (!visibleItems.length) return null;
  return <div ref={rootRef} className="preon-context-menu" role="menu" onContextMenu={(event) => event.preventDefault()}>
    {visibleItems.map(renderItem)}
  </div>;
}
