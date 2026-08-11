import React, { useState, useEffect } from 'react';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { AuthedImage } from '../components/AuthedMedia';
import api from '../lib/api';

// Placeholder emoji changes with the child's age: baby → kid → teen. When a
// gender is set, the kid stage uses the matching figure.
function childEmoji(child) {
  const years = differenceInYears(new Date(), new Date(child.dateOfBirth));
  if (years < 1) return '👶';
  if (years < 13) {
    if (child.gender === 'male') return '👦';
    if (child.gender === 'female') return '👧';
    return '🧒';
  }
  return '🧑';
}

// Placeholder background: blue for boys, the app's reddish-pink for girls,
// neutral gray when gender is unset.
function avatarTone(gender) {
  if (gender === 'male') return 'from-blue-100 to-blue-200';
  if (gender === 'female') return 'from-brand-100 to-brand-200';
  return 'from-ink/5 to-ink/10';
}

function ChildAvatar({ child, className = 'w-12 h-12' }) {
  const external = /^https?:\/\//i.test(child.avatarUrl || '');
  // Private avatars are streamed by the API; the ?v= key busts the blob cache
  // when a new photo is uploaded. External seed URLs render directly.
  const src = child.avatarUrl
    ? external
      ? child.avatarUrl
      : `/children/${child.id}/avatar?v=${encodeURIComponent(child.avatarUrl)}`
    : null;
  return (
    <div className={`${className} rounded-2xl bg-gradient-to-br ${avatarTone(child.gender)} flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden`}>
      {src ? (
        <AuthedImage src={src} alt={child.name} className="w-full h-full rounded-2xl object-cover" />
      ) : (
        childEmoji(child)
      )}
    </div>
  );
}

function GenderSelect({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-soft mb-1.5">Gender</label>
      <div className="flex gap-2">
        {[['male', 'Male'], ['female', 'Female']].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(value === val ? '' : val)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              value === val
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'border-ink-muted/30 text-ink-soft hover:border-brand-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const [form, setForm] = useState({ name: '', dateOfBirth: '', gender: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', dateOfBirth: '', gender: '' });
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(null); // id of child mid upload/remove

  const isOwner = user?.role === 'owner';

  const handleAvatarUpload = async (childId, file) => {
    if (!file) return;
    setEditError('');
    setAvatarBusy(childId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Let the browser set the multipart Content-Type (with boundary) itself.
      const { data } = await api.post(`/children/${childId}/avatar`, fd);
      setChildren((prev) => prev.map((c) => (c.id === childId ? data.child : c)));
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setAvatarBusy(null);
    }
  };

  const handleAvatarRemove = async (childId) => {
    setEditError('');
    setAvatarBusy(childId);
    try {
      const { data } = await api.delete(`/children/${childId}/avatar`);
      setChildren((prev) => prev.map((c) => (c.id === childId ? data.child : c)));
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to remove photo');
    } finally {
      setAvatarBusy(null);
    }
  };

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
        gender: form.gender,
      });
      setChildren((prev) => [...prev, data.child]);
      setForm({ name: '', dateOfBirth: '', gender: '' });
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
      gender: child.gender || '',
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
        gender: editForm.gender,
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
          <h1 className="text-2xl font-bold text-ink">Children</h1>
          <p className="text-ink-muted text-sm mt-1">{children.length} {children.length === 1 ? 'child' : 'children'} in your family</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + Add child
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-ink mb-4">Add a child</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Name</label>
              <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Child's name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Date of birth</label>
              <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} max={new Date().toISOString().split('T')[0]} required />
            </div>
            <GenderSelect value={form.gender} onChange={(gender) => setForm({ ...form, gender })} />
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
          <h3 className="text-lg font-semibold text-ink mb-2">No children yet</h3>
          {isOwner && <p className="text-ink-muted text-sm">Add your first child to start tagging memories.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            editingId === child.id ? (
              <div key={child.id} className="card p-5">
                <h3 className="font-semibold text-ink mb-4">Edit {child.name}</h3>
                {editError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{editError}</div>}
                <form onSubmit={(e) => handleEdit(e, child.id)} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1.5">Photo</label>
                    <div className="flex items-center gap-4">
                      <ChildAvatar child={child} className="w-16 h-16" />
                      <div className="flex items-center gap-3">
                        <label className={`btn-secondary cursor-pointer ${avatarBusy === child.id ? 'opacity-60 pointer-events-none' : ''}`}>
                          {avatarBusy === child.id ? 'Uploading…' : child.avatarUrl ? 'Change photo' : 'Upload photo'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { handleAvatarUpload(child.id, e.target.files[0]); e.target.value = ''; }}
                          />
                        </label>
                        {child.avatarUrl && (
                          <button
                            type="button"
                            className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                            disabled={avatarBusy === child.id}
                            onClick={() => handleAvatarRemove(child.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1.5">Name</label>
                    <input type="text" className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1.5">Date of birth</label>
                    <input type="date" className="input" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} max={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <GenderSelect value={editForm.gender} onChange={(gender) => setEditForm({ ...editForm, gender })} />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save changes'}</button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <div key={child.id} className="card p-5 flex items-center gap-4">
                <ChildAvatar child={child} />
                <div className="flex-1">
                  <h3 className="font-bold text-ink">{child.name}</h3>
                  <p className="text-sm text-ink-muted">
                    {format(new Date(child.dateOfBirth), 'MMMM d, yyyy')} · {ageLabel(child.dateOfBirth)} old
                    {child.gender && ` · ${child.gender === 'male' ? 'Male' : 'Female'}`}
                  </p>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(child)}
                      className="p-2 text-ink-muted hover:text-brand-600 transition-colors"
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
