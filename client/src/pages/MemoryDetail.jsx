import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AuthedImage, AuthedVideo } from '../components/AuthedMedia';
import TagInput from '../components/TagInput';

export default function MemoryDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [familyChildren, setFamilyChildren] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editChildIds, setEditChildIds] = useState([]);
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fetchMemory = async () => {
    try {
      const { data } = await api.get(`/memories/${id}`);
      setMemory(data.memory);
      setLiked(data.memory.reactions?.some((r) => r.userId === user?.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Memory not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMemory(); }, [id]);

  // Load the family's children so tags can be edited (which child chips to show).
  useEffect(() => {
    if (!memory?.familyId) return;
    api.get(`/children?familyId=${memory.familyId}`)
      .then(({ data }) => setFamilyChildren(data.children))
      .catch(() => {});
  }, [memory?.familyId]);

  const startEdit = () => {
    setEditErr('');
    setEditChildIds(memory.childIds || (memory.ageLabels || []).map((a) => a.childId));
    setEditCaption(memory.caption || '');
    setEditTags(memory.tags || []);
    setEditing(true);
  };

  const toggleEditChild = (cid) => {
    setEditChildIds((prev) => (prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]));
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    setEditErr('');
    try {
      const { data } = await api.patch(`/memories/${id}`, {
        childIds: editChildIds,
        caption: editCaption,
        tags: editTags,
      });
      setMemory((m) => ({ ...m, ...data.memory }));
      setEditing(false);
    } catch (err) {
      setEditErr(err.response?.data?.error || 'Could not save changes');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await api.delete(`/memories/${id}/reactions`);
        setLiked(false);
        setMemory((m) => ({ ...m, reactions: m.reactions.filter((r) => r.userId !== user.id) }));
      } else {
        await api.post(`/memories/${id}/reactions`);
        setLiked(true);
        setMemory((m) => ({ ...m, reactions: [...(m.reactions || []), { userId: user.id, type: 'love' }] }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/memories/${id}/comments`, { text: comment });
      setMemory((m) => ({ ...m, comments: [...(m.comments || []), data.comment] }));
      setComment('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this memory? This cannot be undone.')) return;
    try {
      await api.delete(`/memories/${id}`);
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Fetch the original with the auth token, then save it via a temporary link.
      const res = await api.get(`/memories/${id}/download`, { responseType: 'blob' });
      const type = res.data.type || '';
      const ext = type.includes('quicktime') ? '.mov'
        : type.includes('video') ? '.mp4'
        : type.includes('png') ? '.png'
        : type.includes('webp') ? '.webp'
        : type.includes('gif') ? '.gif' : '.jpg';
      const base = (memory.caption || 'memory').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'memory';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/memories/${id}/comments/${commentId}`);
      setMemory((m) => ({ ...m, comments: m.comments.filter((c) => c.id !== commentId) }));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-4">Go back</button>
      </div>
    );
  }

  const canDelete = user?.role === 'owner' || memory.uploadedById === user?.id;
  const canEdit = canDelete;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      <div className="card overflow-hidden">
        {/* Media */}
        <div className="bg-black flex items-center justify-center min-h-64 max-h-[600px] overflow-hidden">
          {memory.fileType === 'video' ? (
            <AuthedVideo
              src={memory.fileUrl}
              controls
              className="max-w-full max-h-[600px] w-full"
            />
          ) : (
            <AuthedImage
              src={memory.fileUrl}
              alt={memory.caption || 'Memory'}
              className="max-w-full max-h-[600px] object-contain"
            />
          )}
        </div>

        <div className="p-5">
          {/* Caption */}
          {!editing && memory.caption && (
            <p className="text-ink font-medium text-base mb-3">{memory.caption}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted mb-4">
            <span>{format(new Date(memory.capturedAt), 'MMMM d, yyyy')}</span>
            <span>by {memory.uploadedBy?.name}</span>
            {memory.isClassified && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                Parent-only
              </span>
            )}
          </div>

          {/* Photo location — parents only (the API only sends it to the family
              owner, and only when the setting is on; members never receive it). */}
          {memory.latitude != null && memory.longitude != null && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted mb-4">
              <span>
                📍 {[memory.locationCity, memory.locationState].filter(Boolean).join(', ') ||
                  `${memory.latitude.toFixed(4)}, ${memory.longitude.toFixed(4)}`}
              </span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${memory.latitude}&mlon=${memory.longitude}#map=15/${memory.latitude}/${memory.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                View on map
              </a>
              <span className="text-xs text-ink-muted">· visible to parents only</span>
            </div>
          )}

          {/* Age labels + edit affordance (read mode) */}
          {!editing && (
            <div className="mb-4">
              {memory.ageLabels?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {memory.ageLabels.map((al) => (
                    <div key={al.childId} className="flex items-center gap-1.5 bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-sm">
                      <span className="font-semibold">{al.childName}</span>
                      <span className="text-brand-500">·</span>
                      <span>{al.ageLabel}</span>
                    </div>
                  ))}
                </div>
              )}
              {memory.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {memory.tags.map((t) => (
                    <span key={t} className="bg-ink/5 text-ink-soft rounded-full px-2.5 py-0.5 text-xs">#{t}</span>
                  ))}
                </div>
              )}
              {canEdit && (
                <button
                  onClick={startEdit}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {memory.ageLabels?.length > 0 ? 'Edit tags & caption' : 'Tag children & add a caption'}
                </button>
              )}
            </div>
          )}

          {/* Edit mode */}
          {editing && (
            <div className="mb-4 rounded-xl border border-black/5 p-4">
              {editErr && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-3">{editErr}</div>
              )}
              {familyChildren.length > 0 ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-ink-soft mb-2">Tag children</label>
                  <div className="flex flex-wrap gap-2">
                    {familyChildren.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => toggleEditChild(child.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          editChildIds.includes(child.id)
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'border-ink-muted/30 text-ink-soft hover:border-brand-300'
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-muted mb-4">No children to tag yet — add one on the Children page first.</p>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Caption</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Add a caption..."
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-soft mb-1.5">Tags</label>
                <TagInput value={editTags} onChange={setEditTags} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary">
                  {savingEdit ? 'Saving...' : 'Save changes'}
                </button>
                <button onClick={() => setEditing(false)} className="btn-secondary" disabled={savingEdit}>Cancel</button>
              </div>
            </div>
          )}

          {/* Reactions row */}
          <div className="flex items-center justify-between py-3 border-t border-b border-black/5 mb-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 font-medium text-sm transition-colors ${liked ? 'text-brand-500' : 'text-ink-muted hover:text-brand-400'}`}
            >
              <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {memory.reactions?.length > 0
                ? `${memory.reactions.length} ${memory.reactions.length === 1 ? 'love' : 'loves'}`
                : 'Love'}
            </button>
            <div className="flex items-center gap-4">
              {memory.canDownload && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 18, height: 18 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {downloading ? 'Preparing…' : 'Download'}
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors">
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-3 mb-4">
            {memory.comments?.length === 0 && (
              <p className="text-sm text-ink-muted">No comments yet. Be the first!</p>
            )}
            {memory.comments?.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0 mt-0.5">
                  {c.user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{c.user?.name}</span>
                    <span className="text-xs text-ink-muted">{format(new Date(c.createdAt), 'MMM d')}</span>
                    {c.userId === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-xs text-red-400 hover:text-red-600 ml-auto"
                      >
                        delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft">{c.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Add comment */}
          <form onSubmit={handleComment} className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0 mt-2">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <input
              type="text"
              className="input flex-1"
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="submit" disabled={!comment.trim() || submitting} className="btn-primary px-4">
              {submitting ? '...' : 'Post'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
