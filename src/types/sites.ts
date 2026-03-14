import type { SiteId } from './storage';
export type { SiteId };

export interface SiteConfig {
  id: SiteId;
  label: string;
  /** CSS selectors for text containers to scan */
  selectors: string[];
  /** CSS selector for the post/tweet container that wraps text + media */
  containerSelector: string;
  /** CSS selectors for media elements (images, videos) inside a post container */
  mediaSelectors: string[];
  /** Whether the site uses SPA navigation requiring re-init */
  isSPA: boolean;
}

export const SITE_CONFIGS: Record<SiteId, SiteConfig> = {
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    selectors: [
      // New Reddit (shreddit)
      'shreddit-post[post-title]',
      '[data-testid="post-title"]',
      '[slot="text-body"]',
      // Old Reddit
      '.title.may-blank',
      '.md',
      '.usertext-body',
      // Comment text
      '.comment .md',
    ],
    containerSelector: 'shreddit-post, .thing, [data-testid="post-container"], .Post',
    mediaSelectors: [
      'img[src*="preview.redd.it"]',
      'img[src*="external-preview.redd.it"]',
      'video',
      '[data-testid="post-media-container"]',
      'a[href*="i.redd.it"] img',
    ],
    isSPA: false,
  },
  twitter: {
    id: 'twitter',
    label: 'Twitter / X',
    selectors: [
      '[data-testid="tweetText"]',
      '[data-testid="card.layoutSmall.detail"]',
      '[data-testid="card.layoutLarge.detail"]',
      // Trending/search result descriptions
      '[data-testid="trend"] span',
      // Article cards
      'article [role="link"] span',
    ],
    containerSelector: 'article',
    mediaSelectors: [
      '[data-testid="tweetPhoto"]',
      '[data-testid="videoPlayer"]',
      '[data-testid="card.layoutSmall.media"]',
      '[data-testid="card.layoutLarge.media"]',
      '[data-testid="previewInterstitial"]',
    ],
    isSPA: true,
  },
};
