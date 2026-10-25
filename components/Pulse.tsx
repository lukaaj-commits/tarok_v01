// Nežni "val" (enaka animacija kot pri gumbu Nova igra):
// obroč se pokaže, razširi navzven in zbledi.
import { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform, StyleSheet } from 'react-native';

const NATIVE = Platform.OS !== 'web';

type RingProps = {
  size: number;          // premer obroča na začetku (velikost elementa, okoli katerega je)
  color: string;
  scaleTo?: number;      // kako daleč se razširi
  duration?: number;
  waves?: number;        // koliko valov hkrati (zamaknjenih)
  times?: number;        // kolikokrat se ponovi; brez = neskončno
  trigger?: any;         // ob spremembi se animacija začne znova (npr. novo obvestilo)
  borderWidth?: number;
};

// Obroči okoli elementa (postavi v ovojnico z position: relative, centrirano)
export function PulseRings({ size, color, scaleTo = 1.8, duration = 2400, waves = 2, times, trigger, borderWidth = 1.5 }: RingProps) {
  const vals = useRef(Array.from({ length: waves }, () => new Animated.Value(0))).current;

  useEffect(() => {
    vals.forEach(v => v.setValue(0));
    const one = (v: Animated.Value, i: number) => Animated.sequence([
      Animated.delay(i * (duration / waves)),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
    ]);
    const anims = vals.map((v, i) => (times ? Animated.loop(one(v, i), { iterations: times }) : Animated.loop(one(v, i))));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [trigger]);

  return (
    <>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size, height: size, borderRadius: size / 2, borderColor: color, borderWidth,
              marginLeft: -size / 2, marginTop: -size / 2,
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

// Majhna pika "v živo" z valom okoli
export function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: size / 2, top: size / 2 }}>
        <PulseRings size={size} color={color} scaleTo={2.8} duration={1800} waves={1} borderWidth={1.5} />
      </View>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', left: 0, top: 0 },
});
