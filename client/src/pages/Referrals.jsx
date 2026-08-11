import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../lib/api';

const SHARE_MESSAGE =
  "Join me on Our Sweet Family — a private, ad-free home for your kids' photos and videos. Sign up with my link and we both get Plus free for 90 days:";

export default function Referrals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/referrals/me')
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>;
  }

  const link = data?.code ? `${window.location.origin}/signup?ref=${data.code}` : '';
  const shareText = `${SHARE_MESSAGE} ${link}`;
  const rewardActive = data?.rewardActiveUntil && new Date(data.rewardActiveUntil) > new Date();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Our Sweet Family', text: SHARE_MESSAGE, url: link });
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      copy();
    }
  };

  const shareLinks = [
    { label: 'Email', href: `mailto:?subject=${encodeURIComponent('Join our family on Our Sweet Family')}&body=${encodeURIComponent(shareText)}` },
    { label: 'Text', href: `sms:?&body=${encodeURIComponent(shareText)}` },
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Refer friends</h1>
        <p className="text-ink-muted text-sm mt-1">
          Invite another family to Our Sweet Family. When they sign up with your link and start their
          family, <span className="font-semibold text-brand-600">you both get Plus free for {data?.rewardDays || 90} days.</span>
        </p>
      </div>

      {/* Reward status */}
      {rewardActive && (
        <div className="card p-5 mb-6 bg-sunrise-soft border-brand-200">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎉</div>
            <div>
              <p className="font-semibold text-ink">You have Plus, on the house</p>
              <p className="text-sm text-ink-soft">Active until {format(new Date(data.rewardActiveUntil), 'MMMM d, yyyy')}.</p>
            </div>
          </div>
        </div>
      )}

      {/* Share link */}
      <div className="card p-5 mb-6">
        <label className="block text-sm font-medium text-ink-soft mb-2">Your invite link</label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="input flex-1 text-sm text-ink-soft"
          />
          <button onClick={copy} className="btn-primary whitespace-nowrap">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={nativeShare} className="btn-secondary text-sm">Share…</button>
          {shareLinks.map((s) => (
            <a key={s.label} href={s.href} className="btn-secondary text-sm" target="_blank" rel="noreferrer">
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">Families you've brought in</p>
          <p className="text-3xl font-extrabold text-ink">{data?.count ?? 0}</p>
        </div>
        <div className="text-4xl">👨‍👩‍👧‍👦</div>
      </div>
    </div>
  );
}
