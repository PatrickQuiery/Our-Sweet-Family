import React, { useState } from 'react';

// Free-text tag editor: type + Enter/comma to add a chip, Backspace to remove
// the last, × to remove one. Tags are normalized to lowercase.
export default function TagInput({ value = [], onChange, placeholder = 'Add tags…' }) {
  const [draft, setDraft] = useState('');
  const add = (t) => {
    const v = t.trim().toLowerCase();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border border-black/5 rounded-lg px-2 py-1.5 focus-within:border-brand-300">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-ink/5 text-ink-soft rounded-full pl-2 pr-1 py-0.5 text-xs">
          #{t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-ink-muted hover:text-red-500">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? '' : placeholder}
        className="flex-1 min-w-[70px] text-xs outline-none bg-transparent py-0.5"
      />
    </div>
  );
}
