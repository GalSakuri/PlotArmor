/**
 * Centralized chrome.storage access layer.
 * All reads/writes go through these helpers to keep keys consistent.
 */

import type { PlotArmorStorage, SiteId } from '../types/storage';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: PlotArmorStorage = {
  keywords: [],
  site_reddit: true,
  site_twitter: true,
  watch_list: [],
  stats_hidden_count: 0,
  stats_hidden_today: 0,
  stats_last_date: '',
  scan_cache: {},
};

// ─── Generic Helpers ──────────────────────────────────────────────────────────

export async function getStorage<K extends keyof PlotArmorStorage>(
  key: K
): Promise<PlotArmorStorage[K]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve((result[key] as PlotArmorStorage[K]) ?? DEFAULTS[key]);
    });
  });
}

export async function setStorage<K extends keyof PlotArmorStorage>(
  key: K,
  value: PlotArmorStorage[K]
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ─── Convenience Accessors ────────────────────────────────────────────────────

export const getKeywords = () => getStorage('keywords');
export const setKeywords = (v: string[]) => setStorage('keywords', v);

export const getSiteEnabled = (site: SiteId) =>
  getStorage(`site_${site}` as keyof PlotArmorStorage) as Promise<boolean>;

export const setSiteEnabled = (site: SiteId, value: boolean) =>
  setStorage(`site_${site}` as keyof PlotArmorStorage, value as never);

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function incrementHiddenCount(delta = 1): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [count, todayCount, lastDate] = await Promise.all([
    getStorage('stats_hidden_count'),
    getStorage('stats_hidden_today'),
    getStorage('stats_last_date'),
  ]);

  const isNewDay = lastDate !== today;
  await chrome.storage.local.set({
    stats_hidden_count: count + delta,
    stats_hidden_today: (isNewDay ? 0 : todayCount) + delta,
    stats_last_date: today,
  });
}

