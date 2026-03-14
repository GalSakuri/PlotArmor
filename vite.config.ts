import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import type { Plugin } from 'vite';

function copyStaticAssetsPlugin(): Plugin {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
      copyFileSync('manifest.json', 'dist/manifest.json');
      if (existsSync('public/icons')) {
        cpSync('public/icons', 'dist/icons', { recursive: true });
      }
      console.log('[PlotArmor] Static assets copied to dist/');
    },
  };
}

/**
 * Main build: Popup (React), Background Service Worker, Web Worker.
 * These all support ES modules in Chrome MV3.
 */
export default defineConfig({
  plugins: [react(), copyStaticAssetsPlugin()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',

    rollupOptions: {
      input: {
        'popup/index': resolve(__dirname, 'popup/index.html'),
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'worker/scanner.worker': resolve(__dirname, 'src/worker/scanner.worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
        format: 'es',
      },
    },
  },

  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },

  worker: {
    format: 'es',
  },
});
