// Drsenje levo/desno med zavihki (kot v aplikacijah na telefonu).
// Sosednji zavihek leži tik ob trenutnem in med drsenjem pripotuje s prstom; ob spustu
// gib gladko nadaljuje v isti smeri (brez premora). Če ne podrsaš dovolj, se mehko vrne.
// Dotiki na vodoravno drsnih delih (krogi mesecev, graf) se ne štejejo - ti se premikajo sami.
import { Children, ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle, Platform, GestureResponderEvent } from 'react-native';

const NATIVE = Platform.OS !== 'web';
const LOCK = 8;        // po koliko pikah se odločimo: vodoravno ali navpično
const SWITCH = 0.25;   // delež širine, ki ga je treba podrsati za menjavo
const FLICK = 0.4;     // ali hiter poteg (pik na milisekundo)
const GAP = 24;        // razmik med zavihkoma med drsenjem

const pt = (e: GestureResponderEvent) => {
  const n: any = e.nativeEvent;
  const t = n.touches?.[0] ?? n.changedTouches?.[0] ?? n;
  return { x: t.pageX ?? 0, y: t.pageY ?? 0 };
};

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

type Props = {
  index: number;                         // trenutni zavihek (od leve proti desni)
  onChange: (index: number) => void;
  count?: number;                        // pri renderPage: koliko je vseh strani
  renderPage?: (i: number) => ReactNode; // strani se rišejo sproti (le trenutna in sosednji)
  pageKey?: (i: number) => string | number;
  children?: ReactNode;                  // ali: vse strani kot otroci (ostanejo naložene)
  fill?: boolean;                        // strani zapolnijo višino (seznami z drsenjem)
  neighborTop?: () => number;            // od kod naj se vidi sosednja stran (ko si nižje na strani)
  style?: StyleProp<ViewStyle>;
};

export default function SwipeTabs({ index, onChange, count, renderPage, pageKey, children, fill, neighborTop, style }: Props) {
  const pages = renderPage ? null : Children.toArray(children);
  const n = pages ? pages.length : count || 0;
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const [nTop, setNTop] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = useRef({ x: 0, t: 0, v: 0 });
  const mode = useRef<'none' | 'h' | 'v'>('none');
  const dx = useRef(0);
  const busy = useRef(false);
  const host = useRef<any>(null);

  const xNow = useRef(0);       // kje je trak trenutno (ob spustu prsta)
  const pending = useRef<{ dir: number; duration: number } | null>(null);

  // zavihek se zamenja takoj ob spustu prsta (oznaka zgoraj ne zaostaja);
  // trak prestavimo tako, da je slika enaka kot pred menjavo, in animacijo peljemo do konca
  useLayoutEffect(() => {
    const p = pending.current;
    pending.current = null;
    if (!p) { x.setValue(0); xNow.current = 0; busy.current = false; return; }
    x.setValue(xNow.current + p.dir * (w + GAP));
    Animated.timing(x, { toValue: 0, duration: p.duration, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE })
      .start(() => { xNow.current = 0; busy.current = false; });
  }, [index]);

  const canPrev = index > 0, canNext = index < n - 1;

  const onTouchStart = (e: GestureResponderEvent) => {
    mode.current = 'none'; dx.current = 0;
    if (busy.current || !w || inHorizontalScroller((e.nativeEvent as any).target, host.current)) { start.current = null; return; }
    const p = pt(e);
    start.current = p;
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
      if (neighborTop) setNTop(Math.max(0, neighborTop()));
    }
    const now = Date.now();
    if (now > last.current.t) last.current = { x: p.x, t: now, v: 0.7 * ((p.x - last.current.x) / (now - last.current.t)) + 0.3 * last.current.v };
    dx.current = ddx;
    const allowed = ddx < 0 ? canNext : canPrev;
    xNow.current = allowed ? ddx : ddx * 0.18; // na robu le malo popusti
    x.setValue(xNow.current);
  };
  const onTouchEnd = () => {
    const d = dx.current, v = last.current.v;
    const wasH = mode.current === 'h';
    start.current = null; mode.current = 'none'; dx.current = 0;
    if (!wasH) return;
    const dir = d < 0 ? 1 : -1;
    const far = Math.abs(d) > w * SWITCH || (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(d));
    if (far && (dir === 1 ? canNext : canPrev)) {
      busy.current = true;
      const rest = w + GAP - Math.abs(d);
      // nadaljuj s hitrostjo prsta, nato mehko ustavi
      const duration = Math.max(170, Math.min(320, rest / Math.max(Math.abs(v), 1.2) * 1.8));
      pending.current = { dir, duration };
      onChange(index + dir);
    } else {
      Animated.spring(x, { toValue: 0, useNativeDriver: NATIVE, friction: 10, tension: 80 }).start();
    }
  };

  const page = (i: number) => (pages ? pages[i] : renderPage!(i));
  const key = (i: number) => (pages ? i : pageKey ? pageKey(i) : i);
  const shown = pages ? pages.map((_, i) => i) : [index - 1, index, index + 1].filter(i => i >= 0 && i < n);

  return (
    <View ref={host} onLayout={e => { const lw = e.nativeEvent.layout.width; if (lw > 0 && lw !== w) setW(lw); }}
      style={[style, { touchAction: 'pan-y', overflow: 'hidden' } as any]}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
      // ko drsiš vodoravno, prevzamemo dotik: vrstica pod prstom se ne obarva kot pritisnjena
      onMoveShouldSetResponderCapture={() => mode.current === 'h'}
      onResponderTerminationRequest={() => false}>
      <Animated.View style={[fill && { flex: 1 }, { transform: [{ translateX: x }] }]}>
        {shown.map(i => {
          const off = i - index;
          const side = off !== 0;
          const far = Math.abs(off) > 1 || (side && !w);
          return (
            <View key={key(i)} pointerEvents={side ? 'none' : 'auto'}
              style={side
                ? [{ position: 'absolute', left: off * (w + GAP), width: w, top: fill ? 0 : nTop }, fill && { bottom: 0 }, far && { display: 'none' }]
                : fill ? { flex: 1 } : undefined}>
              {page(i)}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
