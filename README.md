# PlotArmor

A high-performance Chrome extension that detects and blurs spoilers for anime, manga, TV shows, and movies across Reddit, Twitter/X, and YouTube.

## Features

- **Multi-keyword matching** using the Aho-Corasick algorithm for O(n) scanning
- **Surgical blurring** of text and attached media (images, videos) with click-to-reveal overlays
- **Viewport-aware scanning** using IntersectionObserver — only processes visible content
- **Infinite scroll support** via MutationObserver for dynamically loaded content
- **SPA navigation handling** for Twitter/X and YouTube
- **Real-time hot-reload** — add or remove keywords without refreshing the page
- **Per-site toggles** to enable/disable protection on each platform
- **TMDB and MyAnimeList integration** for fetching character names and plot keywords

## Supported Sites

| Site | Text | Images | Videos | Infinite Scroll | SPA Nav |
|------|------|--------|--------|-----------------|---------|
| Reddit | Yes | Yes | Yes | Yes | — |
| Twitter / X | Yes | Yes | Yes | Yes | Yes |
| YouTube | Yes | Yes | — | Yes | Yes |

## Installation

### From source

```bash
git clone https://github.com/YOUR_USERNAME/PlotArmor.git
cd PlotArmor
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Development

```bash
npm run dev          # Watch mode — rebuilds on file changes
npm run test         # Run all tests
npm run test:watch   # Vitest in watch mode
npm run typecheck    # TypeScript type-check
```

## How It Works

### Architecture

The extension uses a two-stage build:

1. **Main build** (`vite.config.ts`) — Popup (React + Tailwind), background service worker, and web worker. Built as ES modules.
2. **Content script build** (`vite.config.content.ts`) — One self-contained IIFE bundle per site. Chrome MV3 manifest-declared content scripts cannot use ES module imports, so each is fully bundled with all dependencies inlined.

### Detection Pipeline

```
Keywords (chrome.storage) → Aho-Corasick Trie → DomScanner → DomCloaker
```

1. **DomScanner** monitors the page using `IntersectionObserver` (viewport detection) and `MutationObserver` (new content). Only elements entering the viewport are scanned.
2. Text content is matched against an Aho-Corasick finite automaton that finds all keyword occurrences in a single pass.
3. When a match is found, **DomCloaker** blurs the text element and walks up to the parent post container to also blur any attached images and videos.
4. All DOM mutations are batched via `requestAnimationFrame` to prevent layout thrashing.

### Tech Stack

- **TypeScript** (strict mode)
- **React 18** + **Tailwind CSS** for the popup dashboard
- **Vite** for building
- **Vitest** for testing
- **Chrome Extension Manifest V3**

## Usage

1. Click the PlotArmor icon in your browser toolbar
2. Add spoiler keywords (e.g., character names, plot events)
3. Toggle protection per site
4. Browse normally — matching content is blurred with a click-to-reveal overlay

Keywords are case-insensitive and match across all enabled sites.

## API Integration (Optional)

To automatically fetch character names and plot keywords:

- **TMDB**: Add your API key as `tmdb_api_key` in extension storage
- **MyAnimeList**: Add your client ID as `mal_client_id` in extension storage

## License

MIT
