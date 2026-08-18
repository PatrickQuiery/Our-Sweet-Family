import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AuthedImage } from '../components/AuthedMedia';

const HeartIcon = (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 21s-7.5-4.9-10-9.4C.6 8.9 2 5.5 5.2 5.5c1.8 0 3 .9 3.8 2 .8-1.1 2-2 3.8-2 3.2 0 4.6 3.4 3.2 6.1C19.5 16.1 12 21 12 21z" /></svg>);
const ChatIcon = (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H8l-4 4V5a1 1 0 011-1z" /></svg>);
const ImageIcon = (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm2 12l3.5-4.5 2.5 3L15 11l3 5H6z" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>);

// love / comment / memory → verb + badge color + icon
const TYPE = {
  love: { badge: 'bg-brand-500', Icon: HeartIcon },
  comment: { badge: 'bg-blue-500', Icon: ChatIcon },
  memory: { badge: 'bg-amber-500', Icon: ImageIcon },
};

function dayBucket(iso, now) {
  const d = new Date(iso);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

function Row({ item, meId }) {
  const meta = TYPE[item.type];
  const isYou = item.actor?.id && meId && item.actor.id === meId;
  const name = isYou ? 'You' : item.actor?.name ?? 'Someone';
  const noun = item.memory.fileType === 'video' ? 'video' : 'photo';
  const action = item.type === 'love' ? ` loved a ${noun}` : item.type === 'memory' ? ` added a ${noun}` : ' commented';
  const initial = (item.actor?.name?.[0] ?? '?').toUpperCase();

  return (
    <Link to={`/memories/${item.memory.id}`} className="flex items-center gap-3 py-3 group">
      {/* avatar + type badge */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 font-semibold flex items-center justify-center">
          {initial}
        </div>
        <span className={`absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full ${meta.badge} ring-2 ring-white flex items-center justify-center`}>
          <meta.Icon className="w-2.5 h-2.5 text-white" />
        </span>
      </div>

      {/* text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-soft truncate">
          <span className="font-semibold text-ink">{name}</span>{action}
        </p>
        {item.type === 'comment' && item.text ? (
          <p className="text-sm text-ink-muted truncate">“{item.text}”</p>
        ) : null}
        <p className="text-xs text-ink-muted mt-0.5">{formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}</p>
      </div>

      {/* thumbnail — videos only ever use their poster thumbnail (never the raw
          video URL, which would render broken through <img>); no poster → dark tile */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-ink/5 flex-shrink-0">
        {item.memory.fileType === 'video' ? (
          item.memory.thumbnailUrl ? (
            <AuthedImage src={item.memory.thumbnailUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-ink/80" />
          )
        ) : (
          <AuthedImage src={item.memory.thumbnailUrl ?? item.memory.fileUrl} className="w-full h-full object-cover" alt="" />
        )}
        {item.memory.fileType === 'video' ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg className="w-5 h-5 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default function Activity() {
  const { user, family } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPage = useCallback(async (p) => {
    if (!family) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/activity?familyId=${family.id}&page=${p}&limit=30`);
      setItems((prev) => (p === 1 ? data.activity : [...prev, ...data.activity]));
      setPagination(data.pagination);
    } catch {
      setError('Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => { setPage(1); fetchPage(1); }, [fetchPage]);
  useEffect(() => { if (page > 1) fetchPage(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const now = Date.now();
    const out = [];
    for (const it of items) {
      const title = dayBucket(it.createdAt, now);
      const last = out[out.length - 1];
      if (last && last.title === title) last.items.push(it);
      else out.push({ title, items: [it] });
    }
    return out;
  }, [items]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-2">
        <h1 className="type-title text-ink">Activity</h1>
        <p className="text-ink-muted text-sm mt-1">Loves, comments, and new memories from your family.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 my-4">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="animate-pulse divide-y divide-black/5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-11 h-11 rounded-full bg-ink/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-ink/10 rounded w-2/3" />
                <div className="h-2.5 bg-ink/10 rounded w-1/3" />
              </div>
              <div className="w-12 h-12 rounded-lg bg-ink/10" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">💗</div>
          <h3 className="text-lg font-semibold text-ink mb-2">No activity yet</h3>
          <p className="text-ink-muted text-sm">Loves, comments, and new memories from your family will show up here.</p>
        </div>
      ) : (
        <>
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted pt-5 pb-1">{section.title}</p>
              <div className="divide-y divide-black/5">
                {section.items.map((item) => (
                  <Row key={item.id} item={item} meId={user?.id} />
                ))}
              </div>
            </div>
          ))}

          {pagination && page < pagination.pages && (
            <div className="flex justify-center mt-6">
              <button onClick={() => setPage((p) => p + 1)} disabled={loading} className="btn-secondary">
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
