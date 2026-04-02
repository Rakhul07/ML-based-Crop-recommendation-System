import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages use: base: '/Mini-Project/',
  // For Capacitor (mobile APK) use relative base:
  base: './',
  server: {
    port: 5173,
  },
});