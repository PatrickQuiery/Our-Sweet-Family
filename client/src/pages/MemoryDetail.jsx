import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AuthedImage, AuthedVideo } from '../components/AuthedMedia';

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

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
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
          {memory.caption && (
            <p className="text-gray-900 font-medium text-base mb-3">{memory.caption}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 mb-4">
            <span>{format(new Date(memory.capturedAt), 'MMMM d, yyyy')}</span>
            <span>by {memory.uploadedBy?.name}</span>
            {memory.isClassified && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                Parent-only
              </span>
            )}
          </div>

          {/* Age labels */}
          {memory.ageLabels?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {memory.ageLabels.map((al) => (
                <div key={al.childId} className="flex items-center gap-1.5 bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-sm">
                  <span className="font-semibold">{al.childName}</span>
                  <span className="text-brand-500">·</span>
                  <span>{al.ageLabel}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reactions row */}
          <div className="flex items-center justify-between py-3 border-t border-b border-gray-100 mb-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 font-medium text-sm transition-colors ${liked ? 'text-brand-500' : 'text-gray-500 hover:text-brand-400'}`}
            >
              <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {memory.reactions?.length > 0
                ? `${memory.reactions.length} ${memory.reactions.length === 1 ? 'love' : 'loves'}`
                : 'Love'}
            </button>
            {canDelete && (
              <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors">
                Delete
              </button>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-3 mb-4">
            {memory.comments?.length === 0 && (
              <p className="text-sm text-gray-400">No comments yet. Be the first!</p>
            )}
            {memory.comments?.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0 mt-0.5">
                  {c.user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{c.user?.name}</span>
                    <span className="text-xs text-gray-400">{format(new Date(c.createdAt), 'MMM d')}</span>
                    {c.userId === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-xs text-red-400 hover:text-red-600 ml-auto"
                      >
                        delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{c.text}</p>
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
