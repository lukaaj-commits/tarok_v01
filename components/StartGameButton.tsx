// Začetni zaslon (ko ni aktivne igre): velik okrogel gumb "Nova igra"
// z dvema obročema, ki nežno utripata navzven in vabita k pritisku.
import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';

const SIZE = 184;      // gumb
const DURATION = 2600; // en val (ms)

export default function StartGameButton({ onPress }: { onPress: () => void }) {
  const waves = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const loops = waves.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * (DURATION / 2)),
          Animated.timing(v, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={styles.wrap}>
      {waves.map((v, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
            },
          ]}
        />
      ))}
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.button} accessibilityLabel="Začni novo igro">
        <Plus size={54} color="#fff" strokeWidth={2.4} />
        <Text style={styles.label}>Nova igra</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 360, height: 360, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1.5, borderColor: '#0A84FF' },
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { color: '#fff', fontSize: 17, fontWeight: '500' },
});
