import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Super Admin panel – separate bundle, deployed to Firebase Hosting (dist-admin)
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 8090 },
  build: { outDir: 'dist-admin', emptyOutDir: true, rollupOptions: { input: path.resolve(__dirname, 'admin.html') } },
});
