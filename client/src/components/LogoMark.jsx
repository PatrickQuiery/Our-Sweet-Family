import React from 'react';

/**
 * The Our Sweet Family mark — the ORIGINAL production logo, unchanged (pixel-perfect).
 * Rendered as an <img> of /logo.svg so it always matches the real brand asset.
 * (heart/fig recolor props are accepted for API compatibility but no longer apply,
 *  since the original artwork has fixed colors and its own background.)
 */
export default function LogoMark({
  size = 40,
  className = '',
  style = {},
  title = 'Our Sweet Family',
  // eslint-disable-next-line no-unused-vars
  heart,
  // eslint-disable-next-line no-unused-vars
  fig,
}) {
  return (
    <img
      src="/logo.svg"
      alt={title}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block', ...style }}
    />
  );
}
