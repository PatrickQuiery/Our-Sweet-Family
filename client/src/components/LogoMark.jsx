import React from 'react';

/**
 * Compact round mark — the circle-badge lockup, Sunrise-themed.
 * Use for small / square slots (mobile header, avatars, centered marks).
 * `white` swaps to the reversed variant for dark backgrounds.
 */
export default function LogoMark({
  size = 40,
  white = false,
  className = '',
  style = {},
  title = 'Our Sweet Family',
  // eslint-disable-next-line no-unused-vars
  heart,
  // eslint-disable-next-line no-unused-vars
  fig,
}) {
  const src = white ? '/brand/osf-4-circle-badge-white.svg' : '/brand/osf-4-circle-badge-sunrise.svg';
  return (
    <img
      src={src}
      alt={title}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block', ...style }}
    />
  );
}
