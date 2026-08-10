import React from 'react';

/**
 * Responsive brand lockup, Sunrise-themed:
 *   - mobile (< sm): the compact heart+family mark (fits tight navs)
 *   - sm and up: the full horizontal lockup (mark + "Our sweet family", no tagline)
 * `size` = rendered pixel height. `white` swaps to reversed variants for dark backgrounds.
 */
export default function Logo({
  size = 44,
  white = false,
  className = '',
  title = 'Our Sweet Family',
  // eslint-disable-next-line no-unused-vars
  tone,
  // eslint-disable-next-line no-unused-vars
  wordmark,
}) {
  const mark = white ? '/brand/osf-mark-white.svg' : '/brand/osf-mark-sunrise.svg';
  const full = white
    ? '/brand/osf-horizontal-notag-white.svg'
    : '/brand/osf-horizontal-notag-sunrise.svg';
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img src={mark} alt={title} className="block sm:hidden" style={{ height: size, width: 'auto' }} />
      <img src={full} alt={title} className="hidden sm:block" style={{ height: size, width: 'auto' }} />
    </span>
  );
}
