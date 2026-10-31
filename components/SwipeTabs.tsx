// Drsenje levo/desno med zavihki (kot v aplikacijah na telefonu).
// Vsebina med drsenjem sledi prstu; ko spustiš dovolj daleč (ali dovolj hitro), odplava v stran
// in nova pripelje z druge strani. Sicer se mehko vrne na mesto.
// Dotiki na vodoravno drsnih delih (npr. krogi mesecev, graf) se ne štejejo - ti se premikajo sami.
import { ReactNode, useRef } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle, Platform, GestureResponderEvent } from 'react-native';

const NATIVE = Platform.OS !== 'web';
const LOCK = 8;        // po koliko pikah se odločimo: vodoravno ali navpično
const SWITCH = 0.22;   // delež širine, ki ga je treba podrsati za menjavo
const FLICK = 0.45;    // ali hiter poteg (pik na milisekundo)

const pt = (e: GestureResponderEvent) => {
  const n: any = e.nativeEvent;
  const t = n.touches?.[0] ?? n.changedTouches?.[0] ?? n;
  return { x: t.pageX ?? 0, y: t.pageY ?? 0 };
};

// ali je dotik znotraj vodoravno drsnega dela (ki ima svoje drsenje)
function inHorizontalScroller(target: any, stop: any) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  let el = target;
  while (el && el !== stop && el.nodeType === 1) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = window.getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

// onSwipe(1) = naslednji zavihek (prst gre v levo), onSwipe(-1) = prejšnji (prst gre v desno)
export default function SwipeTabs({ canPrev, canNext, onSwipe, children, style }: {
  canPrev: boolean; canNext: boolean; onSwipe: (dir: 1 | -1) => void; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const last = useRef({ x: 0, t: 0, v: 0 });
  const mode = useRef<'none' | 'h' | 'v'>('none');
  const dx = useRef(0);
  const width = useRef(360);
  const busy = useRef(false);
  const host = useRef<any>(null);

  const onTouchStart = (e: GestureResponderEvent) => {
    mode.current = 'none'; dx.current = 0;
    if (busy.current || inHorizontalScroller((e.nativeEvent as any).target, host.current)) { start.current = null; return; }
    const p = pt(e);
    start.current = { ...p, t: Date.now() };
    last.current = { x: p.x, t: Date.now(), v: 0 };
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    if (!start.current || mode.current === 'v') return;
    const p = pt(e);
    const ddx = p.x - start.current.x, ddy = p.y - start.current.y;
    if (mode.current === 'none') {
      if (Math.abs(ddx) < LOCK && Math.abs(ddy) < LOCK) return;
      mode.current = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? 'h' : 'v';
      if (mode.current === 'v') return;
    }
    const now = Date.now();
    if (now > last.current.t) last.current = { x: p.x, t: now, v: (p.x - last.current.x) / (now - last.current.t) };
    dx.current = ddx;
    const allowed = ddx < 0 ? canNext : canPrev;
    // prst vodi vsebino; na robu (ni več zavihkov) le rahlo popusti
    x.setValue(allowed ? ddx : ddx * 0.18);
  };
  const onTouchEnd = () => {
    const d = dx.current, v = last.current.v;
    const wasH = mode.current === 'h';
    start.current = null; mode.current = 'none'; dx.current = 0;
    if (!wasH) return;
    const dir: 1 | -1 = d < 0 ? 1 : -1;
    const W = width.current;
    const far = Math.abs(d) > W * SWITCH || (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(d));
    if (far && (dir === 1 ? canNext : canPrev)) {
      busy.current = true;
      // trenutna vsebina odplava v stran ...
      Animated.timing(x, { toValue: -dir * W, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(() => {
        onSwipe(dir);
        // ... nova pripelje z druge strani
        x.setValue(dir * W * 0.6);
        requestAnimationFrame(() => {
          Animated.timing(x, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start(() => { busy.current = false; });
        });
      });
    } else {
      Animated.spring(x, { toValue: 0, useNativeDriver: NATIVE, friction: 9, tension: 70 }).start();
    }
  };

  const opacity = x.interpolate({ inputRange: [-width.current, 0, width.current], outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' });

  return (
    <View ref={host} onLayout={e => { if (e.nativeEvent.layout.width > 0) width.current = e.nativeEvent.layout.width; }}
      style={[style, { touchAction: 'pan-y', overflow: 'hidden' } as any]}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <Animated.View style={[{ flex: (style as any)?.flex ? 1 : undefined, flexShrink: 1 }, { opacity, transform: [{ translateX: x }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}
