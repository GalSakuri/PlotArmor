import React, { useState, useRef } from 'react';

interface Props {
  onAdd: (keyword: string) => void;
}

export function KeywordInput({ onAdd }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex gap-2 mb-4">
      <input
        ref={inputRef}
        type="text"
        className="pa-input flex-1"
        placeholder='Add keyword (e.g. "red wedding")'
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <button
        className="pa-btn-primary px-3 py-2 text-lg"
        onClick={submit}
        disabled={!value.trim()}
        title="Add keyword"
      >
        +
      </button>
    </div>
  );
}
