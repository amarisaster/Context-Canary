import { defineConfig } from 'vite';

export default defineConfig({
  // Vite options for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri supports es2021
    target: ['es2021', 'chrome100', 'safari13'],
    // Don't minify for debugging
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debugging
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
