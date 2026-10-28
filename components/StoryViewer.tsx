// =====================================================================
// ZGODBE - celozaslonsko okno kot na Instagramu
//  tap desno = naprej, tap levo = nazaj, pridrži = pavza, poteg navzdol / × = zapri,
//  vsak zaslon 6 s; na koncu se odpre naslednje (starejše) obdobje.
// =====================================================================
import { useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, Modal, Image, Animated, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, Polyline, Line } from 'react-native-svg';
import { X, Zap, Flame, Users, Swords } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getData } from '@/lib/dataCache';
import { computeStory, Story } from '@/lib/monthStory';
import { markSeen } from '@/lib/storySeen';
import { getAvatarUrl } from '@/lib/avatars';
import { g } from '@/lib/gender';

const SCREEN_MS = 6000;
const C = {
  text: '#FFFFFF', muted: '#8E8E93', faint: '#636366', blue: '#0A84FF', sky: '#64D2FF', gold: '#FFD60A',
  orange: '#FF9F0A', green: '#30D158', red: '#FF453A', purple: '#BF5AF2',
  card: 'rgba(40,100,200,0.08)', cardBorder: 'rgba(255,255,255,0.07)',
};
const BLUE_RING = ['#0A84FF', '#64D2FF', '#5E5CE6'] as const;
const GOLD_RING = ['#FFD60A', '#FF9F0A', '#FFF3B0'] as const;
const MONTH_GEN = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];

// --- pomožno ---------------------------------------------------------
const n3 = (n: number, a: string, b: string, c: string, d: string) => { const r = Math.abs(n) % 100; return r === 1 ? a : r === 2 ? b : r === 3 || r === 4 ? c : d; };
const fmt = (n: number) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // 1.240
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n);
const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const dayLong = (iso: string) => cap1(new Date(iso).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' }));
const dayShort = (iso: string) => new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' });
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
const durText = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };

// številka se prešteje od 0 navzgor
function CountUp({ value, format = fmt, style, duration = 900 }: { value: number; format?: (n: number) => string; style?: any; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setV(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // varovalka: na koncu vedno točna vrednost
    const done = setTimeout(() => setV(value), duration + 80);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [value]);
  return <Text style={style}>{format(v)}</Text>;
}

// slika igralca z obročem (preliv)
function Ring({ name, size, colors }: { name: string; size: number; colors: readonly string[] }) {
  return (
    <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={{ uri: getAvatarUrl(name) }} style={{ width: size - 16, height: size - 16, borderRadius: (size - 16) / 2, backgroundColor: '#1C1C1E' }} />
      </View>
    </LinearGradient>
  );
}
// slika igralca z obročem deleža (kot obroč aktivnosti)
function ShareRing({ name, pct, color, size = 72 }: { name: string; pct: number; color: string; size?: number }) {
  const w = 4, r = (size - w) / 2, c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={w} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={`${c * Math.max(0.02, Math.min(1, pct))} ${c}`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Image source={{ uri: getAvatarUrl(name) }} style={{ width: size - 16, height: size - 16, borderRadius: (size - 16) / 2, backgroundColor: '#1C1C1E' }} />
      </View>
    </View>
  );
}

const Cap = ({ t, color = C.muted }: { t: string; color?: string }) => <Text style={[s.cap, { color }]}>{t.toUpperCase()}</Text>;
const Card = ({ children, style }: { children: ReactNode; style?: any }) => <View style={[s.card, style]}>{children}</View>;
const Sep = ({ inset = 16 }: { inset?: number }) => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: inset }} />;

// znaki kot v Poteku igre
const SymDot = () => <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />;
const SymRing = () => <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' }} />;
const SymTri = () => <Svg width={12} height={12} viewBox="0 0 12 12"><Path d="M6 1l5 10H1z" fill="#fff" /></Svg>;
const SymValat = () => <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange }} />;

