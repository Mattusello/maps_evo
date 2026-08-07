import '@/global.css';
import '@/i18n';

import {
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/archivo';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { ItinerariesProvider } from '@/context/ItinerariesContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { SyncProvider } from '@/context/SyncContext';
import { ThemeProvider, useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

/** Collega la preferenza di tema (SettingsContext) al ThemeProvider. */
function ThemedProviders({ children }: { children: ReactNode }) {
  const { themePreference } = useSettings();
  return (
    <ThemeProvider preference={themePreference}>
      <BottomSheetModalProvider>
        <AuthProvider>
          {/* Sync dopo gli itinerari: quando arrivano dati dal server deve poter
              chiedere alla lista di rileggersi. */}
          <ItinerariesProvider>
            <SyncProvider>{children}</SyncProvider>
          </ItinerariesProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </ThemeProvider>
  );
}

/** Stack di navigazione radice: tab principali + rotte modali/di dettaglio. */
function RootNavigator() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="itinerary/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="itinerary/[id]/index" />
        {/* Bersaglio del link profondo di condivisione (mymappa://import?c=…). */}
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemedProviders>
            <RootNavigator />
          </ThemedProviders>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
