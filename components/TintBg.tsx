// Moder preliv za "poudarjene" kartice (zmagovalec, igralec meseca ...):
// zgoraj levo modra, proti desni spodaj pojenja skoraj v prosojno.
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const COLORS = ['rgba(10,132,255,0.26)', 'rgba(10,132,255,0.09)', 'rgba(255,255,255,0.03)'] as const;
const LOCATIONS = [0, 0.5, 1] as const;

export default function TintBg() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={COLORS}
      locations={LOCATIONS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
