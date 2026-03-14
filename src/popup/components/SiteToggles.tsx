import React from 'react';
import type { SiteId } from '../../types/storage';

interface SiteRow {
  id: SiteId;
  label: string;
  icon: string;
}

const SITES: SiteRow[] = [
  { id: 'reddit',  label: 'Reddit',      icon: '🤖' },
  { id: 'twitter', label: 'Twitter / X',  icon: '🐦' },
  { id: 'youtube', label: 'YouTube',      icon: '▶️' },
];

interface Props {
  sites: Record<SiteId, boolean>;
  onToggle: (id: SiteId) => void;
}

export function SiteToggles({ sites, onToggle }: Props) {
  return (
    <div className="space-y-1">
      <p className="pa-section-title">Protected sites</p>
      {SITES.map(site => (
        <div
          key={site.id}
          className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2.5"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">{site.icon}</span>
            <span className="text-sm text-gray-200">{site.label}</span>
          </div>
          <Toggle checked={sites[site.id]} onChange={() => onToggle(site.id)} />
        </div>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-armor-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
        checked ? 'bg-armor-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
