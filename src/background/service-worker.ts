/**
 * PlotArmor Background Service Worker (MV3)
 *
 * Responsibilities:
 * - Initialize default storage on install
 * - Update extension badge with daily hidden count
 * - Handle cross-device sync via chrome.storage.sync (optional)
 * - Expose messaging API for content scripts needing TMDB/MAL data
 */

import { logger } from '../shared/logger';

// ─── Install / Update ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({
      keywords: [],
      site_reddit: true,
      site_twitter: true,
      site_youtube: true,
      watch_list: [],
      stats_hidden_count: 0,
      stats_hidden_today: 0,
      stats_last_date: new Date().toISOString().slice(0, 10),
      scan_cache: {},
    });

    logger.log('PlotArmor installed — default settings written');
  }
});

// ─── Badge Updates ────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes.stats_hidden_today !== undefined) {
    const count: number = changes.stats_hidden_today.newValue ?? 0;
    updateBadge(count);
  }
});

function updateBadge(count: number): void {
  const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#3355ff' });
}

// ─── Message Handling ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FETCH_TMDB') {
    handleTmdbFetch(message.query, message.mediaType)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }

  if (message.type === 'FETCH_MAL') {
    handleMalFetch(message.query)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

// ─── TMDB Integration ─────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function handleTmdbFetch(
  query: string,
  mediaType: 'movie' | 'tv'
): Promise<{ keywords: string[] }> {
  const settings = await chrome.storage.local.get('tmdb_api_key');
  const apiKey: string = settings.tmdb_api_key ?? '';

  if (!apiKey) {
    return { keywords: [] };
  }

  const searchUrl = `${TMDB_BASE}/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const firstResult = searchData.results?.[0];
  if (!firstResult) return { keywords: [] };

  // Fetch cast and keywords for the top result
  const [creditsRes, keywordsRes] = await Promise.all([
    fetch(`${TMDB_BASE}/${mediaType}/${firstResult.id}/credits?api_key=${apiKey}`),
    fetch(`${TMDB_BASE}/${mediaType}/${firstResult.id}/keywords?api_key=${apiKey}`),
  ]);

  const credits = await creditsRes.json();
  const keywordsData = await keywordsRes.json();

  const cast: string[] = (credits.cast ?? [])
    .slice(0, 20)
    .map((c: { name: string }) => c.name.toLowerCase());

  const plotKeywords: string[] = (
    keywordsData.keywords ?? keywordsData.results ?? []
  ).map((k: { name: string }) => k.name.toLowerCase());

  return { keywords: [...cast, ...plotKeywords] };
}

// ─── MyAnimeList Integration ──────────────────────────────────────────────────

const MAL_BASE = 'https://api.myanimelist.net/v2';

async function handleMalFetch(query: string): Promise<{ keywords: string[] }> {
  const settings = await chrome.storage.local.get('mal_client_id');
  const clientId: string = settings.mal_client_id ?? '';

  if (!clientId) {
    return { keywords: [] };
  }

  const searchUrl = `${MAL_BASE}/anime?q=${encodeURIComponent(query)}&limit=1&fields=characters`;
  const res = await fetch(searchUrl, {
    headers: { 'X-MAL-CLIENT-ID': clientId },
  });

  if (!res.ok) return { keywords: [] };

  const data = await res.json();
  const anime = data.data?.[0]?.node;
  if (!anime) return { keywords: [] };

  // MAL doesn't expose character lists in search — return title variants
  const keywords = [
    anime.title?.toLowerCase(),
    anime.alternative_titles?.en?.toLowerCase(),
    anime.alternative_titles?.ja?.toLowerCase(),
  ].filter(Boolean) as string[];

  return { keywords };
}
