import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  format, differenceInYears, differenceInMonths, differenceInCalendarDays,
  startOfYear, startOfMonth, addYears, addMonths, addDays,
} from 'date-fns';

const DAY = 86400000;
const MIN_PX = 0.04;   // very zoomed out (~decades fit)
const MAX_PX = 12;     // very zoomed in (~a few days fill the rail)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Compact age of a child at a given date, or null if not yet born.
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
  return months ? `${years}y ${months}m` : `${years}y`;
}

const CHILD_COLORS = ['#f43f74', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

// Pick a tick spacing (unit + count) so ticks land ~64px apart at the current zoom.
function tickSpec(pxPerDay) {
  const target = 64;
  const opts = [
    { unit: 'year', n: 10, days: 3650 }, { unit: 'year', n: 5, days: 1825 },
    { unit: 'year', n: 2, days: 730 }, { unit: 'year', n: 1, days: 365 },
    { unit: 'month', n: 6, days: 182 }, { unit: 'month', n: 3, days: 91 },
    { unit: 'month', n: 1, days: 30 }, { unit: 'day', n: 14, days: 14 },
    { unit: 'day', n: 7, days: 7 }, { unit: 'day', n: 2, days: 2 }, { unit: 'day', n: 1, days: 1 },
  ];
  // smallest step whose spacing is still >= ~46px (avoids label overlap)
  let chosen = opts[0];
  for (const o of opts) {
    if (o.days * pxPerDay >= 46) chosen = o;
  }
  // but prefer the option closest to target when zoomed way out
  if (chosen === opts[0] && opts[0].days * pxPerDay < target) chosen = opts[0];
  return chosen;
}

function buildTicks(spec, start, end) {
  const ticks = [];
  let d;
  if (spec.unit === 'year') d = startOfYear(start);
  else if (spec.unit === 'month') d = startOfMonth(start);
  else d = startOfMonth(start);
  const step = (dt) => spec.unit === 'year' ? addYears(dt, spec.n)
    : spec.unit === 'month' ? addMonths(dt, spec.n) : addDays(dt, spec.n);
  // guard against runaway loops
  for (let i = 0; i < 4000 && d <= end; i++) {
    if (d >= start) ticks.push(new Date(d));
    d = step(d);
  }
  return ticks;
}

export default function DashboardTimeline({ kids = [], memories = [] }) {
  const scrollRef = useRef(null);
  const [pxPerDay, setPxPerDay] = useState(0.22);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(0);

  // Time span: from the earliest child birth (or memory) to today.
  const { start, end } = useMemo(() => {
    const end = new Date();
    const dates = [
      ...kids.map((c) => new Date(c.dateOfBirth)),
      ...memories.map((m) => new Date(m.capturedAt)),
    ].filter((d) => !isNaN(d));
    let start = dates.length ? new Date(Math.min(...dates)) : addYears(end, -1);
    start = addDays(start, -30); // a little breathing room below the oldest point
    return { start, end };
  }, [kids, memories]);

  const totalDays = Math.max(1, (end - start) / DAY);
  const innerHeight = totalDays * pxPerDay;
  const yForDate = useCallback((d) => ((end - d) / DAY) * pxPerDay, [end, pxPerDay]);

  const spec = tickSpec(pxPerDay);
  const ticks = useMemo(() => buildTicks(spec, start, end), [spec.unit, spec.n, start, end]);

  // Measure viewport height and keep it fresh.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => setScrollTop(scrollRef.current?.scrollTop ?? 0);

  // The date at the fixed "playhead" line (vertical centre of the viewport).
  const centeredDate = new Date(end - ((scrollTop + viewH / 2) / pxPerDay) * DAY);

  const zoomBy = (factor) => {
    const el = scrollRef.current;
    if (!el) return;
    const H = el.clientHeight;
    const centerDays = (el.scrollTop + H / 2) / pxPerDay;
    const next = clamp(pxPerDay * factor, MIN_PX, MAX_PX);
    setPxPerDay(next);
    requestAnimationFrame(() => {
      el.scrollTop = centerDays * next - H / 2;
      setScrollTop(el.scrollTop);
    });
  };

  const fit = () => {
    const el = scrollRef.current;
    if (!el) return;
    const H = el.clientHeight || 1;
    setPxPerDay(clamp((H - 8) / totalDays, MIN_PX, MAX_PX));
    requestAnimationFrame(() => { el.scrollTop = 0; setScrollTop(0); });
  };

  if (kids.length === 0 && memories.length === 0) return null;

  const railX = 96; // px from left where the vertical rail sits

  return (
    <div className="relative h-[calc(100vh-9rem)] select-none">
      {/* Zoom controls */}
      <div className="absolute top-0 right-0 z-20 flex items-center gap-1">
        <button onClick={() => zoomBy(1.7)} title="Zoom in" className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-lg leading-none">+</button>
        <button onClick={() => zoomBy(1 / 1.7)} title="Zoom out" className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-lg leading-none">−</button>
        <button onClick={fit} title="Fit all" className="h-7 px-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-medium">Fit</button>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Timeline</p>

      <div className="relative rounded-2xl border border-gray-200 bg-white overflow-hidden h-full">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
          <div className="relative" style={{ height: innerHeight }}>
            {/* the rail line */}
            <div className="absolute top-0 bottom-0 w-px bg-gray-200" style={{ left: railX }} />

            {/* date ticks (labels on the LEFT of the rail) */}
            {ticks.map((t, i) => {
              const y = yForDate(t);
              const label = spec.unit === 'year' ? format(t, 'yyyy')
                : spec.unit === 'month' ? format(t, 'MMM yyyy') : format(t, 'MMM d');
              return (
                <div key={i} className="absolute flex items-center" style={{ top: y, left: 0, right: 0, transform: 'translateY(-50%)' }}>
                  <span className="text-[11px] text-gray-500 tabular-nums pr-2 text-right" style={{ width: railX - 6 }}>{label}</span>
                  <span className="w-2 h-px bg-gray-300" />
                </div>
              );
            })}

            {/* memory dots (RIGHT of the rail) */}
            {memories.map((m) => {
              const d = new Date(m.capturedAt);
              if (d < start || d > end) return null;
              return (
                <div
                  key={m.id}
                  title={format(d, 'MMM d, yyyy')}
                  className={`absolute w-1.5 h-1.5 rounded-full ${m.fileType === 'video' ? 'bg-gray-400' : 'bg-brand-400'}`}
                  style={{ top: yForDate(d), left: railX + 6, transform: 'translateY(-50%)' }}
                />
              );
            })}

            {/* child birthday markers (RIGHT of the rail) */}
            {kids.map((c, ci) => {
              const b = new Date(c.dateOfBirth);
              if (b < start || b > end) return null;
              return (
                <div key={c.id} className="absolute flex items-center gap-1" style={{ top: yForDate(b), left: railX + 12, transform: 'translateY(-50%)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CHILD_COLORS[ci % CHILD_COLORS.length] }} />
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">🎂 {c.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playhead line + kids-ages readout (fixed at the viewport centre) */}
        <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: '50%' }}>
          <div className="absolute left-0 right-0 border-t-2 border-dashed border-brand-300" />
          <div className="absolute -translate-y-1/2 rounded-xl bg-white/95 backdrop-blur border border-brand-200 shadow-sm px-2.5 py-1.5" style={{ left: railX + 8, right: 6 }}>
            <p className="text-[11px] font-semibold text-brand-700 tabular-nums">{format(centeredDate, 'MMM d, yyyy')}</p>
            <div className="mt-0.5 space-y-0.5">
              {kids.map((c, ci) => {
                const age = ageAt(c.dateOfBirth, centeredDate);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-gray-600 truncate">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHILD_COLORS[ci % CHILD_COLORS.length] }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className={`tabular-nums flex-shrink-0 ${age ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>
                      {age || 'not born'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
