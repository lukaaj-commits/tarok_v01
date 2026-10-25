import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { PlayerProfileProvider } from '@/components/PlayerProfileProvider';
import AppBackground from '@/components/AppBackground';
import { loadWebFont } from '@/lib/webFont';

loadWebFont();

// temna tema navigacije s črnim ozadjem
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#000000', card: '#000000', primary: '#0A84FF' } };

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AppBackground>
      <ThemeProvider value={navTheme}>
      <PlayerProfileProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
      </PlayerProfileProvider>
      </ThemeProvider>
    </AppBackground>
  );
}
