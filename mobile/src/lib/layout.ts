import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visual height of the floating tab bar (see app/(app)/_layout.tsx). */
export const TAB_BAR_HEIGHT = 60;

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
