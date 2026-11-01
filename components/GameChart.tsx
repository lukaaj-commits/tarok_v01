// Graf poteka igre (Stanje igre -> Graf poteka).
// - vpisi, narejeni skoraj hkrati (igralec + klicani, klop ...), so ena runda;
//   nova runda se začne, ko mine več kot 90 s ali ko isti igralec dobi že drugi vpis
// - cel večer na enem zaslonu, ravne črte, ime in točke na koncu vsake črte
// - črtkana ničla; izbran igralec je poudarjen, ostali zatemnjeni
// - tap na graf pokaže stanje v tisti rundi
import { useMemo, useRef, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';

const ROUND_GAP_MS = 90 * 1000; // vpisi z manj kot 90 s razmika so ista runda
const DIM = 'rgba(255,255,255,0.18)';

type P = { id: string; name: string };
type E = { player_id?: string; points: number; created_at: string };

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
const short = (n: string) => (n.length > 9 ? n.slice(0, 8) + '…' : n);

export default function GameChart({ players, entries, colorOf, focusId, height = 300 }: {
  players: P[]; entries: E[]; colorOf: (playerId: string) => string; focusId?: string | null; height?: number;
}) {
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const box = useRef<any>(null);

  // runde in seštevki po rundah
  const { rounds, series } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const rounds: { at: string; deltas: Record<string, number> }[] = [];
    let last = -Infinity;
    sorted.forEach(e => {
      const t = new Date(e.created_at).getTime();
      const cur = rounds[rounds.length - 1];
      // isti igralec ne more imeti dveh vpisov v eni rundi
      if (!cur || t - last > ROUND_GAP_MS || (e.player_id && e.player_id in cur.deltas)) rounds.push({ at: e.created_at, deltas: {} });
      last = t;
      if (e.player_id) rounds[rounds.length - 1].deltas[e.player_id] = (rounds[rounds.length - 1].deltas[e.player_id] || 0) + Number(e.points);
    });
    const series: Record<string, number[]> = {};
    players.forEach(p => {
      let s = 0;
      series[p.id] = [0, ...rounds.map(r => (s += r.deltas[p.id] || 0))];
    });
    return { rounds, series };
  }, [players, entries]);

  const NR = rounds.length;
  const pL = 10, pR = 82, pT = 14, pB = 26;
  const H = height;

  const all = players.flatMap(p => series[p.id] || []).concat(0);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi === lo) { hi += 50; lo -= 50; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const X = (i: number) => pL + (i * (w - pL - pR)) / Math.max(NR, 1);
  const Y = (v: number) => pT + ((hi - v) / (hi - lo)) * (H - pT - pB);

  // mreža: lep korak (največ ~5 črt)
  const step = [50, 100, 200, 250, 500, 1000, 2000, 5000].find(s => (hi - lo) / s <= 5) || 10000;
  const grid: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) if (v !== 0) grid.push(v);

  // ure spodaj (prva runda v novi uri)
  const hours: { x: number; label: string }[] = [];
  let lastHour = '', lastX = -99;
  rounds.forEach((r, i) => {
    const hr = hhmm(r.at).slice(0, 2);
    if (hr === lastHour) return;
    lastHour = hr;
    const x = X(i + 1);
    if (x - lastX < 34 || x > w - pR) return;
    lastX = x;
    hours.push({ x, label: `${hr}:00` });
  });

  // imena na koncu črt (razmaknjena, da se ne prekrivajo)
  const ends = [...players].sort((a, b) => (series[b.id]?.[NR] ?? 0) - (series[a.id]?.[NR] ?? 0));
  const labelY: Record<string, number> = {};
  let prev = -Infinity;
  ends.forEach(p => { let y = Y(series[p.id]?.[NR] ?? 0); if (y - prev < 15) y = prev + 15; labelY[p.id] = y; prev = y; });
  const overflow = prev - (H - 6);
  if (overflow > 0) ends.forEach(p => { labelY[p.id] -= overflow; });

  const order = [...players.filter(p => p.id !== focusId), ...players.filter(p => p.id === focusId)];
  const lineColor = (id: string) => (focusId && id !== focusId ? DIM : colorOf(id));

  const onTap = (x: number) => {
    if (!NR || !w) return;
    const i = Math.min(NR, Math.max(1, Math.round(((x - pL) / (w - pL - pR)) * NR)));
    setScrub(s => (s === i ? null : i));
  };

  const tipRows = scrub !== null ? [...players].sort((a, b) => (series[b.id][scrub] ?? 0) - (series[a.id][scrub] ?? 0)) : [];
  const tipLeft = scrub !== null && X(scrub) > w / 2;

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && NR > 0 && (
        <Pressable ref={box} style={{ width: w, height: H }} onPress={e => {
          // mesto dotika glede na levi rob grafa (v brskalniku iz roba elementa, na telefonu locationX)
          const n: any = e.nativeEvent;
          const rect = box.current?.getBoundingClientRect?.();
          onTap(rect && n.pageX != null ? n.pageX - rect.left - (window.scrollX || 0) : n.locationX ?? 0);
        }}>
          <Svg width={w} height={H}>
            {grid.map(v => (
              <Line key={`g${v}`} x1={pL} x2={w - pR + 4} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,0.06)" />
            ))}
            {grid.map(v => (
              <SvgText key={`t${v}`} x={pL + 2} y={Y(v) - 3} fill="#636366" fontSize={9.5}>{v > 0 ? `+${v}` : `${v}`}</SvgText>
            ))}
            <Line x1={pL} x2={w - pR + 4} y1={Y(0)} y2={Y(0)} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
            {hours.map(h => (
              <SvgText key={h.label} x={h.x} y={H - 8} fill="#8E8E93" fontSize={10} textAnchor="middle">{h.label}</SvgText>
            ))}
            {order.map(p => (
              <Polyline key={`l${p.id}`} points={(series[p.id] || []).map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none"
                stroke={lineColor(p.id)} strokeWidth={p.id === focusId ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {order.map(p => (
              <Circle key={`c${p.id}`} cx={X(NR)} cy={Y(series[p.id]?.[NR] ?? 0)} r={p.id === focusId ? 4.5 : 3.5} fill={lineColor(p.id)} />
            ))}
            {ends.map(p => {
              const dim = !!focusId && p.id !== focusId;
              return [
                <SvgText key={`n${p.id}`} x={X(NR) + 8} y={labelY[p.id] + 4} fill={dim ? '#636366' : colorOf(p.id)} fontSize={11} fontWeight="600">{short(p.name)}</SvgText>,
                <SvgText key={`v${p.id}`} x={w - 2} y={labelY[p.id] + 4} fill={dim ? '#636366' : '#FFFFFF'} fontSize={11} fontWeight="600" textAnchor="end">{series[p.id]?.[NR] ?? 0}</SvgText>,
              ];
            })}
            {scrub !== null && <Line x1={X(scrub)} x2={X(scrub)} y1={pT} y2={H - pB} stroke="rgba(255,255,255,0.5)" />}
            {scrub !== null && players.map(p => (
              <Circle key={`s${p.id}`} cx={X(scrub)} cy={Y(series[p.id][scrub])} r={4} fill={colorOf(p.id)} stroke="#0C111D" strokeWidth={2} />
            ))}
          </Svg>
          {scrub !== null && (
            <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: tipLeft ? Math.max(4, X(scrub) - 142) : Math.min(w - 136, X(scrub) + 10), width: 132, borderRadius: 12, backgroundColor: 'rgba(28,36,56,0.96)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 7, paddingHorizontal: 9 }}>
              <View><SvgLabel text={`Runda ${scrub} · ${hhmm(rounds[scrub - 1].at)}`} /></View>
              {tipRows.map(p => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colorOf(p.id) }} />
                  <TipText bold={p.id === focusId} flex>{p.name}</TipText>
                  <TipText bold>{series[p.id][scrub]}</TipText>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

// majhna besedila v okencu (navaden Text, ne SVG)
function SvgLabel({ text }: { text: string }) { return <Text style={{ color: '#8E8E93', fontSize: 10.5, marginBottom: 3 }}>{text}</Text>; }
function TipText({ children, bold, flex }: { children: any; bold?: boolean; flex?: boolean }) {
  return <Text numberOfLines={1} style={{ color: bold ? '#FFFFFF' : '#EBEBF5', fontSize: 11.5, fontWeight: bold ? '600' : '400', flex: flex ? 1 : undefined }}>{children}</Text>;
}
