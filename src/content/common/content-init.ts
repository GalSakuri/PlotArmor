/**
 * Shared bootstrap logic for all site content scripts.
 *
 * Each site entry (reddit.content.ts, etc.) calls initContentScript()
 * with site-specific selectors. This function:
 *   1. Checks if the extension is enabled for this site
 *   2. Loads keywords from storage
 *   3. Creates the WorkerBridge + DomCloaker + DomScanner
 *   4. Wires up chrome.storage.onChanged for hot-reload
 *
 * Returns a teardown function so SPA navigations can clean up before re-init.
 */

import { Scanner } from '../../worker/scanner';
import { DomScanner } from './dom-scanner';
import { DomCloaker } from './dom-cloaker';
import { getKeywords, getSiteEnabled, incrementHiddenCount } from '../../shared/storage-keys';
import { logger } from '../../shared/logger';
import type { SiteId } from '../../types/storage';
import type { ScanMatch } from '../../types/messages';

interface ContentScriptConfig {
  siteId: SiteId;
  selectors: string[];
  /** CSS selector to find the post container that wraps text + media */
  containerSelector?: string;
  /** CSS selectors for media elements inside the post container */
  mediaSelectors?: string[];
  onMatch?: (el: Element, matches: ScanMatch[]) => void;
}

/** Teardown function returned by initContentScript */
export type TeardownFn = () => void;

// Track active instances per site to prevent leaks on SPA re-init
const activeInstances = new Map<SiteId, TeardownFn>();

export async function initContentScript(config: ContentScriptConfig): Promise<TeardownFn> {
  const { siteId, selectors } = config;

  // Tear down any existing instance for this site (SPA re-navigation)
  const existing = activeInstances.get(siteId);
  if (existing) {
    existing();
    activeInstances.delete(siteId);
  }

  const [enabled, keywords] = await Promise.all([
    getSiteEnabled(siteId),
    getKeywords(),
  ]);

  if (!enabled) {
    logger.log(`Site "${siteId}" is disabled, skipping init`);
    const teardown = watchStorageForKeywords(config);
    activeInstances.set(siteId, teardown);
    return teardown;
  }

  if (keywords.length === 0) {
    logger.log('No keywords configured, skipping init');
    const teardown = watchStorageForKeywords(config);
    activeInstances.set(siteId, teardown);
    return teardown;
  }

  const teardown = await bootstrap(siteId, selectors, keywords, config.containerSelector, config.mediaSelectors, config.onMatch);
  activeInstances.set(siteId, teardown);
  return teardown;
}

// ─── Internal ──────────────────────────────────────────────────────────────────

async function bootstrap(
  siteId: SiteId,
  selectors: string[],
  keywords: string[],
  containerSelector?: string,
  mediaSelectors?: string[],
  onMatch?: (el: Element, matches: ScanMatch[]) => void,
): Promise<TeardownFn> {
  // Content scripts cannot create Workers with chrome-extension:// URLs
  // (Workers run in the page's origin, not the extension's). Use inline
  // Aho-Corasick instead — O(n) matching completes in microseconds for
  // typical social media text, so a Worker is unnecessary here.
  const scanner_engine = new Scanner();
  await scanner_engine.init(keywords);
  logger.log(`Scanner ready with ${keywords.length} keywords for "${siteId}"`);

  const cloaker = new DomCloaker();

  const scanner = new DomScanner({
    selectors,
    async onNodes(nodes) {
      const texts = nodes.map(n => n.textContent ?? '');
      const matches = await scanner_engine.scan(texts);

      if (matches.length === 0) return;

      const byIndex = new Map<number, ScanMatch[]>();
      for (const m of matches) {
        const arr = byIndex.get(m.textIndex) ?? [];
        arr.push(m);
        byIndex.set(m.textIndex, arr);
      }

      let hiddenCount = 0;
      for (const [idx, nodeMatches] of byIndex) {
        const matchedEl = nodes[idx];
        const keyword = nodeMatches[0].keyword;

        // If we have a container selector, blur the entire post container
        // so text + images + videos are all covered by one overlay.
        // Otherwise fall back to blurring just the text element.
        if (containerSelector) {
          const container = matchedEl.closest(containerSelector);
          if (container) {
            cloaker.cloak(container as HTMLElement, keyword);
          } else {
            cloaker.cloak(matchedEl, keyword);
          }
        } else {
          cloaker.cloak(matchedEl, keyword);
        }

        onMatch?.(matchedEl, nodeMatches);
        hiddenCount++;
      }

      if (hiddenCount > 0) {
        await incrementHiddenCount(hiddenCount);
      }
    },
  });

  scanner.observe(document.body);

  // ── Hot-reload on storage changes ────────────────────────────────────────

  const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local') return;

    if (changes.keywords?.newValue !== undefined) {
      const newKeywords: string[] = changes.keywords.newValue;
      if (newKeywords.length === 0) {
        cloaker.uncloak();
      } else {
        scanner_engine.updateKeywords(newKeywords);
        scanner.rescan();
      }
    }

    const siteKey = `site_${siteId}` as const;
    if (changes[siteKey]?.newValue === false) {
      teardown();
      logger.log(`Site "${siteId}" disabled via storage change`);
    }
  };

  chrome.storage.onChanged.addListener(storageListener);

  // ── Teardown function ────────────────────────────────────────────────────

  let tornDown = false;
  const teardown = () => {
    if (tornDown) return;
    tornDown = true;
    chrome.storage.onChanged.removeListener(storageListener);
    scanner.disconnect();
    cloaker.uncloak();
    scanner_engine.destroy();
    activeInstances.delete(siteId);
    logger.log(`Teardown complete for "${siteId}"`);
  };

  return teardown;
}

/** Called when no keywords are set — waits for user to add some */
function watchStorageForKeywords(config: ContentScriptConfig): TeardownFn {
  let removed = false;

  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local') return;
    if (changes.keywords?.newValue?.length > 0) {
      chrome.storage.onChanged.removeListener(listener);
      removed = true;
      bootstrap(
        config.siteId, config.selectors, changes.keywords.newValue,
        config.containerSelector, config.mediaSelectors, config.onMatch,
      ).then(teardown => {
        activeInstances.set(config.siteId, teardown);
      });
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    if (!removed) {
      chrome.storage.onChanged.removeListener(listener);
    }
  };
}
