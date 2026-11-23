import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Use the preinstalled Chromium when present (CI installs its own)
const localChromium = '/opt/pw-browsers/chromium';
const executablePath = !process.env.CI && fs.existsSync(localChromium) ? localChromium : undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    launchOptions: {
      executablePath,
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  webServer: { command: 'npx vite preview --port 4173 --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
});
