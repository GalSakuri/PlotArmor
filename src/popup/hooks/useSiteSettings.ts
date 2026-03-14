import { useState, useEffect, useCallback } from 'react';
import { getSiteEnabled, setSiteEnabled } from '../../shared/storage-keys';
import type { SiteId } from '../../types/storage';

type SiteStates = Record<SiteId, boolean>;

export function useSiteSettings() {
  const [sites, setSites] = useState<SiteStates>({
    reddit: true,
    twitter: true,
    youtube: true,
  });

  useEffect(() => {
    Promise.all([
      getSiteEnabled('reddit'),
      getSiteEnabled('twitter'),
      getSiteEnabled('youtube'),
    ]).then(([reddit, twitter, youtube]) => {
      setSites({ reddit, twitter, youtube });
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      const keys: SiteId[] = ['reddit', 'twitter', 'youtube'];
      keys.forEach(id => {
        const key = `site_${id}` as const;
        if (changes[key]) {
          setSites(prev => ({ ...prev, [id]: changes[key].newValue }));
        }
      });
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const toggle = useCallback((siteId: SiteId) => {
    setSites(prev => {
      const updated = { ...prev, [siteId]: !prev[siteId] };
      setSiteEnabled(siteId, updated[siteId]);
      return updated;
    });
  }, []);

  return { sites, toggle };
}
