import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Content script build (IIFE, self-contained).
 *
 * Chrome MV3 manifest-declared content_scripts cannot use ES module
 * imports. Each content script must be a single self-contained file.
 *
 * Called once per content script via:
 *   CONTENT_ENTRY=reddit vite build --config vite.config.content.ts
 *
 * Produces: dist/content/{reddit|twitter}.js as IIFE bundles.
 */

const entry = process.env.CONTENT_ENTRY ?? 'reddit';

const entryMap: Record<string, string> = {
  reddit: 'src/content/reddit/reddit.content.ts',
  twitter: 'src/content/twitter/twitter.content.ts',
};

const entryFile = entryMap[entry];
if (!entryFile) {
  throw new Error(`Unknown CONTENT_ENTRY: ${entry}. Expected one of: ${Object.keys(entryMap).join(', ')}`);
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // preserve main build output
    sourcemap: process.env.NODE_ENV !== 'production',

    rollupOptions: {
      input: resolve(__dirname, entryFile),
      output: {
        entryFileNames: `content/${entry}.js`,
        format: 'iife',
      },
    },

    // Single input allows inlineDynamicImports (all deps bundled inline)
    lib: undefined,
  },

  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
