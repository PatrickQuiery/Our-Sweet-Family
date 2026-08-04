import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

function fmt(bytes) {
  if (!bytes) return '0 MB';
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes >= 10 * GB ? 0 : 1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function UsageMeter() {
  const { family } = useAuth();
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!family) return;
    api.get(`/families/${family.id}/usage`)
      .then(({ data }) => setUsage(data))
      .catch(() => setUsage(null));
  }, [family]);

  if (!usage) return null;

  const { usedVideoBytes, videoLimitBytes, plan, photoCount } = usage;
  const hasLimit = videoLimitBytes != null;
  const pct = hasLimit ? Math.min(100, (usedVideoBytes / videoLimitBytes) * 100) : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <Link to="/settings" className="block px-4 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors" title="View plan & storage">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500">Video storage</span>
        <span className="text-[10px] uppercase font-semibold tracking-wide text-gray-400">{plan}</span>
      </div>

      {hasLimit ? (
        <>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 tabular-nums">
            {fmt(usedVideoBytes)} of {fmt(videoLimitBytes)}
          </p>
        </>
      ) : (
        <p className="text-[11px] text-gray-500 tabular-nums">{fmt(usedVideoBytes)} used · Unlimited</p>
      )}

      {typeof photoCount === 'number' && (
        <p className="text-[10px] text-gray-400 mt-0.5">{photoCount} photo{photoCount === 1 ? '' : 's'}</p>
      )}
    </Link>
  );
}
