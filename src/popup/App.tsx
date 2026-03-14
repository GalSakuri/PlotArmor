import React from 'react';
import { StatsBar } from './components/StatsBar';
import { KeywordInput } from './components/KeywordInput';
import { KeywordList } from './components/KeywordList';
import { SiteToggles } from './components/SiteToggles';
import { useKeywords } from './hooks/useKeywords';
import { useSiteSettings } from './hooks/useSiteSettings';

export default function App() {
  const { keywords, loading, addKeyword, removeKeyword, clearAll } = useKeywords();
  const { sites, toggle } = useSiteSettings();

  return (
    <div className="w-[380px] min-h-[480px] bg-gray-950 text-gray-100 p-4 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-armor-600 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-armor-900/50">
            🛡
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">PlotArmor</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Spoiler Shield</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">v1.0.0</span>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Keyword Management */}
      <section>
        <p className="pa-section-title mb-3">Spoiler keywords</p>
        <KeywordInput onAdd={addKeyword} />
        {loading ? (
          <div className="text-center py-4 text-gray-600 text-xs">Loading...</div>
        ) : (
          <KeywordList
            keywords={keywords}
            onRemove={removeKeyword}
            onClearAll={clearAll}
          />
        )}
      </section>

      {/* Site Toggles */}
      <SiteToggles sites={sites} onToggle={toggle} />

      {/* Footer hint */}
      <p className="text-center text-[10px] text-gray-700 mt-auto">
        Keywords match case-insensitively across all enabled sites
      </p>
    </div>
  );
}
