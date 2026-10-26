// Potegni za osvežitev (kot v Mailu): na vrhu seznama potegneš navzdol, spusti in seznam se osveži.
// Na spletu RefreshControl ne deluje, zato je narejeno ročno z dotiki.
import { ReactNode, useRef, useState } from 'react';
import { View, Animated, StyleProp, ViewStyle, ActivityIndicator, StyleSheet, Platform, NativeSyntheticEvent, NativeScrollEvent, GestureResponderEvent } from 'react-native';

const NATIVE = Platform.OS !== 'web';
const TRIGGER = 64;   // kako daleč je treba potegniti
const HOLD = 52;      // kje ostane krogec med osveževanjem
const MAX = 100;

type ScrollProps = { onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; scrollEventThrottle: number };

export default function PullToRefresh({ onRefresh, children, color = '#0A84FF', style }: {
  onRefresh: () => Promise<any>;
  children: (scrollProps: ScrollProps) => ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;   // privzeto zapolni prostor (flex: 1); v oknih npr. { flexShrink: 1 }
}) {
  const pull = useRef(new Animated.Value(0)).current;
  const pullNow = useRef(0);
  const scrollY = useRef(0);
  const startY = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  // položaj prsta (deluje z dotiki na telefonu in v brskalniku)
  const getY = (e: GestureResponderEvent) => {
    const n: any = e.nativeEvent;
    return n.touches?.[0]?.pageY ?? n.changedTouches?.[0]?.pageY ?? n.pageY ?? 0;
  };
  const setPull = (v: number) => { pullNow.current = v; pull.setValue(v); };
  const animateTo = (v: number) => { pullNow.current = v; Animated.spring(pull, { toValue: v, useNativeDriver: NATIVE, friction: 9, tension: 80 }).start(); };

  const onTouchStart = (e: GestureResponderEvent) => {
    if (busy.current) return;
    startY.current = scrollY.current <= 0 ? getY(e) : null;
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    if (busy.current || startY.current === null) return;
    if (scrollY.current > 0) { startY.current = null; setPull(0); return; }
    const dy = getY(e) - startY.current;
    setPull(dy > 0 ? Math.min(dy * 0.5, MAX) : 0);
  };
  const onTouchEnd = async () => {
    if (busy.current || startY.current === null) return;
    startY.current = null;
    if (pullNow.current < TRIGGER) { animateTo(0); return; }
    busy.current = true;
    setRefreshing(true);
    animateTo(HOLD);
    // krogec pokažemo vsaj kratek čas, da je jasno, da se je osvežilo
    try { await Promise.all([onRefresh(), new Promise(r => setTimeout(r, 600))]); } catch (err) { console.error(err); }
    finally {
      setRefreshing(false);
      animateTo(0);
      busy.current = false;
    }
  };

  const scrollProps: ScrollProps = {
    onScroll: (e) => { scrollY.current = e.nativeEvent.contentOffset.y; },
    scrollEventThrottle: 16,
  };

  return (
    <View style={style || styles.wrap} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <Animated.View pointerEvents="none" style={[styles.indicator, { opacity: pull.interpolate({ inputRange: [0, 20, TRIGGER], outputRange: [0, 0.3, 1], extrapolate: 'clamp' }) }]}>
        <ActivityIndicator size="small" color={color} animating />
      </Animated.View>
      <Animated.View style={[style || styles.wrap, { transform: [{ translateY: pull }] }]}>
        {children(scrollProps)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  indicator: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
});
