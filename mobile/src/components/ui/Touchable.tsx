import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  /** Scale target while pressed. */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pressable with a subtle spring press-scale — the small tactile motion that makes
 * taps feel native. Uses the RN Animated API on the native driver (no extra deps).
 */
export function Touchable({ children, pressedScale = 0.97, style, onPressIn, onPressOut, ...rest }: TouchableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const handleIn = (e: GestureResponderEvent) => {
    spring(pressedScale);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    spring(1);
    onPressOut?.(e);
  };

  return (
    <Pressable {...rest} onPressIn={handleIn} onPressOut={handleOut}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
