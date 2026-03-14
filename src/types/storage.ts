export type SiteId = 'reddit' | 'twitter';

export interface WatchEntry {
  id: string;
  title: string;
  type: 'anime' | 'manga' | 'tv' | 'movie';
  /** Current progress marker, e.g. "Season 2 Episode 5" or "Chapter 112" */
  progress: string;
  /** Keywords derived from metadata for this entry */
  keywords: string[];
  /** TMDB or MAL numeric ID */
  externalId?: number;
  /** ISO timestamp of last metadata refresh */
  lastRefreshed?: string;
}

export interface PlotArmorStorage {
  /** Raw user-added keywords */
  keywords: string[];
  /** Per-site enable flags */
  site_reddit: boolean;
  site_twitter: boolean;
  /** Watching list entries */
  watch_list: WatchEntry[];
  /** Lifetime spoiler-hidden counter */
  stats_hidden_count: number;
  /** Hidden count for today only (resets daily) */
  stats_hidden_today: number;
  /** ISO date string for daily reset tracking */
  stats_last_date: string;
  /** LRU cache: postId/url → already scanned, skip */
  scan_cache: Record<string, boolean>;
}

