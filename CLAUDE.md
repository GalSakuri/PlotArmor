# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Production build → dist/
npm run dev          # Watch mode (rebuilds on file changes)
npm run test         # Run all tests once
npm run test:watch   # Vitest in watch mode
npm run typecheck    # TypeScript type-check without emitting
npx vitest run src/lib/aho-corasick.test.ts   # Run a single test file
```

**Loading the extension:** build first, then open `chrome://extensions` → Enable Developer mode → Load unpacked → select `dist/`.

## Architecture

### Data flow

```
chrome.storage.local (keywords[])
        │
        ▼
WorkerBridge.init()  ──postMessage──▶  scanner.worker.ts
        │                                      │ (owns AhoCorasick trie)
        │  ◀──SCAN_RESULT postMessage──────────┘
        │
  DomScanner (IntersectionObserver + MutationObserver)
        │  collects visible Element[]
        ▼
  WorkerBridge.scan(texts[])  →  ScanMatch[]
        │
        ▼
  DomCloaker.cloak(el, keyword)  →  CSS blur + overlay injected via rAF
```

### Build architecture (two-stage)

Chrome MV3 content scripts declared in `manifest.json` cannot use ES module `import` statements. The build is split into two stages:

1. **`vite.config.ts`** (main build) — Popup, service worker, web worker. ES module format. Code splitting allowed.
2. **`vite.config.content.ts`** (content scripts) — One IIFE build per site (`CONTENT_ENTRY=reddit|twitter`). Each content script is fully self-contained (all deps bundled inline). `emptyOutDir: false` to preserve main build output.

`npm run build` chains both stages. Entry filenames use `[name].js` (no content hash) since `manifest.json` references them directly.

The popup HTML lives at `popup/index.html` (project root, not `src/`) so Vite outputs it to `dist/popup/index.html`.

The Web Worker is loaded via `chrome.runtime.getURL('worker/scanner.worker.js')` (not `new URL(..., import.meta.url)`) because extension content scripts need a stable `chrome-extension://` URL, not a blob URL.

### Key files and their roles

- **`src/lib/aho-corasick.ts`** — Pure algorithmic core. Three-phase: trie insert → BFS failure links → search. Case-insensitive. No browser APIs. During BFS, each node's `output[]` is merged with its failure node's outputs, so `search()` only needs to check `cur.output` — no dictionary link walk needed (the `dict` field is kept for potential future optimization but unused in search).

- **`src/worker/scanner.worker.ts`** — Owns the single `AhoCorasick` instance. Responds to `INIT_TRIE`, `UPDATE_KEYWORDS`, `SCAN_BATCH`. Rebuilds the trie in-place on `UPDATE_KEYWORDS`.

- **`src/worker/worker-bridge.ts`** — Promise-based proxy over `postMessage`. Correlates async scan responses via a `Map<batchId, resolver>` using `crypto.randomUUID()`. Includes a 5s safety timeout per batch.

- **`src/content/common/content-init.ts`** — Shared bootstrap called by both site scripts. Checks `chrome.storage` for enabled state + keywords, wires up `chrome.storage.onChanged` for hot-reload. Tracks active instances per site via `activeInstances` map and returns a teardown function — SPA navigations (Twitter) call this to clean up workers/observers/listeners before re-init, preventing resource leaks.

- **`src/content/common/dom-scanner.ts`** — `IntersectionObserver` triggers scans only for elements entering the viewport (`rootMargin: '200px'` for pre-scan). `MutationObserver` catches new nodes from infinite scroll. 250ms debounce before flushing a batch. Elements are marked with `data-pa-scanned` to prevent re-scanning.

- **`src/content/common/dom-cloaker.ts`** — All DOM mutations go through `requestAnimationFrame` batching. Wraps the target element in a `.pa-spoiler-wrapper` div, injects `.pa-spoiler-overlay` with click-to-reveal toggle. Injects styles once via a `<style id="plot-armor-styles">` tag.

- **`src/background/service-worker.ts`** — Proxies TMDB and MAL API calls (requires `tmdb_api_key` / `mal_client_id` in `chrome.storage.local`). Updates the action badge with today's hidden count.

- **`src/shared/storage-keys.ts`** — All `chrome.storage.local` reads/writes go through typed helpers here. Includes `incrementHiddenCount()` with automatic daily reset tracking.

### Message types

All worker ↔ main-thread communication uses discriminated unions in `src/types/messages.ts`. Both `scanner.worker.ts` and `worker-bridge.ts` have exhaustive `switch` checks — TypeScript will error on unhandled message types.

### Site-specific selectors

CSS selectors for each site live in `src/types/sites.ts` (`SITE_CONFIGS`). Reddit supports both new Reddit (shreddit web components) and old Reddit. Twitter re-calls `initContentScript()` on SPA navigation events (`pushState` intercept).

### Storage schema

Defined in `src/types/storage.ts`. Per-site enable flags use keys `site_reddit`, `site_twitter`. API keys (`tmdb_api_key`, `mal_client_id`) are user-supplied and stored in `chrome.storage.local` — they are not in the schema type but are accessed directly by the service worker.
