import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AuthedImage } from './AuthedMedia';
import { buildTimeline } from '../lib/mosaic';
import api from '../lib/api';

function HeartIcon({ filled, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.6-10-9.2C.6 8.9 2 5.5 5.2 5.1 7 4.9 8.7 5.9 12 9c3.3-3.1 5-4.1 6.8-3.9C22 5.5 23.4 8.9 22 11.8 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function CommentIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.5 8.5 0 01-11.9 7.8L3 21l1.7-6A8.5 8.5 0 1121 11.5z" />
    </svg>
  );
}

function Tile({ memory, weight, currentUser }) {
  const img = memory.thumbnailUrl || memory.fileUrl;
  const isVideo = memory.fileType === 'video';

  // Local, optimistic engagement state (seeded from the list payload, which already
  // includes reactor names + comment authors — no extra fetch needed).
  const [reactors, setReactors] = useState(
    () => (memory.reactions || []).map((r) => ({ id: r.userId ?? r.user?.id, name: r.user?.name || 'Someone' }))
  );
  const [comments, setComments] = useState(() => memory.comments || []);
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const liked = reactors.some((r) => r.id === currentUser?.id);

  const toggleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const wasLiked = liked;
    setReactors((rs) =>
      wasLiked ? rs.filter((r) => r.id !== currentUser?.id) : [...rs, { id: currentUser?.id, name: currentUser?.name || 'You' }]
    );
    try {
      if (wasLiked) await api.delete(`/memories/${memory.id}/reactions`);
      else await api.post(`/memories/${memory.id}/reactions`);
    } catch {
      // revert on failure
      setReactors((rs) =>
        wasLiked ? [...rs, { id: currentUser?.id, name: currentUser?.name || 'You' }] : rs.filter((r) => r.id !== currentUser?.id)
      );
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/memories/${memory.id}/comments`, { text: value });
      setComments((cs) => [...cs, data.comment]);
      setText('');
    } catch {
      /* keep the text so they can retry */
    } finally {
      setBusy(false);
    }
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-brand-50 group"
      style={{ flexGrow: weight, flexBasis: 0, minWidth: 0 }}
    >
      {/* Image → detail */}
      <Link to={`/memories/${memory.id}`} className="absolute inset-0 block">
        {img ? (
          <AuthedImage src={img} alt={memory.caption || 'Memory'} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl">📷</div>
        )}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-white/85 flex items-center justify-center backdrop-blur-sm shadow">
              <svg className="w-5 h-5 text-ink ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}
      </Link>

      {/* Bottom gradient for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent pointer-events-none" />

      {/* Engagement bar (sibling of the Link, so taps here don't navigate) */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 px-2.5 py-2 text-white">
        {/* Like + who-loved-it tooltip */}
        <div className="relative group/like">
          <button
            onClick={toggleLike}
            className="flex items-center gap-1 text-white/95 hover:text-white transition-colors"
            aria-label={liked ? 'Unlove' : 'Love'}
          >
            <HeartIcon filled={liked} className={`w-[18px] h-[18px] drop-shadow ${liked ? 'text-brand-400' : ''}`} />
            {reactors.length > 0 && <span className="text-xs font-semibold drop-shadow tabular-nums">{reactors.length}</span>}
          </button>
          {reactors.length > 0 && (
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-max max-w-[220px] rounded-lg bg-ink text-white text-[11px] leading-snug px-2.5 py-1.5 shadow-soft opacity-0 group-hover/like:opacity-100 transition-opacity z-20">
              <p className="font-semibold mb-0.5">Loved by</p>
              {reactors.map((r, i) => (
                <span key={r.id ?? i}>{r.id === currentUser?.id ? 'You' : r.name}{i < reactors.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
          )}
        </div>

        {/* Comment + preview tooltip + inline composer */}
        <div className="relative group/comment">
          <button
            onClick={(e) => { stop(e); e.preventDefault(); setComposerOpen((o) => !o); }}
            className="flex items-center gap-1 text-white/95 hover:text-white transition-colors"
            aria-label="Comment"
          >
            <CommentIcon className="w-[17px] h-[17px] drop-shadow" />
            {comments.length > 0 && <span className="text-xs font-semibold drop-shadow tabular-nums">{comments.length}</span>}
          </button>
          {comments.length > 0 && !composerOpen && (
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-64 max-w-[80vw] rounded-lg bg-ink text-white text-[11px] leading-snug px-2.5 py-2 shadow-soft opacity-0 group-hover/comment:opacity-100 transition-opacity z-20 space-y-1">
              {comments.slice(-3).map((c) => (
                <p key={c.id}><span className="font-semibold">{c.user?.name?.split(' ')[0] || 'Someone'}</span> {c.text}</p>
              ))}
              {comments.length > 3 && <p className="text-white/60">+{comments.length - 3} more</p>}
            </div>
          )}
        </div>
      </div>

      {/* Inline comment composer popover */}
      {composerOpen && (
        <div
          className="absolute bottom-12 left-2 right-2 z-30 rounded-xl bg-white text-ink shadow-soft border border-black/5 overflow-hidden"
          onClick={stop}
        >
          {comments.length > 0 && (
            <div className="max-h-32 overflow-y-auto px-3 pt-2.5 space-y-1.5 text-[12px] leading-snug">
              {comments.map((c) => (
                <p key={c.id}><span className="font-semibold">{c.user?.name?.split(' ')[0] || 'Someone'}</span> <span className="text-ink-soft">{c.text}</span></p>
              ))}
            </div>
          )}
          <form onSubmit={submitComment} className="flex items-center gap-1.5 p-2 border-t border-black/5">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 min-w-0 text-[13px] px-2.5 py-1.5 rounded-full bg-paper border border-black/5 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button type="submit" disabled={busy || !text.trim()} className="flex-shrink-0 text-brand-600 disabled:text-ink-muted font-semibold text-sm px-2 py-1">
              {busy ? '…' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Editorial, varied-size photo mosaic grouped by date — with inline like/comment. */
export default function MosaicFeed({ memories = [], currentUser }) {
  const sections = useMemo(() => buildTimeline(memories), [memories]);
  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <section key={s.key}>
          <div className="flex items-baseline justify-between mb-2.5">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-ink-soft">{s.title}</h3>
            <span className="text-xs text-ink-muted">{s.count}</span>
          </div>
          <div className="flex flex-col gap-2">
            {s.rows.map((row) => (
              <div key={row.key} className="flex gap-2 w-full" style={{ aspectRatio: 1 / row.h }}>
                {row.tiles.map((t) => (
                  <Tile key={t.memory.id} memory={t.memory} weight={t.weight} currentUser={currentUser} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
