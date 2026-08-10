import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import MosaicFeed from '../components/MosaicFeed';
import DashboardTimeline from '../components/DashboardTimeline';

export default function Dashboard() {
  const { user, family } = useAuth();
  const [memories, setMemories] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState('');

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
    setLoading(true);
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

      const { data } = await api.get(`/memories?${params}`);
      if (reset || currentPage === 1) {
        setMemories(data.memories);
      } else {
        setMemories((prev) => [...prev, ...data.memories]);
      }
      setPagination(data.pagination);
      if (reset) setPage(1);
    } catch (err) {
      setError('Failed to load memories.');
    } finally {
      setLoading(false);
    }
  }, [family, page, selectedChild, selectedType, debouncedSearch]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    fetchMemories(true);
  }, [family, selectedChild, selectedType, debouncedSearch]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
  };

  useEffect(() => {
    if (page > 1) fetchMemories(false);
  }, [page]);

  if (!family) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No family set up yet</h2>
        <p className="text-gray-500 mb-6">Create your family to start sharing memories.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Family Timeline</h1>
          <p className="text-gray-500 text-sm mt-1">{family.name}</p>
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
        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search captions and #tags…"
          className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-300"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedChild('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !selectedChild ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All children
        </button>
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => setSelectedChild(child.id === selectedChild ? '' : child.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedChild === child.id ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {child.name}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['', 'photo', 'video'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedType === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
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
            <div className="rounded-xl bg-gray-200" style={{ flexGrow: 2, flexBasis: 0 }} />
            <div className="rounded-xl bg-gray-200" style={{ flexGrow: 1, flexBasis: 0 }} />
          </div>
          <div className="flex gap-2 w-full" style={{ aspectRatio: 1 / 0.36 }}>
            <div className="flex-1 rounded-xl bg-gray-200" />
            <div className="flex-1 rounded-xl bg-gray-200" />
            <div className="flex-1 rounded-xl bg-gray-200" />
          </div>
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📷</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No memories yet</h3>
          <p className="text-gray-500 text-sm mb-6">Upload your first photo or video to get started.</p>
          <Link to="/upload" className="btn-primary">Upload first memory</Link>
        </div>
      ) : (
        <>
          <MosaicFeed memories={memories} />

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
            <p className="text-center text-sm text-gray-400 mt-4">
              Showing {memories.length} of {pagination.total} memories
            </p>
          )}
        </>
      )}
      </div>

      {/* Right-hand time rail — dates on the left, each child's age on the right;
          scroll through time and zoom to sharpen the resolution. */}
      <aside className="hidden xl:block w-72 flex-shrink-0 sticky top-6">
        <DashboardTimeline kids={children} memories={memories} />
      </aside>
    </div>
  );
}
