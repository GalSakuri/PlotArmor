import { useState, useEffect, useCallback } from 'react';
import { getKeywords, setKeywords } from '../../shared/storage-keys';

export function useKeywords() {
  const [keywords, setLocal] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKeywords().then(kws => {
      setLocal(kws);
      setLoading(false);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.keywords) setLocal(changes.keywords.newValue ?? []);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const addKeyword = useCallback((raw: string) => {
    const keyword = raw.trim().toLowerCase();
    if (!keyword) return;
    // Derive new state first, then persist — no side effects in updater
    setLocal(prev => {
      if (prev.includes(keyword)) return prev;
      const updated = [...prev, keyword];
      // Persist outside the updater via microtask to avoid StrictMode double-fire
      queueMicrotask(() => setKeywords(updated));
      return updated;
    });
  }, []);

  const removeKeyword = useCallback((keyword: string) => {
    setLocal(prev => {
      const updated = prev.filter(k => k !== keyword);
      queueMicrotask(() => setKeywords(updated));
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setLocal([]);
    setKeywords([]);
  }, []);

  return { keywords, loading, addKeyword, removeKeyword, clearAll };
}
