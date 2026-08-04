import React, { useMemo, useState } from 'react';
import {
  differenceInYears, differenceInMonths, differenceInCalendarDays,
  format, startOfMonth, endOfMonth,
} from 'date-fns';

const CHILD_COLORS = ['#f43f74', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9'];

// Compact age of a child at a date, or null if not yet born.
function ageAt(dob, date) {
  const b = new Date(dob);
  if (date < b) return null;
  const years = differenceInYears(date, b);
  const months = differenceInMonths(date, b) % 12;
  if (years <= 0 && months <= 0) {
    const d = differenceInCalendarDays(date, b);
    return d <= 0 ? 'newborn' : `${d}d`;
  }
  if (years <= 0) return `${months}mo`;
  return `${years}y`;
}

export default function DashboardTimeline({ kids = [], memories = [] }) {
  const [grain, setGrain] = useState('year'); // 'year' | 'month' — the "zoom"

  const buckets = useMemo(() => {
    const now = new Date();
    const dates = [
      ...kids.map((k) => new Date(k.dateOfBirth)),
      ...memories.map((m) => new Date(m.capturedAt)),
    ].filter((d) => !isNaN(d));
    if (!dates.length) return [];
    const start = new Date(Math.min(...dates));
    const out = [];

    const countIn = (pred) => memories.filter((m) => pred(new Date(m.capturedAt))).length;

    if (grain === 'year') {
      for (let y = now.getFullYear(); y >= start.getFullYear(); y--) {
        const ref = y === now.getFullYear() ? now : new Date(y, 11, 31);
        out.push({ key: y, label: `${y}`, date: ref, count: countIn((d) => d.getFullYear() === y) });
      }
    } else {
      let d = startOfMonth(now);
      const startM = startOfMonth(start);
      for (let i = 0; i < 1200 && d >= startM; i++) {
        const y = d.getFullYear();
        const mo = d.getMonth();
        const isNow = y === now.getFullYear() && mo === now.getMonth();
        out.push({
          key: `${y}-${mo}`,
          label: format(d, 'MMM yyyy'),
          date: isNow ? now : endOfMonth(d),
          count: countIn((md) => md.getFullYear() === y && md.getMonth() === mo),
        });
        d = new Date(y, mo - 1, 1);
      }
    }
    return out;
  }, [kids, memories, grain]);

  if (!kids.length && !memories.length) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Header + zoom toggle */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Timeline</span>
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
          {['year', 'month'].map((g) => (
            <button
              key={g}
              onClick={() => setGrain(g)}
              className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                grain === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {g === 'year' ? 'Years' : 'Months'}
            </button>
          ))}
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="max-h-[calc(100vh-11rem)] overflow-y-auto px-4 pb-4">
        {buckets.map((b) => {
          const ages = kids
            .map((k, i) => ({ name: k.name, age: ageAt(k.dateOfBirth, b.date), color: CHILD_COLORS[i % CHILD_COLORS.length] }))
            .filter((a) => a.age);
          return (
            <div key={b.key} className="relative pl-5 pb-4 last:pb-1">
              {/* spine + dot */}
              <span className="absolute left-[3px] top-1.5 bottom-0 w-px bg-gray-200" />
              <span className="absolute left-0 top-1 w-[7px] h-[7px] rounded-full bg-brand-400 ring-2 ring-white" />

              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900 text-sm tabular-nums">{b.label}</span>
                {b.count > 0 && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{b.count} memor{b.count === 1 ? 'y' : 'ies'}</span>
                )}
              </div>

              {ages.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {ages.map((a) => (
                    <span
                      key={a.name}
                      title={`${a.name} · ${a.age}`}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-100 pl-1 pr-1.5 py-0.5 text-[11px] text-gray-600"
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                      <span className="truncate max-w-[64px]">{a.name.split(' ')[0]}</span>
                      <span className="text-gray-400 tabular-nums">{a.age}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-300 mt-1">before your family</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
