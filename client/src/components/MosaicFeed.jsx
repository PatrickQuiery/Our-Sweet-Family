import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AuthedImage } from './AuthedMedia';
import { buildTimeline } from '../lib/mosaic';

function Tile({ memory, weight }) {
  const img = memory.thumbnailUrl || memory.fileUrl;
  const isVideo = memory.fileType === 'video';
  return (
    <Link
      to={`/memories/${memory.id}`}
      className="relative block rounded-xl overflow-hidden bg-brand-50 group"
      style={{ flexGrow: weight, flexBasis: 0, minWidth: 0 }}
    >
      {img ? (
        <AuthedImage
          src={img}
          alt={memory.caption || 'Memory'}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-2xl">📷</div>
      )}

      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-white/85 flex items-center justify-center backdrop-blur-sm shadow">
            <svg className="w-5 h-5 text-ink ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/55 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="absolute bottom-1.5 left-2 text-white text-[11px] font-medium drop-shadow opacity-0 group-hover:opacity-100 transition-opacity">
        {format(new Date(memory.capturedAt), 'MMM d')}
      </span>
    </Link>
  );
}

/** Editorial, varied-size photo mosaic grouped by date — mirrors the mobile timeline. */
export default function MosaicFeed({ memories = [] }) {
  const sections = useMemo(() => buildTimeline(memories), [memories]);
  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <section key={s.key}>
          <div className="flex items-baseline justify-between mb-2.5">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-ink-soft">{s.title}</h3>
            <span className="text-xs text-ink-muted">{s.count}</span>
          </div>
          <div className="flex flex-col gap-2">
            {s.rows.map((row) => (
              <div key={row.key} className="flex gap-2 w-full" style={{ aspectRatio: 1 / row.h }}>
                {row.tiles.map((t) => (
                  <Tile key={t.memory.id} memory={t.memory} weight={t.weight} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
