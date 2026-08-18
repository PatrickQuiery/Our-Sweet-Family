import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/DialogProvider';
import api from '../lib/api';

const MILESTONE_TYPES = [
  { value: 'height', label: 'Height', unit: 'cm', icon: '📏' },
  { value: 'weight', label: 'Weight', unit: 'kg', icon: '⚖️' },
  { value: 'story', label: 'Story / Note', unit: '', icon: '📖' },
  { value: 'tooth', label: 'Tooth', unit: '', icon: '🦷' },
  { value: 'word', label: 'First Word', unit: '', icon: '💬' },
  { value: 'step', label: 'First Step', unit: '', icon: '👣' },
];

export default function Milestones() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user, family } = useAuth();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'height', value: '', unit: 'cm', note: '', date: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isPlusOrPremium = ['plus', 'premium'].includes(user?.plan);
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!family) return;
    api.get(`/children?familyId=${family.id}`).then(({ data }) => {
      setChildren(data.children);
      if (data.children.length > 0) setSelectedChild(data.children[0]);
    });
  }, [family]);

  useEffect(() => {
    if (!selectedChild || !isPlusOrPremium) return;
    setLoading(true);
    api.get(`/milestones?childId=${selectedChild.id}`)
      .then(({ data }) => setMilestones(data.milestones))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [selectedChild, isPlusOrPremium]);

  const handleTypeChange = (type) => {
    const t = MILESTONE_TYPES.find((m) => m.value === type);
    setForm((f) => ({ ...f, type, unit: t?.unit || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/milestones', {
        childId: selectedChild.id,
        ...form,
      });
      setMilestones((prev) => [data.milestone, ...prev]);
      setForm({ type: 'height', value: '', unit: 'cm', note: '', date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete this milestone?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/milestones/${id}`);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      toast('Failed to delete', 'error');
    }
  };

  if (!isPlusOrPremium) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-5xl mb-4">⭐</div>
        <h2 className="text-xl font-bold text-ink mb-2">Milestones require Plus or Premium</h2>
        <p className="text-ink-muted text-sm mb-6">Track height, weight, stories, and special firsts with a Plus or Premium plan.</p>
        <Link to="/settings" className="btn-primary">Upgrade your plan</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="type-title text-ink">Milestones</h1>
        {isOwner && selectedChild && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Add milestone</button>
        )}
      </div>

      {/* Child selector */}
      {children.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChild(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedChild?.id === c.id ? 'bg-brand-500 text-white' : 'bg-surface border border-ink/5 text-ink-soft hover:bg-brand-50/60 dark:hover:bg-brand-500/10'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-ink mb-4">New milestone for {selectedChild?.name}</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Type</label>
              <select className="input" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                {MILESTONE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Value</label>
                <input type="text" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.unit || 'Enter value'} required />
              </div>
              {form.unit && (
                <div className="w-24">
                  <label className="block text-sm font-medium text-ink-soft mb-1.5">Unit</label>
                  <input type="text" className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} max={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Note (optional)</label>
              <input type="text" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Any notes..." />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save milestone'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" /></div>
      ) : milestones.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📏</div>
          <h3 className="text-lg font-semibold text-ink mb-2">No milestones yet</h3>
          {isOwner ? (
            <p className="text-ink-muted text-sm">Start tracking {selectedChild?.name}'s growth and special firsts.</p>
          ) : (
            <p className="text-ink-muted text-sm">No milestones have been added for {selectedChild?.name} yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const type = MILESTONE_TYPES.find((t) => t.value === m.type);
            return (
              <div key={m.id} className="card p-4 flex items-center gap-3">
                <span className="text-2xl">{type?.icon || '📌'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{m.value}{m.unit && ` ${m.unit}`}</span>
                    <span className="text-xs text-ink-muted">{type?.label}</span>
                  </div>
                  {m.note && <p className="text-sm text-ink-muted">{m.note}</p>}
                  <p className="text-xs text-ink-muted mt-0.5">{format(new Date(m.date), 'MMMM d, yyyy')}</p>
                </div>
                {isOwner && (
                  <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
