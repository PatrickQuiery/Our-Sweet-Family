import React, { useState, useEffect } from 'react';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

function ageLabel(dob) {
  const now = new Date();
  const birth = new Date(dob);
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years}y ${months}m`;
}

export default function Children() {
  const { user, family } = useAuth();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', dateOfBirth: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', dateOfBirth: '' });
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!family) return;
    api.get(`/children?familyId=${family.id}`).then(({ data }) => {
      setChildren(data.children);
      setLoading(false);
    });
  }, [family]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/children', {
        familyId: family.id,
        name: form.name,
        dateOfBirth: form.dateOfBirth,
      });
      setChildren((prev) => [...prev, data.child]);
      setForm({ name: '', dateOfBirth: '' });
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add child');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (child) => {
    setEditError('');
    setEditingId(child.id);
    setEditForm({
      name: child.name,
      dateOfBirth: new Date(child.dateOfBirth).toISOString().split('T')[0],
    });
  };

  const handleEdit = async (e, childId) => {
    e.preventDefault();
    setEditError('');
    setEditSubmitting(true);
    try {
      const { data } = await api.put(`/children/${childId}`, {
        name: editForm.name,
        dateOfBirth: editForm.dateOfBirth,
      });
      setChildren((prev) => prev.map((c) => (c.id === childId ? data.child : c)));
      setEditingId(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update child');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (childId) => {
    if (!window.confirm('Remove this child? Their memories will remain.')) return;
    try {
      await api.delete(`/children/${childId}`);
      setChildren((prev) => prev.filter((c) => c.id !== childId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Children</h1>
          <p className="text-gray-500 text-sm mt-1">{children.length} {children.length === 1 ? 'child' : 'children'} in your family</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + Add child
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Add a child</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Child's name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of birth</label>
              <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} max={new Date().toISOString().split('T')[0]} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add child'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {children.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👶</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No children yet</h3>
          {isOwner && <p className="text-gray-500 text-sm">Add your first child to start tagging memories.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            editingId === child.id ? (
              <div key={child.id} className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Edit {child.name}</h3>
                {editError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{editError}</div>}
                <form onSubmit={(e) => handleEdit(e, child.id)} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                    <input type="text" className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of birth</label>
                    <input type="date" className="input" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} max={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save changes'}</button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <div key={child.id} className="card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-2xl flex-shrink-0">
                  {child.avatarUrl ? (
                    <img src={child.avatarUrl} alt={child.name} className="w-full h-full rounded-2xl object-cover" />
                  ) : '👶'}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{child.name}</h3>
                  <p className="text-sm text-gray-500">{format(new Date(child.dateOfBirth), 'MMMM d, yyyy')} · {ageLabel(child.dateOfBirth)} old</p>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(child)}
                      className="p-2 text-gray-400 hover:text-brand-600 transition-colors"
                      title="Edit child"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(child.id)}
                      className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      title="Remove child"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
