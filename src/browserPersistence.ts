import type { PresentationProject } from "./types";

export interface BrowserSessionSnapshot {
  version: 1;
  savedAt: string;
  project: PresentationProject;
  activeSlideId: string;
  slideSelection: string[];
  editingMasterId: string | null;
  editingNotesBoard: boolean;
  zoom: number;
  pan: { x: number; y: number };
}

const DB_NAME = "preon-lite";
const DB_VERSION = 1;
const STORE_NAME = "session";
const SESSION_KEY = "current";

let preloadedSession: BrowserSessionSnapshot | null | undefined;
let dbPromise: Promise<IDBDatabase> | null = null;
let persistentStoragePromise: Promise<boolean> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nem érhető el."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB megnyitási hiba."));
    request.onblocked = () => reject(new Error("IndexedDB megnyitása blokkolva van."));
  });
  return dbPromise;
}

export async function loadBrowserSession(): Promise<BrowserSessionSnapshot | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(SESSION_KEY);
      request.onsuccess = () => {
        const value = request.result as BrowserSessionSnapshot | undefined;
        if (!value || value.version !== 1 || !value.project) resolve(null);
        else resolve(value);
      };
      request.onerror = () => reject(request.error ?? new Error("Munkamenet olvasási hiba."));
    });
  } catch {
    return null;
  }
}

export async function saveBrowserSession(snapshot: BrowserSessionSnapshot): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(snapshot, SESSION_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Munkamenet mentési hiba."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Munkamenet mentése megszakadt."));
  });
}

export function setPreloadedBrowserSession(snapshot: BrowserSessionSnapshot | null): void {
  preloadedSession = snapshot;
}

export function consumePreloadedBrowserSession(): BrowserSessionSnapshot | null {
  const value = preloadedSession ?? null;
  preloadedSession = undefined;
  return value;
}

export async function requestPersistentBrowserStorage(): Promise<boolean> {
  if (persistentStoragePromise) return persistentStoragePromise;
  persistentStoragePromise = (async () => {
    try {
      if (!navigator.storage?.persist) return false;
      if (await navigator.storage.persisted?.()) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  })();
  return persistentStoragePromise;
}
