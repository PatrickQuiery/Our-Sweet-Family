import { type ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { GlassView } from '../GlassView';

/** Frosted "liquid glass" card — translucent blur instead of a solid panel. */
export function Card({ style, children }: ViewProps) {
  const { shadow } = useTheme();
  return (
    <GlassView style={[shadow.soft, style]}>
      {children}
    </GlassView>
  );
}
