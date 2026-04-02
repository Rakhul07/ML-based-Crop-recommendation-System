import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages set VITE_BASE="/<repo-name>/" (see workflow).
  // For Capacitor (mobile APK) use relative base:
  base: process.env.VITE_BASE || './',
  server: {
    port: 5173,
  },
});
