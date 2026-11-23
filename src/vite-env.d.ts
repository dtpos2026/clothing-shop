/// <reference types="vite/client" />

interface ElectronStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<boolean>;
  removeItem: (key: string) => Promise<boolean>;
}

interface ElectronAPI {
  hostname: string;
  platform: string;
  version: string;
  /** Opens a native Save dialog. Returns the chosen path or null if cancelled. */
  saveFile: (opts: { defaultName: string; data: Uint8Array; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  /** Writes into the app's data folder (safety backups etc.). Returns the absolute path. */
  writeAppFile: (relPath: string, data: Uint8Array) => Promise<string>;
  readAppFile: (relPath: string) => Promise<Uint8Array | null>;
  listAppFiles: (relDir: string) => Promise<{ name: string; size: number; mtime: number }[]>;
  revealFile: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  /** Prints HTML through Chromium's printer pipeline (supports silent printing to a named printer). */
  printHtml: (opts: { html: string; silent?: boolean; deviceName?: string; pageWidthMm?: number; pageHeightMm?: number; landscape?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  listPrinters: () => Promise<{ name: string; displayName: string; isDefault: boolean }[]>;
}

interface Window {
  electronStore?: ElectronStore;
  electronAPI?: ElectronAPI;
}
