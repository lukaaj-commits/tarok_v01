// Črna podlaga aplikacije in nežna modra sija za posamezen zaslon.
import { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { T } from '@/lib/theme';

export default function AppBackground({ children }: { children: ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

// Vsak zaslon ima svoje neprosojno črno ozadje s sijem,
// zato se skriti zavihek nikoli ne vidi skozi aktivnega.
export function ScreenWithGlow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          <View style={[styles.glow, styles.glowTop]} />
          <View style={[styles.glow, styles.glowBottom]} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  glow: { position: 'absolute', borderRadius: 999 },
  glowTop: {
    top: 10, left: -90, width: 340, height: 340,
    // @ts-ignore – samo splet
    backgroundImage: 'radial-gradient(circle, rgba(10,132,255,0.10) 0%, rgba(0,0,0,0) 70%)',
  },
  glowBottom: {
    top: 330, right: -160, width: 360, height: 360,
    // @ts-ignore – samo splet
    backgroundImage: 'radial-gradient(circle, rgba(10,132,255,0.065) 0%, rgba(0,0,0,0) 70%)',
  },
});
