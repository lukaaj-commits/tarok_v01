// Gibanje kot v Applovih aplikacijah:
//  - AnimatedNumber: številka se prešteje do nove vrednosti (npr. 70 → 140)
//  - ReorderList: ko se vrstni red spremeni, elementi gladko zdrsnejo na novo mesto
import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { Text, TextStyle, StyleProp, Animated, LayoutChangeEvent, Platform } from 'react-native';

const NATIVE = Platform.OS !== 'web';
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function AnimatedNumber({ value, style, duration = 550 }: { value: number; style?: StyleProp<TextStyle>; duration?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const v = Math.round(from + (value - from) * easeOut(t));
      setShown(v);
      fromRef.current = v;
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
    // varovalka: na koncu vedno pokaži točno vrednost (tudi če brskalnik upočasni animacijo)
    const done = setTimeout(() => { if (frame.current) cancelAnimationFrame(frame.current); fromRef.current = value; setShown(value); }, duration + 60);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); clearTimeout(done); };
  }, [value]);

  return <Text style={style}>{shown}</Text>;
}

// Seznam, kjer elementi gladko zdrsnejo na novo mesto, ko se vrstni red spremeni.
// Položaje izračunamo sami iz višin elementov (na spletu onLayout ne javi samega premika).
export function ReorderList({ items, gap = 0 }: { items: { key: string; node: ReactNode }[]; gap?: number }) {
  const heights = useRef<Record<string, number>>({});
  const values = useRef<Record<string, Animated.Value>>({});
  const prevOrder = useRef<string[]>(items.map(i => i.key));
  const valueFor = (k: string) => (values.current[k] = values.current[k] || new Animated.Value(0));

  const order = items.map(i => i.key);
  const orderKey = order.join('|');

  useLayoutEffect(() => {
    const before = prevOrder.current;
    prevOrder.current = order;
    if (before.join('|') === orderKey) return;
    const tops = (list: string[]) => {
      const out: Record<string, number> = {};
      let y = 0;
      list.forEach(k => { out[k] = y; y += (heights.current[k] || 0) + gap; });
      return out;
    };
    const oldTop = tops(before.filter(k => order.includes(k)));
    const newTop = tops(order);
    order.forEach(k => {
      if (oldTop[k] === undefined) return;
      const d = oldTop[k] - newTop[k];
      if (Math.abs(d) < 1) return;
      const v = valueFor(k);
      v.setValue(d);
      Animated.spring(v, { toValue: 0, useNativeDriver: NATIVE, friction: 10, tension: 70 }).start();
    });
  }, [orderKey]);

  return (
    <>
      {items.map(i => (
        <Animated.View
          key={i.key}
          onLayout={(e: LayoutChangeEvent) => { heights.current[i.key] = e.nativeEvent.layout.height; }}
          style={{ transform: [{ translateY: valueFor(i.key) }] }}
        >
          {i.node}
        </Animated.View>
      ))}
    </>
  );
}
