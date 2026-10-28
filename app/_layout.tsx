import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { PlayerProfileProvider } from '@/components/PlayerProfileProvider';
import AppBackground from '@/components/AppBackground';
import { loadWebFont } from '@/lib/webFont';
import DialogHost from '@/components/DialogHost';
import PinGate from '@/components/PinGate';
import { StoryEntryHost } from '@/components/StoryEntry';

loadWebFont();

// temna tema navigacije s črnim ozadjem
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#000000', card: '#000000', primary: '#0A84FF' } };

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AppBackground>
      <ThemeProvider value={navTheme}>
      <PinGate>
      <PlayerProfileProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        {/* zgodba prejšnjega meseca (z začetnega zaslona ali zvonca) */}
        <StoryEntryHost />
        <DialogHost />
        <StatusBar style="light" />
      </PlayerProfileProvider>
      </PinGate>
      </ThemeProvider>
    </AppBackground>
  );
}
