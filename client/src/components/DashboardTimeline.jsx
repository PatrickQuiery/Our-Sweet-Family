import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  differenceInYears, differenceInMonths, differenceInCalendarDays,
  format, startOfMonth, endOfMonth,
} from 'date-fns';
import { childColor } from '../lib/childColor';

const DAY = 86400000;
const MIN_GAP = 0.02; // smallest selectable window (~2% of the span)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const FULL = { top: 0, bot: 1 };
const isFullWin = (w) => w.top <= 0.001 && w.bot >= 0.999;

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

// Compact human label for a selected window (from = older, to = newer).
function rangeLabel(from, to) {
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  if (sameMonth) return format(to, 'MMM yyyy');
  const sameYear = from.getFullYear() === to.getFullYear();
  const wholeYear = sameYear && from.getMonth() === 0 && to.getMonth() === 11;
  if (wholeYear) return `${from.getFullYear()}`;
  if (sameYear) return `${format(from, 'MMM')} – ${format(to, 'MMM yyyy')}`;
  return `${format(from, 'MMM yyyy')} → ${format(to, 'MMM yyyy')}`;
}

export default function DashboardTimeline({ kids = [], memories = [], range = null, onRangeChange }) {
  const railRef = useRef(null);
  const active = useRef(null);   // { mode: 'top'|'bot'|'band', grab, width } while dragging
  const latestWin = useRef(FULL);
  // Window as fractions of the full span: 0 = newest (top), 1 = oldest (bottom).
  const [win, setWin] = useState(FULL);
  const [drag, setDrag] = useState(null); // active handle mode → drives the floating label

  // Expand-only span: memories shrink to the selected range once a filter is
  // applied, so the rail must remember the widest [start, end] it has ever seen —
  // otherwise the scrubber would collapse to the filtered window and trap you.
  const spanRef = useRef(null);
  const { start, end, totalDays } = useMemo(() => {
    const now = new Date();
    const dates = [
      ...kids.map((k) => new Date(k.dateOfBirth)),
      ...memories.map((m) => new Date(m.capturedAt)),
    ].filter((d) => !isNaN(d));
    const obsStart = dates.length ? Math.min(...dates) : +new Date(now.getFullYear() - 1, 0, 1);
    const prev = spanRef.current;
    const startMs = prev ? Math.min(prev.start, obsStart) : obsStart;
    const endMs = prev ? Math.max(prev.end, +now) : +now;
    spanRef.current = { start: startMs, end: endMs };
    return { start: new Date(startMs), end: new Date(endMs), totalDays: Math.max(1, (endMs - startMs) / DAY) };
  }, [kids, memories]);

  const dateAt = (f) => new Date(end - f * totalDays * DAY);
  const newer = dateAt(win.top);
  const older = dateAt(win.bot);

  // Keep the local band in sync when the filter is cleared elsewhere (header chip / reset).
  useEffect(() => {
    if (!range && !isFullWin(latestWin.current)) {
      latestWin.current = FULL;
      setWin(FULL);
    }
  }, [range]);

  const applyWin = (next) => { latestWin.current = next; setWin(next); };

  // Commit the current window to the feed. Full span → clear the filter (null).
  const commit = (w) => {
    if (!onRangeChange) return;
    if (isFullWin(w)) { onRangeChange(null); return; }
    const to = dateAt(w.top);   // newer edge
    const from = dateAt(w.bot); // older edge
    onRangeChange({ from: from.toISOString(), to: to.toISOString(), label: rangeLabel(from, to) });
  };

  // Drag handling via pointer capture — the element that receives pointerdown
  // gets all subsequent move/up events (survives leaving the rail).
  const onDown = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    // Snapshot the rail geometry ONCE at drag-start; reusing it for the whole
    // drag makes the cursor→fraction math immune to any mid-drag layout shift.
    const rect = railRef.current.getBoundingClientRect();
    if (mode === 'band') {
      const f = (e.clientY - rect.top) / rect.height;
      active.current = { mode, rect, grab: f - win.top, width: win.bot - win.top };
    } else {
      active.current = { mode, rect };
    }
    setDrag(mode);
  };
  const onMove = (e) => {
    const d = active.current;
    if (!d) return;
    const rect = d.rect;
    const f = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const w = latestWin.current;
    let next;
    if (d.mode === 'top') next = { ...w, top: clamp(f, 0, w.bot - MIN_GAP) };
    else if (d.mode === 'bot') next = { ...w, bot: clamp(f, w.top + MIN_GAP, 1) };
    else { const top = clamp(f - d.grab, 0, 1 - d.width); next = { top, bot: top + d.width }; }
    applyWin(next);
  };
  const onUp = (e) => {
    active.current = null;
    setDrag(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    commit(latestWin.current);
  };
  const dragHandlers = { onPointerMove: onMove, onPointerUp: onUp };

  const reset = () => { applyWin(FULL); onRangeChange?.(null); };

  // Jump-filter to a whole bucket (a tapped year or month), Amazon-Photos style.
  const jumpTo = (from, to) => {
    const top = clamp((end - to) / (totalDays * DAY), 0, 1);
    const bot = clamp((end - from) / (totalDays * DAY), 0, 1);
    const next = { top, bot: Math.max(bot, top + MIN_GAP) };
    applyWin(next);
    onRangeChange?.({ from: new Date(from).toISOString(), to: new Date(to).toISOString(), label: rangeLabel(new Date(from), new Date(to)) });
  };

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

  // Buckets inside the selected window — granularity auto-zooms with the window
  // size. Each bucket carries its own full [from, to] extent so a tap can filter
  // to it, and counts are computed over that extent (independent of the window).
  const { buckets, grain } = useMemo(() => {
    const winDays = (newer - older) / DAY;
    const grain = winDays > 3.2 * 365 ? 'year' : 'month';
    const out = [];
    const countIn = (a, b) => memories.filter((m) => { const d = new Date(m.capturedAt); return d >= a && d <= b; }).length;

    if (grain === 'year') {
      for (let y = newer.getFullYear(); y >= older.getFullYear() && out.length < 60; y--) {
        const yStart = new Date(y, 0, 1);
        const yEnd = new Date(y, 11, 31, 23, 59, 59);
        const from = new Date(Math.max(+yStart, +start));
        const to = new Date(Math.min(+yEnd, +end));
        out.push({ key: y, label: `${y}`, date: to, from, to, count: countIn(from, to) });
      }
    } else {
      let d = startOfMonth(newer);
      for (let i = 0; i < 120 && d >= startOfMonth(older); i++) {
        const mEnd = endOfMonth(d);
        const from = new Date(Math.max(+d, +start));
        const to = new Date(Math.min(+mEnd, +end));
        out.push({ key: +d, label: format(d, 'MMM yyyy'), date: to, from, to, count: countIn(from, to) });
        d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      }
    }
    return { buckets: out, grain };
  }, [newer, older, memories, start, end, totalDays]);

  if (!kids.length && !memories.length) return null;

  const full = isFullWin(win);
  // Floating label position/text follows the actively dragged handle.
  const labelF = drag === 'bot' ? win.bot : drag === 'band' ? (win.top + win.bot) / 2 : win.top;
  const labelText = drag === 'band'
    ? `${format(older, 'MMM yyyy')} → ${format(newer, 'MMM yyyy')}`
    : format(dateAt(labelF), 'MMM yyyy');

  return (
    <div className="rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md overflow-hidden select-none">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Timeline</span>
        {!full && (
          <button onClick={reset} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">Reset</button>
        )}
      </div>

      {/* selected range */}
      <div className="px-4 pb-2">
        <p className="text-[11px] text-ink-muted tabular-nums">
          {full ? 'All memories' : <>{format(older, 'MMM yyyy')} <span className="text-ink-muted/60">→</span> {format(newer, 'MMM yyyy')}</>}
        </p>
      </div>

      {/* FIXED height — the rail is a stable drag surface. (Coupling its height to
          the bucket list made it change size mid-drag, so the handle jumped.) The
          detail column scrolls within this height. */}
      <div className="flex gap-3 px-4 pb-4 h-[calc(100vh-13rem)]">
        {/* ── Slider rail (drag to filter) ── */}
        <div
          ref={railRef}
          className="relative w-8 flex-shrink-0 rounded-lg bg-ink/5 self-stretch"
        >
          {yearTicks.map((t) => (
            <div key={t.y} className="absolute left-0 right-0 border-t border-black/5" style={{ top: `${t.f * 100}%` }} />
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

          {/* floating date label while dragging (Google-Photos style) */}
          {drag && (
            <div
              className="absolute left-9 -translate-y-1/2 z-10 whitespace-nowrap rounded-lg bg-ink text-white text-[11px] font-medium px-2 py-1 shadow-lg tabular-nums pointer-events-none"
              style={{ top: `${labelF * 100}%` }}
            >
              {labelText}
            </div>
          )}
        </div>

        {/* ── Detail: the zoomed window (tap a row to filter to it) ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {buckets.map((b) => {
            const ages = kids
              .map((k) => ({ name: k.name, age: ageAt(k.dateOfBirth, b.date), color: childColor(k) }))
              .filter((a) => a.age);
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => jumpTo(b.from, b.to)}
                title={`Filter to ${b.label}`}
                className="relative w-full text-left pl-4 pb-3.5 last:pb-1 group"
              >
                <span className="absolute left-[3px] top-1.5 bottom-0 w-px bg-ink/10" />
                <span className="absolute left-0 top-1 w-[7px] h-[7px] rounded-full bg-brand-400 ring-2 ring-white group-hover:bg-brand-500" />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink text-sm tabular-nums group-hover:text-brand-600">{b.label}</span>
                  {b.count > 0 && <span className="text-[10px] text-ink-muted flex-shrink-0">{b.count}</span>}
                </div>
                {ages.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ages.map((a) => (
                      <span key={a.name} title={`${a.name} · ${a.age}`} className="inline-flex items-center gap-1 rounded-full bg-paper border border-black/5 pl-1 pr-1.5 py-0.5 text-[11px] text-ink-soft">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                        <span className="truncate max-w-[56px]">{a.name.split(' ')[0]}</span>
                        <span className="text-ink-muted tabular-nums">{a.age}</span>
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="px-4 pb-3 text-[10px] text-ink-muted">Drag to filter · tap a date to jump</p>
    </div>
  );
}
