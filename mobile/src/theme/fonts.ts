import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

/** Passed to expo-font's useFonts() in the root layout. Keys match theme.fonts. */
export const appFontMap = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  DancingScript_700Bold,
};

// Back-compat alias (root layout may still import interFontMap).
export const interFontMap = appFontMap;
