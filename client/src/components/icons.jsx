import React from 'react';

/**
 * Shared UI icon set (CC-3). One canonical drawing per concept so the heart,
 * chat bubble, trash, etc. look identical everywhere instead of the 3 different
 * hearts / 2 different chat icons that had accreted across screens.
 *
 * 24×24 viewBox; size + colour come from `className` (Tailwind `w-* h-* text-*`).
 * `filled` swaps an icon between a stroked outline (actions) and a solid glyph
 * (e.g. the Activity badges, or a "liked" heart).
 */
function Glyph({ className = 'w-5 h-5', filled = false, children }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HeartIcon = ({ className, filled }) => (
  <Glyph className={className} filled={filled}>
    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </Glyph>
);

export const ChatIcon = ({ className, filled }) => (
  <Glyph className={className} filled={filled}>
    <path d="M20 2H4a2 2 0 00-2 2v13a2 2 0 002 2h4v3l4-3h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
  </Glyph>
);

export const TrashIcon = ({ className }) => (
  <Glyph className={className}>
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </Glyph>
);

export const PencilIcon = ({ className }) => (
  <Glyph className={className}>
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </Glyph>
);

export const DownloadIcon = ({ className }) => (
  <Glyph className={className}>
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </Glyph>
);

export const CloseIcon = ({ className }) => (
  <Glyph className={className}>
    <path d="M6 18L18 6M6 6l12 12" />
  </Glyph>
);

export const PlusIcon = ({ className }) => (
  <Glyph className={className}>
    <path d="M12 4v16m8-8H4" />
  </Glyph>
);
