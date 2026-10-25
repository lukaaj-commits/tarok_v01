// Dvoboj: primerjava dveh igralcev (odpre se iz profila igralca)
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { fetchAllData, AllData } from '@/lib/playerStats';
import { computeDuel } from '@/lib/duel';
import { getAvatarUrl } from '@/lib/avatars';
import { g } from '@/lib/gender';
import { ArrowRight } from 'lucide-react-native';

const C = { card: '#121A2B', inner: 'rgba(0,0,0,0.30)', primary: '#0A84FF', text: '#FFFFFF', muted: '#8E8E93', a: '#0A84FF', b: '#FF9F0A', success: '#30D158' };

type Props = { playerA: string; onClose: () => void };

// začetnice (npr. "Luka Š" -> "LŠ")
const initials = (n: string) => n.split(' ').map(x => x[0]).join('').slice(0, 2);

export default function DuelModal({ playerA, onClose }: Props) {
  const [data, setData] = useState<AllData | null>(null);
  const [playerB, setPlayerB] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllData().then(d => { if (!cancelled) setData(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // nasprotniki, s katerimi je A igral (največ skupnih iger najprej)
  const opponents = useMemo(() => {
    if (!data) return [];
    const myGames = new Set(data.players.filter(p => p.name === playerA).map(p => p.game_id));
    const cnt: Record<string, number> = {};
    data.players.forEach(p => { if (p.name !== playerA && myGames.has(p.game_id)) cnt[p.name] = (cnt[p.name] || 0) + 1; });
    return Object.entries(cnt).sort((x, y) => y[1] - x[1]);
  }, [data, playerA]);

  const duel = useMemo(() => (data && playerB ? computeDuel(playerA, playerB, data.games, data.players, data.entries) : null), [data, playerA, playerB]);
  const sA = data?.stats.find(s => s.name === playerA);
  const sB = playerB ? data?.stats.find(s => s.name === playerB) : undefined;

  // primerjalne vrstice: [oznaka, vrednost A, vrednost B, prikaz, ali je več boljše]
  const rows: { label: string; a: number; b: number; show: (v: number) => string; higherBetter: boolean | null }[] = sA && sB ? [
    { label: 'Odigranih iger', a: sA.total_games, b: sB.total_games, show: v => `${v}`, higherBetter: null },
    { label: 'Zmage', a: sA.wins, b: sB.wins, show: v => `${v}`, higherBetter: true },
    { label: 'Povprečje na igro', a: sA.total_score_sum / sA.total_games, b: sB.total_score_sum / sB.total_games, show: v => v.toFixed(0), higherBetter: true },
    { label: 'Indeks %', a: sA.avg_performance, b: sB.avg_performance, show: v => `${Math.round(v)} %`, higherBetter: true },
    { label: 'Stopničke', a: (sA.wins + sA.second + sA.third) / sA.total_games * 100, b: (sB.wins + sB.second + sB.third) / sB.total_games * 100, show: v => `${Math.round(v)} %`, higherBetter: true },
    { label: 'Najdaljši niz zmag', a: sA.longest_win_streak, b: sB.longest_win_streak, show: v => `${v}`, higherBetter: true },
    { label: 'Valati', a: sA.valat_count, b: sB.valat_count, show: v => `${v}`, higherBetter: true },
    { label: 'Dobljeni berači', a: sA.beggar_wins, b: sB.beggar_wins, show: v => `${v}`, higherBetter: true },
    { label: 'Igralec meseca', a: (sA.month_titles || []).length, b: (sB.month_titles || []).length, show: v => `${v}`, higherBetter: true },
    { label: 'Najboljša igra', a: sA.best_game?.score ?? 0, b: sB.best_game?.score ?? 0, show: v => (v > 0 ? `+${v}` : `${v}`), higherBetter: true },
  ] : [];

  const pct = (won: number, all: number) => (all ? Math.round((won / all) * 100) : 0);
  const dateSl = (iso: string) => new Date(iso).toLocaleDateString('sl-SI');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Dvoboj</Text>

          {!data ? (
            <ActivityIndicator size="large" color={C.primary} style={{ flex: 1 }} />
          ) : !playerB || !duel ? (
            // izbira nasprotnika
            <>
              <Text style={styles.pickTitle}>Primerjaj <Text style={{ color: C.text, fontWeight: '600' }}>{playerA}</Text> z:</Text>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {opponents.map(([name, n]) => (
                  <TouchableOpacity key={name} style={styles.pickRow} onPress={() => setPlayerB(name)} activeOpacity={0.7}>
                    <Image source={{ uri: getAvatarUrl(name) }} style={styles.pickAvatar} />
                    <Text style={styles.pickName}>{name}</Text>
                    <Text style={styles.pickSub}>{n} skupnih iger</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* glava: A proti B */}
              <View style={styles.vsRow}>
                <View style={styles.vsSide}>
                  <Image source={{ uri: getAvatarUrl(playerA) }} style={[styles.vsAvatar, { borderColor: C.a }]} />
                  <Text style={styles.vsName} numberOfLines={1}>{playerA}</Text>
                </View>
                <Text style={styles.vs}>VS</Text>
                <TouchableOpacity style={styles.vsSide} onPress={() => setPlayerB(null)} activeOpacity={0.7}>
                  <Image source={{ uri: getAvatarUrl(playerB) }} style={[styles.vsAvatar, { borderColor: C.b }]} />
                  <Text style={styles.vsName} numberOfLines={1}>{playerB}</Text>
                  <Text style={styles.change}>zamenjaj</Text>
                </TouchableOpacity>
              </View>

              {/* medsebojni izkupiček */}
              <View style={styles.box}>
                <Text style={styles.boxTitle}>Medsebojno ({duel.common} skupnih iger)</Text>
                <View style={styles.h2hRow}>
                  <Text style={[styles.h2hNum, { color: C.a }]}>{duel.aAhead}</Text>
                  <Text style={styles.h2hDash}>:</Text>
                  <Text style={[styles.h2hNum, { color: C.b }]}>{duel.bAhead}</Text>
                </View>
                {duel.common > 0 && (
                  <View style={styles.bar}>
                    <View style={{ flex: Math.max(duel.aAhead, 0.01), backgroundColor: C.a }} />
                    {duel.ties > 0 && <View style={{ flex: duel.ties, backgroundColor: '#64748b' }} />}
                    <View style={{ flex: Math.max(duel.bAhead, 0.01), backgroundColor: C.b }} />
                  </View>
                )}
                <Text style={styles.boxSub}>kolikokrat je bil kdo v skupni igri višje{duel.ties ? ` · izenačeno ${duel.ties}` : ''}</Text>
                {duel.biggest && (
                  <Text style={[styles.boxSub, { marginTop: 6 }]}>
                    Največja razlika: <Text style={{ color: C.text, fontWeight: '700' }}>{duel.biggest.winner === 'A' ? playerA : playerB} +{duel.biggest.diff}</Text> ({dateSl(duel.biggest.date)})
                  </Text>
                )}
              </View>

              {/* primerjava številk */}
              <View style={styles.box}>
                {rows.map(r => {
                  const aBetter = r.higherBetter !== null && r.a > r.b;
                  const bBetter = r.higherBetter !== null && r.b > r.a;
                  return (
                    <View key={r.label} style={styles.cmpRow}>
                      <Text style={[styles.cmpVal, { textAlign: 'left' }, aBetter ? { color: C.a, fontWeight: '600' } : null]}>{r.show(r.a)}</Text>
                      <Text style={styles.cmpLabel}>{r.label}</Text>
                      <Text style={[styles.cmpVal, { textAlign: 'right' }, bBetter ? { color: C.b, fontWeight: '600' } : null]}>{r.show(r.b)}</Text>
                    </View>
                  );
                })}
              </View>

              {/* kot partnerja */}
              <View style={styles.box}>
                <Text style={styles.boxTitle}>Kot partnerja</Text>
                <Text style={[styles.boxSub, { marginBottom: 10 }]}>Ko eden igra in kliče drugega</Text>
                {[
                  { decl: playerA, part: playerB, n: duel.partner.aCallsB, won: duel.partner.aCallsBWon, all: duel.partner.aPlayed, allWon: duel.partner.aPlayedWon, cDecl: C.a, cPart: C.b },
                  { decl: playerB, part: playerA, n: duel.partner.bCallsA, won: duel.partner.bCallsAWon, all: duel.partner.bPlayed, allWon: duel.partner.bPlayedWon, cDecl: C.b, cPart: C.a },
                ].map(x => {
                  const p = pct(x.won, x.n), usual = pct(x.allWon, x.all);
                  return (
                    <View key={x.decl} style={styles.pairCard}>
                      <View style={styles.pairHead}>
                        <View style={styles.pairPerson}>
                          <Image source={{ uri: getAvatarUrl(x.decl) }} style={[styles.pairAvatar, { borderColor: x.cDecl }]} />
                          <Text style={styles.pairName} numberOfLines={1}>{x.decl}</Text>
                          <Text style={styles.pairRole}>igra</Text>
                        </View>
                        <ArrowRight size={20} color={C.muted} />
                        <View style={styles.pairPerson}>
                          <Image source={{ uri: getAvatarUrl(x.part) }} style={[styles.pairAvatar, { borderColor: x.cPart }]} />
                          <Text style={styles.pairName} numberOfLines={1}>{x.part}</Text>
                          <Text style={styles.pairRole}>{g(x.part, 'klican', 'klicana')}</Text>
                        </View>
                      </View>
                      {x.n === 0 ? (
                        <Text style={styles.boxSub}>Še nista igrala skupaj na ta način.</Text>
                      ) : (
                        <>
                          <View style={styles.pairStats}>
                            <View style={styles.pairStat}><Text style={styles.pairNum}>{x.n}</Text><Text style={styles.pairLbl}>skupaj</Text></View>
                            <View style={styles.pairStat}><Text style={[styles.pairNum, { color: C.success }]}>{x.won}</Text><Text style={styles.pairLbl}>dobljenih</Text></View>
                            <View style={styles.pairStat}><Text style={[styles.pairNum, { color: '#FF453A' }]}>{x.n - x.won}</Text><Text style={styles.pairLbl}>izgubljenih</Text></View>
                            <View style={styles.pairStat}><Text style={[styles.pairNum, { color: C.text }]}>{p} %</Text><Text style={styles.pairLbl}>uspešnost</Text></View>
                          </View>
                          <View style={styles.pairBar}>
                            <View style={{ flex: Math.max(x.won, 0.01), backgroundColor: C.success }} />
                            <View style={{ flex: Math.max(x.n - x.won, 0.01), backgroundColor: '#FF453A' }} />
                          </View>
                          {x.all > 0 && (
                            <Text style={styles.pairCompare} numberOfLines={1} adjustsFontSizeToFit>
                              {x.decl} sicer dobi {usual} % svojih iger{' '}
                              <Text style={{ color: p > usual ? C.success : p < usual ? '#FF453A' : C.muted, fontWeight: '600' }}>
                                {p > usual ? `▲ +${p - usual} %` : p < usual ? `▼ −${usual - p} %` : '= enako'}
                              </Text>
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Zapri</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, height: '90%', borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  title: { color: C.text, fontSize: 21, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  pickTitle: { color: C.muted, fontSize: 15, marginBottom: 10, textAlign: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  pickAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)' },
  pickName: { color: C.text, fontSize: 16, fontWeight: '500', flex: 1 },
  pickSub: { color: C.muted, fontSize: 12 },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingHorizontal: 8 },
  vsSide: { alignItems: 'center', width: '40%' },
  vsAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.10)' },
  vsName: { color: C.text, fontSize: 16, fontWeight: '600' },
  vs: { color: '#636366', fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  change: { color: C.primary, fontSize: 12, marginTop: 1 },
  box: { backgroundColor: C.inner, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  boxTitle: { color: C.muted, fontSize: 13, fontWeight: '400', marginBottom: 8, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  boxSub: { color: C.muted, fontSize: 12, textAlign: 'center' },
  h2hRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  h2hNum: { fontSize: 40, fontWeight: '600' },
  h2hDash: { color: '#636366', fontSize: 28, fontWeight: '500' },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 8 },
  lastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  chip: { minWidth: 26, height: 26, paddingHorizontal: 4, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cmpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  cmpVal: { color: C.muted, fontSize: 15, fontWeight: '500', width: 70 },
  cmpLabel: { color: C.muted, fontSize: 13, flex: 1, textAlign: 'center' },
  partnerLine: { color: C.muted, fontSize: 13, textAlign: 'center' },
  partnerStrong: { color: C.text, fontWeight: '600', fontSize: 16, marginTop: 2 },
  pairCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  pairHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 },
  pairPerson: { alignItems: 'center', width: 90 },
  pairAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.10)' },
  pairName: { color: C.text, fontSize: 14, fontWeight: '600' },
  pairRole: { color: C.muted, fontSize: 11 },
  pairArrow: { color: C.muted, fontSize: 22 },
  pairStats: { flexDirection: 'row', justifyContent: 'space-between' },
  pairStat: { alignItems: 'center', flex: 1 },
  pairNum: { color: C.text, fontSize: 19, fontWeight: '600' },
  pairLbl: { color: C.muted, fontSize: 10, marginTop: 2 },
  pairBar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  pairCompare: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  closeButton: { backgroundColor: C.primary, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
