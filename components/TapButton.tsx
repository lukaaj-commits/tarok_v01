// Gumb, ki se odzove takoj ob spustu prsta (ne čaka na brskalnikov "click").
// Na telefonu brskalnik po drsenju med zavihki včasih prvega klika ne pošlje,
// zato je moral uporabnik pritisniti dvakrat. Ta gumb deluje že na prvi dotik.
import { ReactNode, useRef, useState } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { swallowNextClick } from '@/lib/ghostClick';

export default function TapButton({ onPress, style, children, accessibilityLabel }: { onPress: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; accessibilityLabel?: string }) {
  const [down, setDown] = useState(false);
  const fired = useRef(0);
  const fire = () => { const now = Date.now(); if (now - fired.current < 400) return; fired.current = now; swallowNextClick(); onPress(); };
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[style, down && { opacity: 0.7 }]}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => setDown(true)}
      onResponderRelease={() => { setDown(false); fire(); }}
      onResponderTerminate={() => setDown(false)}
    >
      {children}
    </View>
  );
}
