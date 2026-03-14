/**
 * YouTube Content Script
 *
 * YouTube is a Polymer/LitElement SPA — navigation fires the
 * `yt-navigate-finish` custom event. initContentScript() internally
 * tears down the previous instance before creating a new one.
 */

import { initContentScript } from '../common/content-init';
import { SITE_CONFIGS } from '../../types/sites';
import { logger } from '../../shared/logger';

(async () => {
  const cfg = SITE_CONFIGS.youtube;
  const youtubeConfig = {
    siteId: cfg.id,
    selectors: cfg.selectors,
    containerSelector: cfg.containerSelector,
    mediaSelectors: cfg.mediaSelectors,
  } as const;

  await initContentScript(youtubeConfig);

  let navTimeout: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener('yt-navigate-finish', () => {
    logger.log('YouTube navigation detected');
    if (navTimeout) clearTimeout(navTimeout);
    navTimeout = setTimeout(() => {
      navTimeout = null;
      initContentScript(youtubeConfig);
    }, 600);
  });
})();
