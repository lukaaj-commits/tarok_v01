// Okno "Sezona": mesečna lestvica, igralec meseca in prvaki vseh mesecev
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight, Trophy, Info } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { computeSeasons, SeasonMonth, SEASON } from '@/lib/season';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import { g } from '@/lib/gender';

const C = {
  card: '#1e293b',
  inner: '#334155',
  primary: '#556eeb',
  text: '#FFFFFF',
  muted: '#94A3B8',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  success: '#10B981',
};

type Props = { visible: boolean; onClose: () => void };

// širini stolpcev (enaki v legendi in vrsticah)
const PLACES_WIDTH = 104;
const POINTS_WIDTH = 50;

export default function SeasonModal({ visible, onClose }: Props) {
  const { openProfile } = usePlayerProfile();
  const [months, setMonths] = useState<SeasonMonth[]>([]);
  const [index, setIndex] = useState(0); // 0 = najnovejši (tekoči) mesec
  const [loading, setLoading] = useState(false);
  const [showAllChampions, setShowAllChampions] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ob menjavi meseca skoči na vrh
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [index]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [g, p] = await Promise.all([
          supabase.from('games').select('id, created_at'),
          supabase.from('players').select('game_id, name, total_score'),
        ]);
        if (!cancelled && !g.error && !p.error) {
          setMonths(computeSeasons(g.data || [], p.data || []));
          setIndex(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const month = months[index];
  const pastChampions = months.filter(m => m.champions.length > 0);
  const medalColor = (rank: number) => (rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>📅 Sezona</Text>

          {loading || !month ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40, flex: 1 }} />
          ) : (
            <>
              {/* izbira meseca */}
              <View style={styles.monthRow}>
                <TouchableOpacity disabled={index >= months.length - 1} onPress={() => setIndex(i => i + 1)} style={styles.arrow}>
                  <ChevronLeft size={28} color={index >= months.length - 1 ? '#475569' : C.text} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.monthLabel}>{month.label.toUpperCase()}</Text>
                  <Text style={styles.monthSub}>
                    {month.isCurrent ? '● v teku · ' : ''}{month.gameCount} {month.gameCount === 1 ? 'igra' : month.gameCount === 2 ? 'igri' : month.gameCount <= 4 ? 'igre' : 'iger'}
                  </Text>
                </View>
                <TouchableOpacity disabled={index === 0} onPress={() => setIndex(i => i - 1)} style={styles.arrow}>
                  <ChevronRight size={28} color={index === 0 ? '#475569' : C.text} />
                </TouchableOpacity>
              </View>

              {month.standings.length > 0 && (
                <View style={styles.legend}>
                  <Text style={[styles.legendText, { flex: 1, paddingLeft: 12 }]}>Igralec</Text>
                  <Text style={[styles.legendText, { width: PLACES_WIDTH, textAlign: 'center', marginRight: -4 }]}>Uvrstitve</Text>
                  <Text numberOfLines={1} style={[styles.legendText, { width: POINTS_WIDTH, textAlign: 'right' }]}>Točke</Text>
                </View>
              )}

              <ScrollView key={month.key} ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* lestvica meseca */}
                {month.standings.length === 0 ? (
                  <Text style={styles.empty}>V tem mesecu še ni odigranih iger.</Text>
                ) : (
                  month.standings.map(r => {
                    const mc = r.eligible ? medalColor(r.rank) : null;
                    const isChampion = !month.isCurrent && month.champions.includes(r.name);
                    return (
                      <TouchableOpacity key={r.name} onPress={() => openProfile(r.name)} activeOpacity={0.7} style={[styles.rowOuter, isChampion && styles.championRow, !r.eligible && { opacity: 0.45 }]}>
                        {isChampion && <Text style={styles.championTag}>🏆  {g(r.name, 'IGRALEC', 'IGRALKA')} MESECA</Text>}
                        <View style={styles.rowInner}>
                        <View style={styles.rankBox}>
                          {mc ? <Trophy size={20} color={mc} /> : <Text style={styles.rankText}>{r.eligible ? `${r.rank}.` : '–'}</Text>}
                        </View>
                        <Image source={{ uri: getAvatarUrl(r.name) }} style={[styles.avatar, isChampion && styles.championAvatar]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                                                    <Text style={styles.sub}>{r.games} {r.games === 1 ? 'igra' : r.games === 2 ? 'igri' : r.games <= 4 ? 'igre' : 'iger'}{!r.eligible ? ' · premalo iger' : ''}</Text>
                        </View>
                        <View style={styles.places}>
                          <View style={styles.medal}><Trophy size={13} color={C.gold} /><Text style={styles.medalText}>{r.wins}</Text></View>
                          <View style={styles.medal}><Trophy size={13} color={C.silver} /><Text style={styles.medalText}>{r.second}</Text></View>
                          <View style={styles.medal}><Trophy size={13} color={C.bronze} /><Text style={styles.medalText}>{r.third}</Text></View>
                        </View>
                        <Text style={styles.points}>{r.points}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* prvaki vseh mesecev */}
                {pastChampions.length > 0 && (
                  <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>🏅 Prvaki mesecev</Text>
                      {pastChampions.length > 3 && (
                        <TouchableOpacity onPress={() => setShowAllChampions(v => !v)}>
                          <Text style={styles.showAll}>{showAllChampions ? 'Pokaži manj' : `Pokaži vse (${pastChampions.length})`}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {(showAllChampions ? pastChampions : pastChampions.slice(0, 3)).map(m => (
                      <TouchableOpacity key={m.key} onPress={() => setIndex(months.indexOf(m))} activeOpacity={0.7} style={styles.champRow}>
                        <Text style={styles.champMonth}>{m.label}</Text>
                        <Text style={styles.champNames}>{m.champions.join(' & ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* pravila */}
                <View style={styles.infoBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Info size={16} color={C.muted} />
                    <Text style={styles.infoTitle}>Info</Text>
                  </View>
                  <Text style={styles.infoLine}>1. mesto  <Text style={styles.infoPts}>{SEASON.placePoints[0]} točk</Text></Text>
                  <Text style={styles.infoLine}>2. mesto  <Text style={styles.infoPts}>{SEASON.placePoints[1]} točk</Text></Text>
                  <Text style={styles.infoLine}>3. mesto  <Text style={styles.infoPts}>{SEASON.placePoints[2]} točke</Text></Text>
                  <Text style={[styles.infoLine, { marginTop: 8 }]}>Šteje <Text style={styles.infoPts}>najboljših {SEASON.bestGames} iger</Text> v mesecu. Za naslov je treba odigrati vsaj {SEASON.minGames} igre.</Text>
                  <Text style={[styles.infoLine, { marginTop: 4 }]}>Pri enakem številu točk odloči več zmag, nato več 2. in 3. mest, nato višji indeks %.</Text>
                </View>
              </ScrollView>
            </>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '88%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)' },
  title: { color: C.text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  arrow: { padding: 6 },
  monthLabel: { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  monthSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  championRow: { paddingVertical: 16, borderColor: 'rgba(255,215,0,0.6)', borderWidth: 1.5, backgroundColor: 'rgba(255,215,0,0.07)' },
  championTag: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginBottom: 10 },
  championCard: { backgroundColor: C.inner, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)' },
  championLabel: { color: C.gold, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  championAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.gold },
  championName: { color: C.text, fontSize: 24, fontWeight: '800' },
  championSub: { color: C.success, fontSize: 15, fontWeight: '700', marginTop: 2 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 30 },
  rowOuter: { backgroundColor: C.inner, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBox: { width: 26, alignItems: 'center' },
  rankText: { color: C.text, fontSize: 16, fontWeight: '700' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)' },
  name: { color: C.text, fontSize: 16, fontWeight: '600' },
  sub: { color: C.muted, fontSize: 11 },
  places: { width: PLACES_WIDTH, flexDirection: 'row', justifyContent: 'space-between' },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  medalText: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 14 },
  points: { color: C.text, fontSize: 22, fontWeight: '800', width: POINTS_WIDTH - 12, textAlign: 'right' },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingRight: 12 },
  legendText: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  showAll: { color: C.primary, fontSize: 14, fontWeight: '600' },
  section: { marginTop: 18 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  champRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  champMonth: { color: C.muted, fontSize: 14 },
  champNames: { color: C.text, fontSize: 14, fontWeight: '700' },
  infoBox: { marginTop: 18, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 14 },
  infoTitle: { color: C.muted, fontSize: 14, fontWeight: '700' },
  infoLine: { color: C.muted, fontSize: 14, lineHeight: 20 },
  infoPts: { color: C.text, fontWeight: '700' },
  closeButton: { backgroundColor: '#5863ea', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
