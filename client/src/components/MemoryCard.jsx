import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../lib/api';

export default function MemoryCard({ memory, onReactionChange }) {
  const [liked, setLiked] = useState(
    memory.reactions?.some((r) => r.userId === memory._currentUserId)
  );
  const [likeCount, setLikeCount] = useState(memory.reactions?.length || 0);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (liked) {
        await api.delete(`/memories/${memory.id}/reactions`);
        setLiked(false);
        setLikeCount((c) => c - 1);
      } else {
        await api.post(`/memories/${memory.id}/reactions`);
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
      onReactionChange?.();
    } catch (err) {
      console.error(err);
    }
  };

  const imageUrl = memory.thumbnailUrl || memory.fileUrl;
  const capturedDate = new Date(memory.capturedAt);

  return (
    <Link to={`/memories/${memory.id}`} className="block group">
      <div className="card overflow-hidden hover:shadow-md transition-shadow duration-200">
        {/* Image / Video */}
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {memory.fileType === 'video' ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <video
                src={memory.fileUrl}
                className="w-full h-full object-cover"
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-6 h-6 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={memory.caption || 'Memory'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          )}

          {/* Age labels overlay */}
          {memory.ageLabels?.length > 0 && (
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
              {memory.ageLabels.slice(0, 2).map((al) => (
                <span
                  key={al.childId}
                  className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm"
                >
                  {al.childName}: {al.ageLabel}
                </span>
              ))}
            </div>
          )}

          {/* Classified badge */}
          {memory.isClassified && (
            <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
              Private
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div className="p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{format(capturedDate, 'MMM d, yyyy')}</p>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition-colors ${liked ? 'text-brand-500' : 'text-gray-400 hover:text-brand-400'}`}
            >
              <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {likeCount > 0 && likeCount}
            </button>
          </div>
          {memory.caption && (
            <p className="text-sm text-gray-700 mt-1 truncate">{memory.caption}</p>
          )}
          {memory.comments?.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{memory.comments.length} comment{memory.comments.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
