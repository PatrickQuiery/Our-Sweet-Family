import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import MosaicFeed from '../components/MosaicFeed';
import DashboardTimeline from '../components/DashboardTimeline';
import { resolveChildColors } from '../lib/childColor';
import { readFeedCache, writeFeedCache } from '../lib/feedCache';

export default function Dashboard() {
  const { user, family, loading: authLoading } = useAuth();
  const [memories, setMemories] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Timeline scrubber window: { from, to, label } (ISO strings) or null for "all".
  const [range, setRange] = useState(null);
  const [error, setError] = useState('');
  // Background refresh over already-shown (cached) content — drives the "Updating…" pill.
  const [revalidating, setRevalidating] = useState(false);

  // The unfiltered "most recent" view is the one we cache/hydrate.
  const isDefaultView = !selectedChild && !selectedType && !debouncedSearch && !range;

  // Hydrate instantly from the on-device cache on first paint of the default view,
  // so a refresh shows the last-seen memories while the network refetch runs.
  useEffect(() => {
    if (!family?.id || !isDefaultView) return;
    const cached = readFeedCache(family.id);
    if (cached?.memories?.length) {
      setMemories((prev) => (prev.length ? prev : cached.memories));
      setLoading(false);
    }
    // Only on family change — we don't want to re-seed after filters clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchChildren = useCallback(async () => {
    if (!family) return;
    try {
      const { data } = await api.get(`/children?familyId=${family.id}`);
      setChildren(data.children);
    } catch (err) {
      console.error(err);
    }
  }, [family]);

  const fetchMemories = useCallback(async (reset = false) => {
    if (!family) return;
    const currentPage = reset ? 1 : page;
    const defaultView = !selectedChild && !selectedType && !debouncedSearch && !range;
    setLoading(true);
    if (reset) setRevalidating(true);
    setError('');
    try {
      const params = new URLSearchParams({
        familyId: family.id,
        page: currentPage,
        limit: 20,
      });
      if (selectedChild) params.set('childId', selectedChild);
      if (selectedType) params.set('type', selectedType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);

      const { data } = await api.get(`/memories?${params}`);
      if (reset || currentPage === 1) {
        setMemories(data.memories);
        // Refresh the on-device cache with the newest default-view first page.
        if (defaultView) writeFeedCache(family.id, data.memories);
      } else {
        setMemories((prev) => [...prev, ...data.memories]);
      }
      setPagination(data.pagination);
      if (reset) setPage(1);
    } catch (err) {
      setError('Failed to load memories.');
    } finally {
      setLoading(false);
      if (reset) setRevalidating(false);
    }
  }, [family, page, selectedChild, selectedType, debouncedSearch, range]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    fetchMemories(true);
  }, [family, selectedChild, selectedType, debouncedSearch, range]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
  };

  useEffect(() => {
    if (page > 1) fetchMemories(false);
  }, [page]);

  // Distinct filter color per child (same-gender siblings differ).
  const childColors = useMemo(() => resolveChildColors(children), [children]);

  // While auth/family are still resolving, show a skeleton — never the "no family"
  // prompt (that flashed the empty state before data arrived).
  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-2 animate-pulse py-2">
        <div className="flex gap-2 w-full" style={{ aspectRatio: 1 / 0.52 }}>
          <div className="rounded-xl bg-ink/10" style={{ flexGrow: 2, flexBasis: 0 }} />
          <div className="rounded-xl bg-ink/10" style={{ flexGrow: 1, flexBasis: 0 }} />
        </div>
        <div className="flex gap-2 w-full" style={{ aspectRatio: 1 / 0.36 }}>
          <div className="flex-1 rounded-xl bg-ink/10" />
          <div className="flex-1 rounded-xl bg-ink/10" />
          <div className="flex-1 rounded-xl bg-ink/10" />
        </div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
        <h2 className="text-xl font-bold text-ink mb-2">No family set up yet</h2>
        <p className="text-ink-soft mb-6">Create your family to start sharing memories.</p>
        <Link to="/onboarding" className="btn-primary">
          Set up your family
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Family Timeline</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-ink-muted text-sm">{family.name}</p>
            {revalidating && memories.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-600 px-2.5 py-0.5 text-xs font-medium">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Updating…
              </span>
            )}
            {range && (
              <button
                onClick={() => setRange(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 pl-2.5 pr-2 py-0.5 text-xs font-medium hover:bg-brand-100 transition-colors"
                title="Clear timeline filter"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {range.label}
                <span className="text-brand-400 text-sm leading-none">×</span>
              </button>
            )}
          </div>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload memory
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search captions and #tags…"
          className="w-full pl-9 pr-8 py-2 bg-surface/60 backdrop-blur border border-ink/5 rounded-xl text-sm text-ink placeholder:text-ink-muted outline-none focus:border-brand-300"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-soft text-lg leading-none">×</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedChild('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !selectedChild ? 'bg-brand-500 text-white' : 'bg-surface/60 backdrop-blur text-ink-soft border border-white/60 dark:border-white/10 hover:bg-surface/80'
          }`}
        >
          All children
        </button>
        {children.map((child) => {
          const color = childColors[child.id];
          const active = selectedChild === child.id;
          return (
            <button
              key={child.id}
              onClick={() => setSelectedChild(active ? '' : child.id)}
              style={active ? { backgroundColor: color } : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active ? 'text-white' : 'bg-surface/60 backdrop-blur text-ink-soft border border-white/60 dark:border-white/10 hover:bg-surface/80'
              }`}
            >
              {!active && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
              {child.name}
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          {['', 'photo', 'video'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedType === t ? 'bg-ink text-paper' : 'bg-surface/60 backdrop-blur text-ink-soft border border-white/60 dark:border-white/10 hover:bg-surface/80'
              }`}
            >
              {t === '' ? 'All' : t === 'photo' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {loading && memories.length === 0 ? (
        <div className="space-y-2 animate-pulse">
          <div className="flex gap-2 w-full" style={{ aspectRatio: 1 / 0.52 }}>
            <div className="rounded-xl bg-ink/10" style={{ flexGrow: 2, flexBasis: 0 }} />
            <div className="rounded-xl bg-ink/10" style={{ flexGrow: 1, flexBasis: 0 }} />
          </div>
          <div className="flex gap-2 w-full" style={{ aspectRatio: 1 / 0.36 }}>
            <div className="flex-1 rounded-xl bg-ink/10" />
            <div className="flex-1 rounded-xl bg-ink/10" />
            <div className="flex-1 rounded-xl bg-ink/10" />
          </div>
        </div>
      ) : memories.length === 0 ? (
        (range || selectedChild || selectedType || debouncedSearch) ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-ink mb-2">
              {range ? `No memories in ${range.label}` : 'No memories match these filters'}
            </h3>
            <p className="text-ink-muted text-sm mb-6">Try a different {range ? 'time range' : 'filter'}, or clear it to see everything.</p>
            <button
              onClick={() => { setRange(null); setSelectedChild(''); setSelectedType(''); setSearch(''); }}
              className="btn-secondary"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📷</div>
            <h3 className="text-lg font-semibold text-ink mb-2">No memories yet</h3>
            <p className="text-ink-muted text-sm mb-6">Upload your first photo or video to get started.</p>
            <Link to="/upload" className="btn-primary">Upload first memory</Link>
          </div>
        )
      ) : (
        <>
          <MosaicFeed memories={memories} currentUser={{ id: user?.id, name: user?.name }} />

          {pagination && page < pagination.pages && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn-secondary"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}

          {pagination && (
            <p className="text-center text-sm text-ink-muted mt-4">
              Showing {memories.length} of {pagination.total} memories
            </p>
          )}
        </>
      )}
      </div>

      {/* Right-hand time rail — dates on the left, each child's age on the right;
          scroll through time and zoom to sharpen the resolution. */}
      <aside className="hidden xl:block w-72 flex-shrink-0 sticky top-6">
        <DashboardTimeline kids={children} memories={memories} range={range} onRangeChange={setRange} />
      </aside>
    </div>
  );
}
