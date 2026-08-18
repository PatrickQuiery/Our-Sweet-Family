import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visual height of the floating tab bar (see app/(app)/_layout.tsx). */
export const TAB_BAR_HEIGHT = 60;

/**
 * The comfortable reading width for single-column card/list screens. On phones
 * the content is narrower than this so it fills the screen; in landscape / on
 * tablets it stops stretching edge-to-edge and centers instead (M7/M25/M69).
 * Spread `wideColumn` into a ScrollView/FlatList `contentContainerStyle`.
 */
export const CONTENT_MAX_WIDTH = 680;
export const wideColumn = {
  width: '100%' as const,
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center' as const,
};

/**
 * Bottom padding a scrollable screen needs so its last row clears the floating
 * tab bar + the home-indicator inset (M1). Replaces the hardcoded
 * `paddingBottom: 110` scattered across the tab screens with one derived value
 * that adapts to the device's safe area.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + 16;
}
