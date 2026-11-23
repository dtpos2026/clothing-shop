/// <reference types="vite/client" />

interface ElectronStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<boolean>;
  removeItem: (key: string) => Promise<boolean>;
}

interface Window {
  electronStore?: ElectronStore;
}
