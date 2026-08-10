import React from 'react';

/**
 * Full horizontal lockup, Sunrise-themed. `size` = rendered pixel height.
 * `white` swaps to the reversed variant for dark backgrounds.
 */
export default function Logo({
  size = 40,
  white = false,
  className = '',
  title = 'Our Sweet Family',
  // eslint-disable-next-line no-unused-vars
  tone,
  // eslint-disable-next-line no-unused-vars
  wordmark,
}) {
  const src = white
    ? '/brand/osf-1-horizontal-white.svg'
    : '/brand/osf-1-horizontal-sunrise.svg';
  return (
    <img
      src={src}
      alt={title}
      className={className}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}
