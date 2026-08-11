import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, View } from 'react-native';
import { Text } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import type { Child, Memory } from '../lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface TimeRange {
  from: string;
  to: string;
  label: string;
}

interface Props {
  kids: Child[];
  memories: Memory[];
  range: TimeRange | null;
  onRangeChange: (r: TimeRange | null) => void;
}

/**
 * Right-edge date scrubber (Google/Amazon-Photos style, adapted for touch): drag
 * the thumb — or tap the rail — to filter the feed to that year, with a floating
 * month bubble while active. The span is expand-only so filtering the feed (which
 * shrinks `memories` to the selected range) never collapses the rail.
 */
export function TimelineScrubber({ kids, memories, range, onRangeChange }: Props) {
  const { colors, fonts, radius } = useTheme();
  const trackRef = useRef<View>(null);
  const geom = useRef({ top: 0, height: 1 }); // window coords for pan math
  const [h, setH] = useState(0); // layout height for drawing
  const [drag, setDrag] = useState<{ f: number } | null>(null);

  const spanRef = useRef<{ start: number; end: number } | null>(null);
  const { start, end } = useMemo(() => {
    const now = Date.now();
    const dates = [
      ...kids.map((k) => (k.dateOfBirth ? +new Date(k.dateOfBirth) : NaN)),
      ...memories.map((m) => (m.capturedAt ? +new Date(m.capturedAt) : NaN)),
    ].filter((n) => !Number.isNaN(n));
    const obsStart = dates.length ? Math.min(...dates) : now - 365 * 864e5;
    const prev = spanRef.current;
    const s = prev ? Math.min(prev.start, obsStart) : obsStart;
    const e = prev ? Math.max(prev.end, now) : now;
    spanRef.current = { start: s, end: e };
    return { start: s, end: e };
  }, [kids, memories]);

  const span = Math.max(1, end - start);
  const fracOf = (ms: number) => clamp01((end - ms) / span);
  const dateAt = (f: number) => new Date(end - clamp01(f) * span);

  // Latest closures behind refs so the once-created PanResponder never goes stale.
  const measure = () => trackRef.current?.measureInWindow((x, y, w, hh) => { if (hh) geom.current = { top: y, height: hh }; });
  const commitAt = (f: number) => {
    const d = dateAt(f);
    const y = d.getFullYear();
    const from = new Date(y, 0, 1);
    const to = new Date(Math.min(+new Date(y, 11, 31, 23, 59, 59), end));
    onRangeChange({ from: from.toISOString(), to: to.toISOString(), label: String(y) });
  };
  const measureRef = useRef(measure); measureRef.current = measure;
  const commitRef = useRef(commitAt); commitRef.current = commitAt;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => { measureRef.current(); setDrag({ f: clamp01((e.nativeEvent.pageY - geom.current.top) / geom.current.height) }); },
      onPanResponderMove: (e) => setDrag({ f: clamp01((e.nativeEvent.pageY - geom.current.top) / geom.current.height) }),
      onPanResponderRelease: (e) => { commitRef.current(clamp01((e.nativeEvent.pageY - geom.current.top) / geom.current.height)); setDrag(null); },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  useEffect(() => { measure(); }, [h]); // re-measure once laid out / after resize

  const years = useMemo(() => {
    const a: { y: number; f: number }[] = [];
    for (let y = new Date(end).getFullYear(); y >= new Date(start).getFullYear(); y--) a.push({ y, f: fracOf(+new Date(y, 0, 1)) });
    return a;
  }, [start, end]);

  if (!memories.length && !kids.length) return null;

  const selectedYear = range && /^\d{4}$/.test(range.label) ? Number(range.label) : null;
  const rangeMidF = range ? fracOf((+new Date(range.from) + +new Date(range.to)) / 2) : 0;
  const thumbF = drag ? drag.f : rangeMidF;
  const active = !!drag;
  const bubbleDate = dateAt(thumbF);

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 44 }}>
      <View
        ref={trackRef}
        onLayout={(e) => { setH(e.nativeEvent.layout.height); measure(); }}
        {...pan.panHandlers}
        style={{ flex: 1 }}
      >
        {/* thin rail */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 7,
            width: active ? 6 : 4,
            borderRadius: 3,
            backgroundColor: active ? colors.primarySoft : colors.fill,
          }}
        />

        {/* year ticks — dots always; labels while interacting */}
        {h > 0 &&
          years.map((t) => (
            <View key={t.y} style={{ position: 'absolute', right: 4, top: t.f * h - 3 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: selectedYear === t.y ? colors.primary : colors.border,
                }}
              />
              {active ? (
                <Text
                  style={{ position: 'absolute', right: 14, top: -6, fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted }}
                >
                  {`'${String(t.y).slice(2)}`}
                </Text>
              ) : null}
            </View>
          ))}

        {/* thumb */}
        {h > 0 ? (
          <View
            style={{
              position: 'absolute',
              right: 2,
              top: thumbF * h - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.surface,
              ...Platform.select({
                ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
                android: { elevation: 3 },
                default: {},
              }),
            }}
          />
        ) : null}
      </View>

      {/* floating month bubble while dragging */}
      {active && h > 0 ? (
        <View
          style={{
            position: 'absolute',
            right: 26,
            top: thumbF * h - 14,
            backgroundColor: colors.text,
            borderRadius: radius.sm,
            paddingHorizontal: 10,
            paddingVertical: 5,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
              android: { elevation: 5 },
              default: {},
            }),
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.bg }}>
            {`${MONTHS[bubbleDate.getMonth()]} ${bubbleDate.getFullYear()}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
