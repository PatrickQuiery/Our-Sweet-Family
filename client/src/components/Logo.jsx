import React from 'react';
import LogoMark from './LogoMark';

// Color presets for the whole lockup (mark + wordmark).
const TONES = {
  brand: { heart: '#ef3f74', fig: '#232a45', w1: '#ef3f74', w2: '#232a45' }, // pink heart, ink figures/words
  ink: { heart: '#232a45', fig: '#232a45', w1: '#232a45', w2: '#232a45' },
  reversed: { heart: '#ffffff', fig: '#ffffff', w1: '#ffffff', w2: '#ffffff' }, // on dark / gradient
  onSunrise: { heart: '#ef3f74', fig: '#232a45', w1: '#ef3f74', w2: '#232a45' },
};

/**
 * Our Sweet Family lockup: recolorable mark + live-text wordmark (no baked text, no plate).
 * - tone: 'brand' | 'ink' | 'reversed' | 'onSunrise'
 * - wordmark: 'script' (keepsake) | 'clean' (Poppins) | 'none' (mark only)
 */
export default function Logo({
  tone = 'brand',
  wordmark = 'script',
  size = 40,
  className = '',
}) {
  const t = TONES[tone] || TONES.brand;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark heart={t.heart} fig={t.fig} size={size} />

      {wordmark === 'clean' && (
        <span
          className="font-display font-extrabold tracking-tight leading-none"
          style={{ color: t.w2, fontSize: size * 0.5 }}
        >
          Our Sweet Family
        </span>
      )}

      {wordmark === 'script' && (
        <span className="flex flex-col leading-none" style={{ fontSize: size * 0.42 }}>
          <span className="font-semibold" style={{ color: t.w2, fontSize: '0.62em' }}>
            Our
          </span>
          <span
            className="font-script font-bold -my-0.5"
            style={{ color: t.w1, fontSize: '1.15em' }}
          >
            Sweet
          </span>
          <span className="font-semibold self-end" style={{ color: t.w2, fontSize: '0.62em' }}>
            Family
          </span>
        </span>
      )}
    </span>
  );
}
