import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  SplashScreen,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { FONT, FONT_ASSETS, useTheme } from '../src/theme';
import { Spinner } from '../src/components/ui';

void SplashScreen.preventAutoHideAsync();

function useNavigationTheme(): Theme {
  const { name, colors } = useTheme();
  const base = name === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: name === 'dark',
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };
}

/**
 * Route tree. Anonymous users only reach the (auth) stack; signed-in users get the tabs and
 * the detail screens. `Stack.Protected` redirects automatically when the session changes.
 */
function RootNavigator() {
  const { status } = useAuth();
  const { name, colors } = useTheme();
  const navTheme = useNavigationTheme();

  if (status === 'loading') return <Spinner label="Apro la sessione…" />;

  const signedIn = status === 'authenticated';
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: FONT.editorial },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="release/[id]" options={{ title: 'Release' }} />
          <Stack.Screen name="profile/[id]" options={{ title: 'Profilo' }} />
          <Stack.Screen name="connections/[id]" options={{ title: 'Follower' }} />
          <Stack.Screen name="chat/[userId]" options={{ title: 'Chat' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifiche' }} />
          <Stack.Screen name="settings" options={{ title: 'Impostazioni' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    // If a font fails we still render with the system font rather than block the app.
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
