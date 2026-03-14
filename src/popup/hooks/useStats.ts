import { useState, useEffect } from 'react';
import { getStorage } from '../../shared/storage-keys';

export function useStats() {
  const [hiddenToday, setHiddenToday] = useState(0);
  const [hiddenTotal, setHiddenTotal] = useState(0);

  useEffect(() => {
    Promise.all([
      getStorage('stats_hidden_today'),
      getStorage('stats_hidden_count'),
    ]).then(([today, total]) => {
      setHiddenToday(today);
      setHiddenTotal(total);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.stats_hidden_today) setHiddenToday(changes.stats_hidden_today.newValue ?? 0);
      if (changes.stats_hidden_count) setHiddenTotal(changes.stats_hidden_count.newValue ?? 0);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return { hiddenToday, hiddenTotal };
}