const Row = ({ label, sub, value, color = C.text }: { label: string; sub?: string; value: string; color?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
    <View>
      <Text style={{ fontSize: 17, color: C.text }}>{label}</Text>
      {!!sub && <Text style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>{sub}</Text>}
    </View>
    <Text style={{ fontSize: 22, fontWeight: '600', color, fontVariant: ['tabular-nums'] }}>{value}</Text>
  </View>
);
const Tile = ({ label, value, color = C.text }: { label: string; value: string; color?: string }) => (
  <Card style={{ width: '47%', flexGrow: 1, padding: 16 }}>
    <Text style={s.tileLabel}>{label}</Text>
    <Text style={[s.tileVal, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
  </Card>
);
const Hl = ({ icon, bg, title, sub, val, color }: { icon: ReactNode; bg: string; title: string; sub: string; val: string; color: string }) => (
  <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
    <View style={[s.iconBox, { backgroundColor: bg }]}>{icon}</View>
    <View style={{ flex: 1 }}><Text style={s.tileLabel}>{title}</Text><Text style={s.hlSub} numberOfLines={1}>{sub}</Text></View>
    <Text style={[s.hlVal, { color }]}>{val}</Text>
  </Card>
);
const Person = ({ name, pct, color, label, line }: { name: string; pct: number; color: string; label: string; line: string }) => (
  <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
    <ShareRing name={name} pct={pct} color={color} />
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '600', color: C.text, marginTop: 2 }}>{name}</Text>
      <Text style={{ fontSize: 14, color: C.muted }}>{line}</Text>
    </View>
  </Card>
);

// --- zasloni ---------------------------------------------------------
type Screen = { key: string; glow: string; node: ReactNode };

export function buildScreens(st: Story): Screen[] {
  const n = st.name;
  const year = st.period.length === 4;
  const accent = year ? C.gold : C.sky;
  const monthIdx = year ? 0 : Number(st.period.slice(5)) - 1;
  const f = (m: string, z: string) => g(n, m, z);
  const out: Screen[] = [];

  // 1. uvod
  out.push({ key: 'uvod', glow: year ? 'rgba(255,214,10,0.20)' : 'rgba(10,132,255,0.24)', node: (
    <View>
      <Ring name={n} size={112} colors={year ? GOLD_RING : BLUE_RING} />
      <View style={{ height: 30 }} />
      <Cap t={year ? 'Tvoje leto' : `Tvoj ${st.label.split(' ')[0].toLowerCase()}`} color={year ? C.gold : C.muted} />
      <Text style={s.hero}>{year ? `${n},\nto je bilo\ntvoje leto ${st.period}.` : `${n}, to je bil\ntvoj mesec\nza mizo.`}</Text>
    </View>
  ) });

  // 2. številke
  const prevLabel = year ? `leta ${Number(st.period) - 1}` : MONTH_GEN[(monthIdx + 11) % 12];
  let cmp = '';
  if (st.prevGames != null) {
    const dlt = st.games - st.prevGames;
    cmp = dlt === 0 ? `Enako kot ${prevLabel}.` : `To je ${Math.abs(dlt)} ${dlt > 0 ? 'več' : 'manj'} kot ${prevLabel}.`;
  }
  const mx = st.monthly ? Math.max(1, ...st.monthly.map(m => m.games)) : 1;
  out.push({ key: 'stevilke', glow: year ? 'rgba(255,214,10,0.18)' : 'rgba(10,132,255,0.22)', node: (
    <View>
      <Cap t={year ? 'Leto v številkah' : 'V številkah'} color={year ? C.gold : C.muted} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
        <CountUp value={st.games} style={s.giant} />
        <Text style={s.giantUnit}>{n3(st.games, 'igra', 'igri', 'igre', 'iger')}</Text>
      </View>
      {!!cmp && <Text style={s.lead}>{cmp}</Text>}
      {year && st.monthly && (
        <Card style={{ marginTop: 26, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {st.monthly.map(m => (
              <View key={m.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View style={{ height: 96, width: '100%', justifyContent: 'flex-end' }}>
                  <View style={{ height: m.games ? Math.max(4, (m.games / mx) * 96) : 0, borderRadius: 5, backgroundColor: m.games === mx ? C.gold : 'rgba(255,214,10,0.35)' }} />
                </View>
                <Text style={{ fontSize: 10, color: m.games === mx ? C.gold : C.faint }}>{m.label.charAt(0)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
      <Card style={{ marginTop: year ? 10 : 30 }}>
        <Row label="Zmage" value={String(st.wins)} color={C.gold} />
        <Sep />
        <Row label={year ? 'Letna lestvica' : 'Lestvica sezone'} sub={st.rank ? `od ${st.rank.of} igralcev` : year ? undefined : 'premalo partij za lestvico'} value={st.rank ? `${st.rank.rank}.` : '–'} />
        <Sep />
        <Row label={year ? 'Točke v letu' : 'Točke v mesecu'} value={signed(st.points)} color={st.points >= 0 ? C.green : C.red} />
      </Card>
    </View>
  ) });

  // 3. za mizo
  const t = st.table;
  if (t.played.total + t.partner.total + t.beggar.total > 0) {
    const rows: ReactNode[] = [];
    // igra je ženskega spola (dobljena igra), berač moškega (dobljen berač)
    const wonOf = (k: { total: number; won: number }, male = false) => k.won === k.total
      ? (k.total === 1 ? (male ? 'dobljen' : 'dobljena') : male ? 'vsi dobljeni' : 'vse dobljene')
      : `${k.won} ${male ? n3(k.won, 'dobljen', 'dobljena', 'dobljeni', 'dobljenih') : n3(k.won, 'dobljena', 'dobljeni', 'dobljene', 'dobljenih')}`;
    const add = (sym: ReactNode, label: string, k: { total: number; won: number }, bar: boolean, male = false) => {
      if (!k.total) return;
      if (rows.length) rows.push(<Sep key={'s' + label} inset={56} />);
      rows.push(
        <View key={label} style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.symBox}>{sym}</View>
            <Text style={s.rowLabel}>{label}</Text>
            {bar && <Text style={s.rowSub}>{wonOf(k, male)}</Text>}
            <Text style={s.rowVal}>{k.total}</Text>
          </View>
          {bar && <View style={s.barTrack}><View style={[s.barFill, { width: `${(k.won / k.total) * 100}%`, backgroundColor: year ? C.gold : C.green }]} /></View>}
        </View>
      );
    };
    add(<SymDot />, f('Igral sam', 'Igrala sama'), t.played, true);
    add(<SymRing />, f('Klican', 'Klicana'), t.partner, true);
    add(<SymTri />, 'Berač', t.beggar, true, true);
    add(<SymValat />, 'Valat', t.valat, false);
    const note = year && t.valatDates.length
      ? `${t.valatDates.length === 1 ? 'Valat' : 'Valati'}: ${t.valatDates.map(dayShort).join(', ').replace(/, ([^,]*)$/, ' in $1')}.`
      : t.played.total >= 3 ? `Ko si ${f('igral sam', 'igrala sama')}, si ${f('dobil', 'dobila')} ${t.played.won} od ${t.played.total} iger.` : '';
    out.push({ key: 'miza', glow: year ? 'rgba(255,214,10,0.16)' : 'rgba(100,210,255,0.16)', node: (
      <View>
        <Cap t="Za mizo" color={accent} />
        <Text style={s.h2}>{`${f('Igral', 'Igrala')} si ${t.played.total + t.beggar.total}-krat,\n${f('klican', 'klicana')} ${t.partner.total}-krat.`}</Text>
        <Card style={{ marginTop: 24 }}>{rows}</Card>
        {!!note && <Text style={s.note}>{note}</Text>}
      </View>
    ) });
  }

  // 4. mesec za mesecem (samo leto)
  if (year && st.monthly) {
    const ranked = st.monthly.map((m, i) => ({ i, r: m.rank, label: m.label })).filter(p => p.r != null) as { i: number; r: number; label: string }[];
    if (ranked.length >= 2) {
      const maxR = Math.max(3, ...ranked.map(p => p.r));
      const bestP = [...ranked].sort((a, b) => a.r - b.r || b.i - a.i)[0];
      const worstP = [...ranked].sort((a, b) => b.r - a.r || b.i - a.i)[0];
      const W = 300, H = 140;
      const xy = (p: { i: number; r: number }) => ({ x: 12 + (p.i * (W - 24)) / 11, y: 14 + ((p.r - 1) / (maxR - 1)) * (H - 28) });
      out.push({ key: 'meseci', glow: 'rgba(255,214,10,0.18)', node: (
        <View>
          <Cap t="Mesec za mesecem" color={C.gold} />
          <Text style={s.h2}>{bestP.r === 1 ? `${bestP.label} si ${f('bil', 'bila')}\n${f('najboljši', 'najboljša')} od vseh.` : `Najboljši mesec:\n${bestP.label.toLowerCase()}, ${bestP.r}. mesto.`}</Text>
          <Card style={{ marginTop: 24, padding: 16, paddingBottom: 12 }}>
            <Text style={{ fontSize: 13, color: C.muted }}>Tvoje mesto na lestvici sezone</Text>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 10 }}>
              <Line x1={0} y1={14} x2={W} y2={14} stroke="rgba(255,255,255,0.06)" />
              <Line x1={0} y1={H - 14} x2={W} y2={H - 14} stroke="rgba(255,255,255,0.06)" />
              <Polyline points={ranked.map(p => { const q = xy(p); return `${q.x},${q.y}`; }).join(' ')} fill="none" stroke={C.gold} strokeWidth={2.5} strokeLinejoin="round" />
              {ranked.map(p => { const q = xy(p); return <Circle key={p.i} cx={q.x} cy={q.y} r={p.r === 1 ? 6 : 3.5} fill={p.r === 1 ? C.gold : '#000'} stroke={C.gold} strokeWidth={2} />; })}
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 6 }}>
              {st.monthly.map((m, i) => <Text key={i} style={{ fontSize: 10, color: m.rank === 1 ? C.gold : C.faint }}>{m.label.charAt(0)}</Text>)}
            </View>
          </Card>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Card style={{ flex: 1, padding: 16 }}><Text style={s.tileLabel}>Najboljši mesec</Text><Text style={[s.tileVal, { fontSize: 20, color: C.gold }]}>{bestP.label} · {bestP.r}.</Text></Card>
            {worstP.i !== bestP.i && <Card style={{ flex: 1, padding: 16 }}><Text style={s.tileLabel}>Najtežji mesec</Text><Text style={[s.tileVal, { fontSize: 20 }]}>{worstP.label} · {worstP.r}.</Text></Card>}
          </View>
        </View>
      ) });
    }
  }

  // 5. največji vpis (mesec) / najlepše v letu (leto)
  const big = st.biggest;
  const kindText = (k: string) => (k === 'valat' ? 'Valat' : k === 'berač' ? 'Berač' : k === 'klican' ? f('Kot klicani', 'Kot klicana') : 'Igra');
  if (!year && big) {
    const vals = big.series.map(p => p.v);
    const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals);
    const W = 300, H = 140;
    const pt = (i: number) => ({ x: vals.length > 1 ? (i * W) / (vals.length - 1) : W / 2, y: 8 + (1 - (vals[i] - lo) / (hi - lo || 1)) * (H - 16) });
    const line = vals.map((_, i) => { const q = pt(i); return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(' ');
    const hit = big.series.findIndex(p => p.t === big.date);
    out.push({ key: 'vpis', glow: 'rgba(255,159,10,0.18)', node: (
      <View>
        <Cap t="Tvoj največji vpis" color={C.orange} />
        <CountUp value={big.points} format={v => '+' + fmt(v)} style={[s.giant, { marginTop: 8 }]} />
        <Text style={s.kind}>{kindText(big.kind)}</Text>
        <Text style={s.lead}>{dayLong(big.date)} · {hm(big.date)}</Text>
        {vals.length >= 2 && (
          <Card style={{ marginTop: 26, padding: 16, paddingBottom: 12 }}>
            <Text style={{ fontSize: 13, color: C.muted }}>Tvoje točke tisti večer</Text>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginTop: 10 }}>
              <Defs><SvgGrad id="vpisGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.orange} stopOpacity={0.35} /><Stop offset="1" stopColor={C.orange} stopOpacity={0} /></SvgGrad></Defs>
              <Path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#vpisGrad)" />
              <Path d={line} fill="none" stroke={C.orange} strokeWidth={2.5} strokeLinejoin="round" />
              {hit >= 0 && <Circle cx={pt(hit).x} cy={pt(hit).y} r={5} fill={C.orange} stroke="#101827" strokeWidth={2} />}
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={s.axis}>{hm(big.series[0].t)}</Text>
              <Text style={s.axis}>{hm(big.series[big.series.length - 1].t)}</Text>
            </View>
          </Card>
        )}
      </View>
    ) });
  }
  if (year) {
    const items: ReactNode[] = [];
    if (big) items.push(<Hl key="v" icon={<Zap size={18} color={C.orange} />} bg="rgba(255,159,10,0.18)" title="Največji vpis" sub={`${kindText(big.kind)} · ${dayShort(big.date)}`} val={'+' + fmt(big.points)} color={C.orange} />);
    if (st.longestStreak >= 2) items.push(<Hl key="n" icon={<Flame size={18} color={C.gold} />} bg="rgba(255,214,10,0.16)" title="Najdaljši niz" sub="zmag zapored" val={`${st.longestStreak}×`} color={C.gold} />);
    if (st.partner) items.push(<Hl key="p" icon={<Users size={18} color={C.green} />} bg="rgba(48,209,88,0.16)" title="Partner leta" sub={`${st.partner.name} · ${st.partner.together} ${n3(st.partner.together, 'igra', 'igri', 'igre', 'iger')}`} val={`${Math.round((st.partner.won / st.partner.together) * 100)} %`} color={C.green} />);
    if (st.nemesis) items.push(<Hl key="m" icon={<Swords size={18} color={C.red} />} bg="rgba(255,69,58,0.16)" title="Nasprotnik leta" sub={`${st.nemesis.name} · bil${g(st.nemesis.name, '', 'a')} je pred tabo`} val={`${st.nemesis.ahead}×`} color={C.red} />);
    if (items.length) out.push({ key: 'najlepse', glow: 'rgba(255,214,10,0.18)', node: (
      <View>
        <Cap t="Najlepše v letu" color={C.gold} />
        <Text style={s.h2}>{'Trenutki,\nki so ostali.'}</Text>
        <View style={{ gap: 10, marginTop: 24 }}>{items}</View>
      </View>
    ) });
  }

  // 6. večer meseca / leta
  const bg = st.bestGame;
  if (bg) {
    out.push({ key: 'vecer', glow: 'rgba(255,214,10,0.12)', node: (
      <View>
        <Cap t={year ? 'Večer leta' : 'Tvoj večer meseca'} color={accent} />
        <Text style={[s.lead, { marginTop: 14 }]}>{dayLong(bg.date)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 4 }}>
          <Text style={[s.place, bg.rank === 1 && { color: C.gold }]}>{bg.rank}.</Text>
          <Text style={[s.vecerPts, { color: bg.score >= 0 ? C.green : C.red }]}>{signed(bg.score)}</Text>
        </View>
        <Text style={s.small}>mesto · točk tisti večer</Text>
        {!!bg.moment && (
          <>
            <View style={s.hr} />
            <Text style={s.momentLabel}>MOMENT VEČERA</Text>
            <Text style={s.moment}>{bg.moment}</Text>
          </>
        )}
        <View style={{ flexDirection: 'row', gap: 28, marginTop: 28 }}>
          <View><Text style={s.statVal}>{bg.rounds}</Text><Text style={s.small}>{n3(bg.rounds, 'igra', 'igri', 'igre', 'iger')}</Text></View>
          {bg.durationMin > 0 && <View><Text style={s.statVal}>{durText(bg.durationMin)}</Text><Text style={s.small}>za mizo</Text></View>}
          <View><Text style={s.statVal}>{bg.players}</Text><Text style={s.small}>{n3(bg.players, 'igralec', 'igralca', 'igralci', 'igralcev')}</Text></View>
        </View>
      </View>
    ) });
  }

  // 7. tvoja miza (samo mesec; pri letu sta partner in nasprotnik med najlepšimi)
  if (!year && (st.partner || st.nemesis)) {
    const same = !!(st.partner && st.nemesis && st.partner.name === st.nemesis.name);
    out.push({ key: 'partner', glow: 'rgba(48,209,88,0.14)', node: (
      <View>
        <Cap t="Tvoja miza" />
        <Text style={s.h2}>{same ? `${st.partner!.name}:\n${g(st.partner!.name, 'najboljši partner', 'najboljša partnerka')}\nin hkrati nasprotni${g(st.partner!.name, 'k', 'ca')}.` : 'S kom ti gre\nin s kom ne.'}</Text>
        <View style={{ height: 12 }} />
        {st.partner && <Person name={st.partner.name} pct={st.partner.won / st.partner.together} color={C.green} label={g(st.partner.name, 'Najboljši partner', 'Najboljša partnerka')} line={`${st.partner.won} od ${st.partner.together} skupnih iger dobljenih`} />}
        {st.nemesis && <Person name={st.nemesis.name} pct={st.nemesis.ahead / st.nemesis.shared} color={C.red} label={g(st.nemesis.name, 'Najtrši nasprotnik', 'Najtrša nasprotnica')} line={`Bil${g(st.nemesis.name, '', 'a')} je pred tabo v ${st.nemesis.ahead} od ${st.nemesis.shared} partij`} />}
      </View>
    ) });
  }

  // 8. naslov
  if (st.title) {
    out.push({ key: 'naslov', glow: year ? 'rgba(255,214,10,0.18)' : 'rgba(191,90,242,0.20)', node: (
      <View>
        <Cap t={year ? 'Tvoj naslov leta' : 'Tvoj naslov'} color={year ? C.gold : C.purple} />
        <Text style={[s.lead, { marginTop: 14 }]}>{year ? 'To leto si' : 'Ta mesec si'} {f('bil', 'bila')}</Text>
        <Text style={s.titleBig}>{st.title.text}</Text>
        <Text style={[s.note, { marginTop: 18 }]}>{st.title.why}</Text>
      </View>
    ) });
  }

  // 9. povzetek
  out.push({ key: 'povzetek', glow: year ? 'rgba(255,214,10,0.18)' : 'rgba(10,132,255,0.22)', node: (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Ring name={n} size={96} colors={year ? GOLD_RING : BLUE_RING} />
        <Text style={s.sumName}>{n}</Text>
        <Text style={s.lead}>{st.label}{st.title ? ` · ${st.title.text}` : ''}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 26 }}>
        <Tile label="Igre" value={String(st.games)} />
        <Tile label="Zmage" value={String(st.wins)} color={C.gold} />
        {big && <Tile label="Največji vpis" value={'+' + fmt(big.points)} color={C.orange} />}
        <Tile label={year ? 'Letna lestvica' : 'Lestvica sezone'} value={st.rank ? `${st.rank.rank}. mesto` : '–'} />
      </View>
      {st.partner && (
        <Card style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: getAvatarUrl(st.partner.name) }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C1C1E' }} />
          <Text style={{ flex: 1, fontSize: 15, color: C.text }}>{g(st.partner.name, 'Najboljši partner', 'Najboljša partnerka')}</Text>
          <Text style={{ fontSize: 15, color: C.muted }}>{st.partner.name}</Text>
        </Card>
      )}
      <Text style={[s.note, { textAlign: 'center', marginTop: 26 }]}>{year ? `Srečno v letu ${Number(st.period) + 1}.` : 'Se vidimo za mizo.'}</Text>
    </View>
  ) });

  return out;
}

