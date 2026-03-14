/**
 * Reddit Content Script
 *
 * Handles both new Reddit (shreddit web components) and old Reddit.
 * Reddit is server-side rendered with no SPA navigation, so a single
 * MutationObserver pass is sufficient (infinite scroll handled by DomScanner).
 */

import { initContentScript } from '../common/content-init';
import { SITE_CONFIGS } from '../../types/sites';

(async () => {
  const cfg = SITE_CONFIGS.reddit;
  await initContentScript({
    siteId: 'reddit',
    selectors: cfg.selectors,
    containerSelector: cfg.containerSelector,
    mediaSelectors: cfg.mediaSelectors,
  });
})();
