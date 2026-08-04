import React, { useMemo, useRef, useState } from 'react';
import {
  differenceInYears, differenceInMonths, differenceInCalendarDays,
  format, startOfMonth, endOfMonth,
} from 'date-fns';

const DAY = 86400000;
const MIN_GAP = 0.02; // smallest selectable window (~2% of the span)
const CHILD_COLORS = ['#f43f74', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
  const railRef = useRef(null);
  const active = useRef(null); // { mode: 'top'|'bot'|'band', grab, width } while dragging
  // Window as fractions of the full span: 0 = newest (top), 1 = oldest (bottom).
  const [win, setWin] = useState({ top: 0, bot: 1 });

  const { start, end, totalDays } = useMemo(() => {
    const end = new Date();
    const dates = [
      ...kids.map((k) => new Date(k.dateOfBirth)),
      ...memories.map((m) => new Date(m.capturedAt)),
    ].filter((d) => !isNaN(d));
    const start = dates.length ? new Date(Math.min(...dates)) : new Date(end.getFullYear() - 1, 0, 1);
    return { start, end, totalDays: Math.max(1, (end - start) / DAY) };
  }, [kids, memories]);

  const dateAt = (f) => new Date(end - f * totalDays * DAY);
  const newer = dateAt(win.top);
  const older = dateAt(win.bot);

  // Drag handling via pointer capture — the element that receives pointerdown
  // gets all subsequent move/up events (survives leaving the rail), and listeners
  // are effectively active immediately (no render gap).
  const onDown = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    if (mode === 'band') {
      const rect = railRef.current.getBoundingClientRect();
      const f = (e.clientY - rect.top) / rect.height;
      active.current = { mode, grab: f - win.top, width: win.bot - win.top };
    } else {
      active.current = { mode };
    }
  };
  const onMove = (e) => {
    const d = active.current;
    if (!d) return;
    const rect = railRef.current.getBoundingClientRect();
    const f = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    setWin((w) => {
      if (d.mode === 'top') return { ...w, top: clamp(f, 0, w.bot - MIN_GAP) };
      if (d.mode === 'bot') return { ...w, bot: clamp(f, w.top + MIN_GAP, 1) };
      const top = clamp(f - d.grab, 0, 1 - d.width);
      return { top, bot: top + d.width };
    });
  };
  const onUp = (e) => {
    active.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const dragHandlers = { onPointerMove: onMove, onPointerUp: onUp };

  // Year gridlines on the rail for orientation.
  const yearTicks = useMemo(() => {
    const ticks = [];
    for (let y = end.getFullYear(); y >= start.getFullYear(); y--) {
      const d = new Date(y, 0, 1);
      if (d < start) continue;
      ticks.push({ y, f: (end - d) / (totalDays * DAY) });
    }
    return ticks;
  }, [start, end, totalDays]);

  // Buckets inside the selected window — granularity auto-zooms with the window size.
  const { buckets, grain } = useMemo(() => {
    const winDays = (newer - older) / DAY;
    const grain = winDays > 3.2 * 365 ? 'year' : 'month';
    const out = [];
    const countIn = (a, b) => memories.filter((m) => { const d = new Date(m.capturedAt); return d >= a && d <= b; }).length;

    if (grain === 'year') {
      for (let y = newer.getFullYear(); y >= older.getFullYear() && out.length < 60; y--) {
        const yEnd = new Date(y, 11, 31, 23, 59);
        const yStart = new Date(y, 0, 1);
        const ref = new Date(Math.min(yEnd, newer));
        out.push({ key: y, label: `${y}`, date: ref, count: countIn(new Date(Math.max(yStart, older)), ref) });
      }
    } else {
      let d = startOfMonth(newer);
      for (let i = 0; i < 120 && d >= startOfMonth(older); i++) {
        const mEnd = endOfMonth(d);
        const ref = new Date(Math.min(mEnd, newer));
        out.push({ key: +d, label: format(d, 'MMM yyyy'), date: ref, count: countIn(new Date(Math.max(d, older)), ref) });
        d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      }
    }
    return { buckets: out, grain };
  }, [newer, older, memories]);

  if (!kids.length && !memories.length) return null;

  const isFull = win.top <= 0.001 && win.bot >= 0.999;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden select-none">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Timeline</span>
        {!isFull && (
          <button onClick={() => setWin({ top: 0, bot: 1 })} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">Reset</button>
        )}
      </div>

      {/* selected range */}
      <div className="px-4 pb-2">
        <p className="text-[11px] text-gray-500 tabular-nums">
          {format(older, 'MMM yyyy')} <span className="text-gray-300">→</span> {format(newer, 'MMM yyyy')}
        </p>
      </div>

      <div className="flex gap-3 px-4 pb-4 h-[calc(100vh-13rem)]">
        {/* ── Slider rail (drag handles to zoom) ── */}
        <div
          ref={railRef}
          className="relative w-8 flex-shrink-0 rounded-lg bg-gray-100 h-full"
        >
          {yearTicks.map((t) => (
            <div key={t.y} className="absolute left-0 right-0 border-t border-gray-200/70" style={{ top: `${t.f * 100}%` }} />
          ))}

          {/* selected band (drag to pan) */}
          <div
            className="absolute left-0 right-0 bg-brand-400/25 border-y-2 border-brand-400 cursor-grab active:cursor-grabbing touch-none"
            style={{ top: `${win.top * 100}%`, height: `${(win.bot - win.top) * 100}%` }}
            onPointerDown={onDown('band')}
            {...dragHandlers}
          />
          {/* handles */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-6 h-3 -mt-1.5 rounded bg-brand-500 shadow cursor-ns-resize flex items-center justify-center touch-none"
            style={{ top: `${win.top * 100}%` }}
            onPointerDown={onDown('top')}
            {...dragHandlers}
          >
            <span className="w-3 h-px bg-white/80" />
          </div>
          <div
            className="absolute left-1/2 -translate-x-1/2 w-6 h-3 -mt-1.5 rounded bg-brand-500 shadow cursor-ns-resize flex items-center justify-center touch-none"
            style={{ top: `${win.bot * 100}%` }}
            onPointerDown={onDown('bot')}
            {...dragHandlers}
          >
            <span className="w-3 h-px bg-white/80" />
          </div>
        </div>

        {/* ── Detail: the zoomed window ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {buckets.map((b) => {
            const ages = kids
              .map((k, i) => ({ name: k.name, age: ageAt(k.dateOfBirth, b.date), color: CHILD_COLORS[i % CHILD_COLORS.length] }))
              .filter((a) => a.age);
            return (
              <div key={b.key} className="relative pl-4 pb-3.5 last:pb-1">
                <span className="absolute left-[3px] top-1.5 bottom-0 w-px bg-gray-200" />
                <span className="absolute left-0 top-1 w-[7px] h-[7px] rounded-full bg-brand-400 ring-2 ring-white" />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-gray-900 text-sm tabular-nums">{b.label}</span>
                  {b.count > 0 && <span className="text-[10px] text-gray-400 flex-shrink-0">{b.count}</span>}
                </div>
                {ages.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ages.map((a) => (
                      <span key={a.name} title={`${a.name} · ${a.age}`} className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-100 pl-1 pr-1.5 py-0.5 text-[11px] text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                        <span className="truncate max-w-[56px]">{a.name.split(' ')[0]}</span>
                        <span className="text-gray-400 tabular-nums">{a.age}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="px-4 pb-3 text-[10px] text-gray-400">Drag the handles to zoom · drag the band to pan</p>
    </div>
  );
}
