import React from 'react';
import { useStats } from '../hooks/useStats';

export function StatsBar() {
  const { hiddenToday, hiddenTotal } = useStats();

  return (
    <div className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3 mb-4">
      <Stat label="Hidden today" value={hiddenToday} />
      <div className="w-px h-8 bg-gray-700" />
      <Stat label="All time" value={hiddenTotal} />
      <div className="w-px h-8 bg-gray-700" />
      <Stat label="Shield" value="Active" isText />
    </div>
  );
}

function Stat({
  label,
  value,
  isText = false,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${isText ? 'text-green-400' : 'text-armor-400'}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}
