import React from 'react';

interface Props {
  keywords: string[];
  onRemove: (kw: string) => void;
  onClearAll: () => void;
}

export function KeywordList({ keywords, onRemove, onClearAll }: Props) {
  if (keywords.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        <p className="text-2xl mb-2">🔍</p>
        <p>No keywords yet.</p>
        <p className="text-xs mt-1">Add a show name, character, or plot event.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="pa-section-title">
          Blocking {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
        </span>
        <button
          className="pa-btn-ghost text-red-400 hover:text-red-300 text-xs"
          onClick={onClearAll}
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
        {keywords.map(kw => (
          <span key={kw} className="pa-tag group">
            {kw}
            <button
              onClick={() => onRemove(kw)}
              className="text-gray-600 hover:text-red-400 transition-colors ml-0.5 leading-none"
              title={`Remove "${kw}"`}
              aria-label={`Remove keyword ${kw}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
