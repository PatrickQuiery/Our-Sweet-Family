import { buildTimeline } from '../mosaic';
import type { Memory } from '../types';

function mem(id: string, opts: Partial<Memory>): Memory {
  return {
    id,
    fileType: 'photo',
    fileUrl: `/f/${id}`,
    thumbnailUrl: null,
    caption: null,
    childIds: [],
    // Local mid-day so buckets don't shift across the test runner's timezone.
    createdAt: '2026-08-05T12:00:00',
    ...opts,
  };
}

describe('timeline bucketing', () => {
  const now = new Date(2026, 7, 5, 12, 0, 0); // Aug 5 2026, local noon
  const opts = { width: 300, gap: 6 };

  it('buckets by capturedAt when present (when the photo was taken, not uploaded)', () => {
    // Uploaded today, but taken in 2018 → belongs under May 2018, not Today.
    const sections = buildTimeline([mem('a', { capturedAt: '2018-05-15T12:00:00', createdAt: '2026-08-05T10:00:00' })], opts, now);
    expect(sections[0].title).toBe('May 2018');
  });

  it('falls back to createdAt when capturedAt is absent', () => {
    const sections = buildTimeline([mem('b', { createdAt: '2026-08-05T09:00:00' })], opts, now);
    expect(sections[0].title).toBe('Today');
  });

  it('keeps sections in feed order (newest first), matching the API sort', () => {
    const sections = buildTimeline(
      [mem('new', { capturedAt: '2026-08-05T08:00:00' }), mem('old', { capturedAt: '2018-05-15T12:00:00' })],
      opts,
      now,
    );
    expect(sections.map((s) => s.title)).toEqual(['Today', 'May 2018']);
    expect(sections.map((s) => s.count)).toEqual([1, 1]);
  });
});
