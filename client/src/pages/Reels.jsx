import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AuthedImage, AuthedVideo } from '../components/AuthedMedia';

const REEL_TYPES = [
  { value: 'annual', label: 'Annual', plans: ['free', 'plus', 'premium'] },
  { value: 'monthly', label: 'Monthly', plans: ['plus', 'premium'] },
  { value: 'birthday', label: 'Birthday', plans: ['premium'] },
  { value: 'holiday', label: 'Holiday', plans: ['premium'] },
];

export default function Reels() {
  const { user, family } = useAuth();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reelType, setReelType] = useState('annual');
  const [selectedChild, setSelectedChild] = useState('');
  const [children, setChildren] = useState([]);
  const [error, setError] = useState('');
  const [activeReel, setActiveReel] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!family) return;
    api.get(`/children?familyId=${family.id}`).then(({ data }) => setChildren(data.children));
  }, [family]);

  useEffect(() => {
    if (!family) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ familyId: family.id, type: reelType });
    if (selectedChild) params.set('childId', selectedChild);
    api.get(`/reels?${params}`)
      .then(({ data }) => { setReels(data.reels); })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load reels'))
      .finally(() => setLoading(false));
  }, [family, reelType, selectedChild]);

  const openReel = (reel) => {
    setActiveReel(reel);
    setSlideIndex(0);
    setPlaying(true);
  };

  const closeReel = () => {
    setActiveReel(null);
    setPlaying(false);
  };

  const planAllows = (types) => types.includes(user?.plan || 'free');

  // Auto-advance slideshow
  useEffect(() => {
    if (!playing || !activeReel) return;
    if (slideIndex >= activeReel.memories.length - 1) return;
    const t = setTimeout(() => setSlideIndex((i) => i + 1), 3000);
    return () => clearTimeout(t);
  }, [playing, slideIndex, activeReel]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-2">Memory Reels</h1>
      <p className="text-ink-muted text-sm mb-6">Auto-generated slideshows from your best moments.</p>

      {/* Type selector */}
      <div className="flex gap-2 flex-wrap mb-4">
        {REEL_TYPES.map((rt) => {
          const allowed = planAllows(rt.plans);
          return (
            <button
              key={rt.value}
              onClick={() => allowed && setReelType(rt.value)}
              disabled={!allowed}
              title={allowed ? '' : `Requires ${rt.plans[0]} plan`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
                reelType === rt.value
                  ? 'bg-brand-500 text-white'
                  : allowed
                  ? 'bg-surface border border-ink/5 text-ink-soft hover:bg-brand-50/60 dark:hover:bg-brand-500/10'
                  : 'bg-ink/5 text-ink-muted cursor-not-allowed'
              }`}
            >
              {rt.label}
              {!allowed && <span className="ml-1 text-xs">🔒</span>}
            </button>
          );
        })}
      </div>

      {/* Child filter */}
      {children.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setSelectedChild('')}
            className={`px-3 py-1 rounded-full text-xs font-medium ${!selectedChild ? 'bg-ink text-paper' : 'bg-surface border border-ink/5 text-ink-soft hover:bg-brand-50/60 dark:hover:bg-brand-500/10'}`}
          >
            All
          </button>
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChild(c.id === selectedChild ? '' : c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${selectedChild === c.id ? 'bg-ink text-paper' : 'bg-surface border border-ink/5 text-ink-soft hover:bg-brand-50/60 dark:hover:bg-brand-500/10'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : reels.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎬</div>
          <h3 className="text-lg font-semibold text-ink mb-2">No reels yet</h3>
          <p className="text-ink-muted text-sm">Upload more memories to generate your first reel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reels.map((reel) => {
            const cover = reel.memories.find((m) => m.thumbnailUrl || m.fileType === 'photo');
            return (
              <button key={reel.key} onClick={() => openReel(reel)} className="card overflow-hidden text-left hover:shadow-md transition-shadow group">
                <div className="relative aspect-video bg-gray-900 overflow-hidden">
                  {cover ? (
                    <AuthedImage
                      src={cover.thumbnailUrl || cover.fileUrl}
                      alt={reel.label}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white font-bold text-lg leading-tight">{reel.label}</p>
                    <p className="text-white/70 text-sm">{reel.memories.length} {reel.memories.length === 1 ? 'memory' : 'memories'}</p>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-ink ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox slideshow */}
      {activeReel && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={closeReel}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{activeReel.label}</h2>
            <button onClick={closeReel} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {activeReel.memories[slideIndex] && (
              <>
                {activeReel.memories[slideIndex].fileType === 'video' ? (
                  <AuthedVideo
                    key={activeReel.memories[slideIndex].id}
                    src={activeReel.memories[slideIndex].fileUrl}
                    className="max-w-full max-h-full object-contain"
                    autoPlay
                    muted
                  />
                ) : (
                  <AuthedImage
                    key={activeReel.memories[slideIndex].id}
                    src={activeReel.memories[slideIndex].fileUrl}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </>
            )}

            {/* Nav arrows */}
            {slideIndex > 0 && (
              <button onClick={() => setSlideIndex((i) => i - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40">
                ‹
              </button>
            )}
            {slideIndex < activeReel.memories.length - 1 && (
              <button onClick={() => setSlideIndex((i) => i + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40">
                ›
              </button>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 py-3" onClick={(e) => e.stopPropagation()}>
            {activeReel.memories.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
