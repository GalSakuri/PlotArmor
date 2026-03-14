/**
 * Twitter / X Content Script
 *
 * Twitter is a React SPA — URL changes via pushState don't trigger a
 * full page reload. We intercept pushState/popstate to detect navigation
 * and re-run the scanner on new content.
 *
 * initContentScript() internally tears down the previous instance before
 * creating a new one, so no resources leak across navigations.
 */

import { initContentScript } from '../common/content-init';
import { SITE_CONFIGS } from '../../types/sites';
import { logger } from '../../shared/logger';

(async () => {
  const cfg = SITE_CONFIGS.twitter;
  const twitterConfig = {
    siteId: cfg.id,
    selectors: cfg.selectors,
    containerSelector: cfg.containerSelector,
    mediaSelectors: cfg.mediaSelectors,
  } as const;

  await initContentScript(twitterConfig);

  // ── SPA Navigation Handling ──────────────────────────────────────────────

  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    originalPushState(...args);
    window.dispatchEvent(new Event('plot-armor-navigate'));
  };

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('plot-armor-navigate'));
  });

  let navTimeout: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('plot-armor-navigate', () => {
    logger.log('Twitter SPA navigation detected');
    if (navTimeout) clearTimeout(navTimeout);
    navTimeout = setTimeout(() => {
      navTimeout = null;
      initContentScript(twitterConfig);
    }, 800);
  });
})();
