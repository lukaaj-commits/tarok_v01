// Dodatki v profilu igralca:
//  - MonthRankRow: "Oktober · 31 točk · 6. mesto ›" (tekoči mesec, enako kot v Sezoni; tap odpre Sezono)
//  - TableStats: "Za mizo" za vse igre (igral, klican, berač) z uspešnostjo
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { ChevronRight, Triangle, CalendarDays } from 'lucide-react-native';
import TintBg from '@/components/TintBg';
import { getData } from '@/lib/dataCache';
import { computeSeasons, SEASON, MONTH_NAMES } from '@/lib/season';
import SeasonModal from '@/components/SeasonModal';
import { g } from '@/lib/gender';

const n3 = (n: number, a: string, b: string, c: string, d: string) => { const r = n % 100; return r === 1 ? a : r === 2 ? b : r === 3 || r === 4 ? c : d; };

export function MonthRankRow({ name, style }: { name: string; style?: StyleProp<ViewStyle> }) {
  const [row, setRow] = useState<{ month: string; points: number; rank: number; eligible: boolean; games: number } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getData();
        const cur = computeSeasons(d.games, d.players).find(m => m.isCurrent);
        const r = cur?.standings.find(s => s.name === name);
        if (!cancelled) setRow(cur && r ? { month: MONTH_NAMES[cur.month], points: r.points, rank: r.rank, eligible: r.eligible, games: r.games } : null);
      } catch { if (!cancelled) setRow(null); }
    })();
    return () => { cancelled = true; };
  }, [name]);
  if (!row) return null; // ta mesec še ni igral
  const left = SEASON.minGames - row.games;
  return (
    <>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(true)} style={[styles.monthCard, style]}>
        <TintBg />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><CalendarDays size={12} color="#64D2FF" strokeWidth={2.4} /><Text style={styles.cardLabel}>{row.month} · sezona</Text></View>
          {row.eligible ? (
            <>
              <Text style={styles.cardValue}>{row.rank}. mesto</Text>
              <Text style={styles.cardSub}>{row.points} {n3(row.points, 'točka', 'točki', 'točke', 'točk')}</Text>
            </>
          ) : (
            <>
              <Text style={styles.cardValue}>še {left} {n3(left, 'igra', 'igri', 'igre', 'iger')}</Text>
              <Text style={styles.cardSub}>do lestvice meseca</Text>
            </>
          )}
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.45)" />
      </TouchableOpacity>
      {open && <SeasonModal visible onClose={() => setOpen(false)} />}
    </>
  );
}

type Counter = { total: number; won: number; rank?: number | null };
type Table = { played: Counter; partner: Counter; beggar: Counter };
// za mesto med igralci šteje, kdor ima vsaj toliko takih iger (berač je redek)
const MIN_RANK = { played: 30, partner: 30, beggar: 10 } as const;

// za mizo za vse igralce naenkrat (zaključene igre, brez kazni)
function tableAll(d: any): Map<string, Table> {
  const finished = new Set(d.games.filter((x: any) => !x.is_active).map((x: any) => x.id));
  const nameById = new Map<string, string>();
  d.players.forEach((p: any) => { if (finished.has(p.game_id)) nameById.set(p.id, p.name); });
  const all = new Map<string, Table>();
  const c = () => ({ total: 0, won: 0 });
  d.entries.forEach((e: any) => {
    const n = nameById.get(e.player_id);
    if (!n || e.is_penalty) return;
    if (!all.has(n)) all.set(n, { played: c(), partner: c(), beggar: c() });
    const t = all.get(n)!;
    const k = e.is_beggar ? t.beggar : e.is_partner ? t.partner : e.played ? t.played : null;
    if (!k) return;
    k.total++;
    if (Number(e.points) > 0) k.won++;
  });
  // mesto po uspešnosti (izenačeni imajo isto mesto)
  (['played', 'partner', 'beggar'] as const).forEach(key => {
    const rates = [...all.values()].map(t => t[key]).filter(k => k.total >= MIN_RANK[key]);
    [...all.values()].forEach(t => {
      const k = t[key];
      k.rank = k.total >= MIN_RANK[key] ? rates.filter(o => o.won / o.total > k.won / k.total).length + 1 : null;
    });
  });
  return all;
}
export function TableStats({ name }: { name: string }) {
  const [st, setSt] = useState<Table | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getData();
        const out = tableAll(d).get(name) || null;
        if (!cancelled) setSt(out && out.played.total + out.partner.total + out.beggar.total ? out : null);
      } catch { if (!cancelled) setSt(null); }
    })();
    return () => { cancelled = true; };
  }, [name]);
  if (!st) return null;

  const wonText = (k: Counter, male = false) => `${k.won} ${male ? n3(k.won, 'dobljen', 'dobljena', 'dobljeni', 'dobljenih') : n3(k.won, 'dobljena', 'dobljeni', 'dobljene', 'dobljenih')}`;
  const Row = ({ sym, label, k, male }: { sym: React.ReactNode; label: string; k: Counter; male?: boolean }) => k.total ? (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={styles.symBox}>{sym}</View>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{wonText(k, male)}</Text>
        <Text style={styles.rowVal}>{k.total}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${(k.won / k.total) * 100}%` }]} /></View>
      <Text style={styles.rate}>{Math.round((k.won / k.total) * 100)} % uspešnost{k.rank ? ` (${k.rank}. med vsemi igralci)` : ''}</Text>
    </View>
  ) : null;
  const ratio = st.played.total ? Math.round((st.played.won / st.played.total) * 10) : 0;

  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.head}><Text style={styles.title}>Za mizo</Text><Text style={styles.side}>vse igre</Text></View>
      <Row sym={<View style={styles.dot} />} label={g(name, 'Igral', 'Igrala')} k={st.played} />
      <Row sym={<View style={styles.ring} />} label={g(name, 'Klican', 'Klicana')} k={st.partner} />
      <Row sym={<Triangle size={10} color="#fff" fill="#fff" />} label="Berač" k={st.beggar} male />
      {st.played.total >= 5 && <Text style={styles.note}>Ko igraš, dobiš {ratio} od 10 iger.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 4, marginTop: 6, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)' },
  monthName: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  monthVal: { color: '#AEAEB2', fontSize: 15 },
  monthRank: { color: '#FFFFFF', fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 4 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  side: { color: '#8E8E93', fontSize: 13 },
  row: { paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  symBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(100,210,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(100,210,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  ring: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  rowLabel: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  rowSub: { color: '#8E8E93', fontSize: 12, marginRight: 8 },
  rowVal: { color: '#FFFFFF', fontSize: 19, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 8 },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#30D158' },
  rate: { color: '#8E8E93', fontSize: 11.5, marginTop: 6 },
  monthCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '600' },
  cardSub: { color: '#AEAEB2', fontSize: 11 },
  note: { color: '#8E8E93', fontSize: 12, fontStyle: 'italic', marginTop: 8, paddingHorizontal: 4 },
});