// --- okno ------------------------------------------------------------
type Props = { name: string; periods: string[]; start: number; onClose: () => void; onSeen?: (period: string) => void };

export default function StoryViewer({ name, periods, start, onClose, onSeen }: Props) {
  const insets = useSafeAreaInsets();
  const [pIndex, setPIndex] = useState(start);
  const [story, setStory] = useState<Story | null>(null);
  const [step, setStep] = useState(0);
  const [width, setWidth] = useState(390);
  const progress = useRef(new Animated.Value(0)).current;
  const paused = useRef(false);
  const press = useRef<{ t: number; x: number; y: number } | null>(null);
  const period = periods[pIndex];

  // izračun zgodbe za trenutno obdobje (iz skupnega pomnilnika podatkov)
  useEffect(() => {
    let cancelled = false;
    setStory(null);
    setStep(0);
    (async () => {
      const d = await getData();
      if (cancelled) return;
      setStory(computeStory(d as any, name, period));
      markSeen(name, period).then(() => onSeen?.(period));
    })();
    return () => { cancelled = true; };
  }, [name, period]);

  const screens = useMemo(() => (story ? buildScreens(story) : []), [story]);

  const goNext = () => {
    if (step < screens.length - 1) setStep(step + 1);
    else if (pIndex < periods.length - 1) setPIndex(pIndex + 1);
    else onClose();
  };
  const goPrev = () => {
    if (step > 0) setStep(step - 1);
    else if (pIndex > 0) setPIndex(pIndex - 1);
    else run(0);
  };
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  // časovnik zaslona (6 s)
  const run = (from: number) => {
    progress.setValue(from);
    Animated.timing(progress, { toValue: 1, duration: SCREEN_MS * (1 - from), useNativeDriver: false })
      .start(({ finished }) => { if (finished && !paused.current) goNextRef.current(); });
  };
  useEffect(() => {
    if (!screens.length) return;
    paused.current = false;
    run(0);
    return () => progress.stopAnimation();
  }, [step, screens]);

  // dotik: kratek tap = naprej/nazaj, pridržanje = pavza, poteg navzdol = zapri
  const xy = (e: any) => {
    const ne = e?.nativeEvent || {};
    const tch = ne.touches?.[0] || ne.changedTouches?.[0];
    return { x: tch?.pageX ?? ne.pageX ?? 0, y: tch?.pageY ?? ne.pageY ?? 0 };
  };
  const onIn = (e: any) => {
    press.current = { t: Date.now(), ...xy(e) };
    paused.current = true;
    progress.stopAnimation();
  };
  const onOut = (e: any) => {
    const p = press.current;
    press.current = null;
    paused.current = false;
    if (!p) return;
    const q = xy(e);
    const dy = q.y - p.y;
    const held = Date.now() - p.t;
    if (dy > 80) { onClose(); return; }
    if (held < 300 && Math.abs(dy) < 20) { if (p.x < width / 3) goPrev(); else goNext(); return; }
    progress.stopAnimation(v => run(v));
  };

  const scr = screens[step];
  const year = period?.length === 4;
  const last = step === screens.length - 1 && pIndex === periods.length - 1;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={s.root} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {scr && <LinearGradient colors={[scr.glow, 'rgba(0,0,0,0)']} start={{ x: 0.2, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={StyleSheet.absoluteFill} />}
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={onIn}
          onResponderRelease={onOut}
          onResponderTerminate={onOut}
        />
        <View pointerEvents="box-none" style={{ paddingTop: Math.max(insets.top, 44) + 12, paddingHorizontal: 24 }}>
          <View pointerEvents="none" style={s.bars}>
            {screens.map((_, i) => (
              <View key={i} style={s.barBg}>
                {i < step && <View style={[s.barOn, { width: '100%' }]} />}
                {i === step && <Animated.View style={[s.barOn, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />}
              </View>
            ))}
          </View>
          <View pointerEvents="box-none" style={s.head}>
            <Text style={s.headLabel}>{story?.label || ''}</Text>
            <TouchableOpacity onPress={onClose} style={s.close} hitSlop={12} accessibilityLabel="Zapri">
              <X size={14} color="#EBEBF5" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
        </View>
        <View pointerEvents="none" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 70 }}>
          {!story ? <ActivityIndicator color={year ? C.gold : C.blue} style={{ marginTop: 120 }} /> : <View key={`${period}-${scr?.key}`}>{scr?.node}</View>}
        </View>
        <Text pointerEvents="none" style={[s.foot, { paddingBottom: insets.bottom + 24 }]}>{last ? 'Tapni za zaključek' : 'Tapni za naprej'}</Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bars: { flexDirection: 'row', gap: 4 },
  barBg: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  barOn: { height: 2.5, backgroundColor: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  headLabel: { fontSize: 13, fontWeight: '600', color: C.muted },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(118,118,128,0.24)', alignItems: 'center', justifyContent: 'center' },
  cap: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  hero: { fontSize: 44, lineHeight: 50, fontWeight: '700', letterSpacing: -1, color: C.text, marginTop: 8 },
  h2: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5, color: C.text, marginTop: 6 },
  giant: { fontSize: 96, lineHeight: 104, fontWeight: '700', letterSpacing: -4, color: C.text },
  giantUnit: { fontSize: 24, fontWeight: '500', color: C.muted },
  lead: { fontSize: 17, color: C.muted, marginTop: 4 },
  kind: { fontSize: 22, fontWeight: '600', color: C.text, marginTop: 2 },
  note: { fontSize: 15, color: C.muted, marginTop: 16, fontStyle: 'italic' },
  card: { backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.cardBorder, borderRadius: 22 },
  symBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 16, color: C.text },
  rowSub: { fontSize: 13, color: C.muted, marginRight: 8 },
  rowVal: { fontSize: 22, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 8 },
  barFill: { height: 4, borderRadius: 2 },
  axis: { fontSize: 11, color: C.faint },
  tileLabel: { fontSize: 13, color: C.muted },
  tileVal: { fontSize: 28, fontWeight: '700', color: C.text, marginTop: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hlSub: { fontSize: 16, fontWeight: '600', color: C.text },
  hlVal: { fontSize: 22, fontWeight: '700' },
  place: { fontSize: 72, lineHeight: 78, fontWeight: '700', letterSpacing: -3, color: C.text },
  vecerPts: { fontSize: 28, fontWeight: '600' },
  small: { fontSize: 13, color: C.muted },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 26, marginBottom: 18 },
  momentLabel: { fontSize: 12, fontWeight: '600', color: C.faint, letterSpacing: 0.4, marginBottom: 6 },
  moment: { fontSize: 19, lineHeight: 28, fontStyle: 'italic', color: '#EBEBF5' },
  statVal: { fontSize: 22, fontWeight: '600', color: C.text },
  titleBig: { fontSize: 46, lineHeight: 52, fontWeight: '700', letterSpacing: -1, color: C.text, marginTop: 4 },
  sumName: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: C.text, marginTop: 14 },
  foot: { textAlign: 'center', fontSize: 12, color: '#48484A' },
});
