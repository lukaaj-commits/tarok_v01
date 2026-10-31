// Okno "Sezona": mesečna lestvica, igralec meseca in prvaki vseh mesecev
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight, Trophy, Info } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { computeSeasons, SeasonMonth, SEASON } from '@/lib/season';
import { getData } from '@/lib/dataCache';
import SwipeTabs from '@/components/SwipeTabs';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import { g } from '@/lib/gender';
import TintBg from '@/components/TintBg';
import { useMyPlayer } from '@/components/WhoAmI';
import { meRowStyle, meAvatarStyle } from '@/components/MyRow';

const C = {
  card: '#121A2B',
  inner: 'rgba(255,255,255,0.08)',
  primary: '#0A84FF',
  text: '#FFFFFF',
  muted: '#8E8E93',
  gold: '#FFD60A',
  silver: '#D1D1D6',
  bronze: '#FF9F0A',
  success: '#30D158',
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
        // podatki iz skupnega pomnilnika (prenese se samo novo)
        const d = await getData();
        if (!cancelled) {
          setMonths(computeSeasons(d.games, d.players));
          setIndex(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const month = months[index];
  // igralec tega telefona: njegova vrstica je poudarjena
  const me = useMyPlayer();
  const pastChampions = months.filter(m => m.champions.length > 0);
  const medalColor = (rank: number) => (rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : null);

  // vrstica lestvice meseca (enak izgled kot prej); tvoja vrstica je poudarjena
  const seasonRow = (r: any, lineHidden = false) => {
    if (!month) return null;
    const mc = r.eligible ? medalColor(r.rank) : null;
    const isChampion = !month.isCurrent && month.champions.includes(r.name);
    const mine = r.name === me;
    return (
      <TouchableOpacity key={r.name} onPress={() => openProfile(r.name)} activeOpacity={0.7} style={[styles.rowOuter, lineHidden && !isChampion && { borderBottomColor: 'transparent' }, isChampion && styles.championRow, mine && !isChampion && meRowStyle, !r.eligible && { opacity: 0.45 }]}>
        {isChampion && <TintBg />}
        {isChampion && <View style={styles.championTagRow}><Trophy size={13} color={C.gold} strokeWidth={2.4} /><Text style={styles.championTag}>{g(r.name, 'IGRALEC', 'IGRALKA')} MESECA</Text></View>}
        <View style={styles.rowInner}>
        <View style={styles.rankBox}>
          {mc ? <Trophy size={20} color={mc} /> : <Text style={styles.rankText}>{r.eligible ? `${r.rank}.` : '–'}</Text>}
        </View>
        <Image source={{ uri: getAvatarUrl(r.name) }} style={[styles.avatar, isChampion && styles.championAvatar, mine && meAvatarStyle]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, mine && { fontWeight: '600' }]} numberOfLines={1}>{r.name}</Text>
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
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Sezona</Text>

          {loading || !month ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40, flex: 1 }} />
          ) : (
            <>
              {/* izbira meseca */}
              <View style={styles.monthRow}>
                <TouchableOpacity disabled={index >= months.length - 1} onPress={() => setIndex(i => i + 1)} style={styles.arrow}>
                  <ChevronLeft size={22} color={index >= months.length - 1 ? '#48484A' : C.text} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.monthLabel}>{month.label.toUpperCase()}</Text>
                  <Text style={styles.monthSub}>
                    {month.isCurrent ? '● v teku · ' : ''}{month.gameCount} {month.gameCount === 1 ? 'igra' : month.gameCount === 2 ? 'igri' : month.gameCount <= 4 ? 'igre' : 'iger'}
                  </Text>
                </View>
                <TouchableOpacity disabled={index === 0} onPress={() => setIndex(i => i - 1)} style={styles.arrow}>
                  <ChevronRight size={22} color={index === 0 ? '#48484A' : C.text} />
                </TouchableOpacity>
              </View>

              {month.standings.length > 0 && (
                <View style={styles.legend}>
                  <Text style={[styles.legendText, { flex: 1, paddingLeft: 12 }]}>Igralec</Text>
                  <Text style={[styles.legendText, { width: PLACES_WIDTH, textAlign: 'center', marginRight: -4 }]}>Uvrstitve</Text>
                  <Text numberOfLines={1} style={[styles.legendText, { width: POINTS_WIDTH, textAlign: 'right' }]}>Točke</Text>
                </View>
              )}

              <SwipeTabs style={{ flex: 1 }} canPrev={index < months.length - 1} canNext={index > 0} onSwipe={d => setIndex(i => i - d)}>
              <ScrollView key={month.key} ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* lestvica meseca */}
                {month.standings.length === 0 ? (
                  <Text style={styles.empty}>V tem mesecu še ni odigranih iger.</Text>
                ) : (
                  month.standings.map((r, i, arr) => seasonRow(r, arr[i + 1]?.name === me))
                )}

                {/* prvaki vseh mesecev */}
                {pastChampions.length > 0 && (
                  <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Prvaki mesecev</Text>
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
                    <Info size={15} color={C.muted} />
                    <Text style={styles.infoTitle}>Info</Text>
                  </View>
                  <Text style={styles.infoLine}>1. mesto  <Text style={styles.infoPts}>{SEASON.placePoints[0]} točk</Text></Text>
                  <Text style={styles.infoLine}>2. mesto  <Text style={styles.infoPts}>{SEASON.placePoints[1]} točk</Text></Text>
                  <Text style={styles.infoLine}>3. mesto  <Text style={styles.infoPts}>{SEASON.placePoints[2]} točke</Text></Text>
                  <Text style={[styles.infoLine, { marginTop: 8 }]}>Šteje <Text style={styles.infoPts}>najboljših {SEASON.bestGames} iger</Text> v mesecu. Za naslov je treba odigrati vsaj {SEASON.minGames} igre.</Text>
                  <Text style={[styles.infoLine, { marginTop: 4 }]}>Pri enakem številu točk odloči več zmag, nato več 2. in 3. mest, nato višji indeks %.</Text>
                </View>
              </ScrollView>

              </SwipeTabs>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, height: '88%', borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  title: { color: C.text, fontSize: 21, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  monthLabel: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: 1.5 },
  monthSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  championRow: { borderRadius: 16, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 10, marginBottom: 4, backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)', borderBottomColor: 'rgba(255,255,255,0.12)' },
  championTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  championTag: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 1.6 },
  championCard: { backgroundColor: C.inner, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 14 },
  championLabel: { color: C.gold, fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  championAvatar: { width: 38, height: 38, borderRadius: 19 },
  championName: { color: C.text, fontSize: 24, fontWeight: '600' },
  championSub: { color: C.success, fontSize: 15, fontWeight: '600', marginTop: 2 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 30 },
  rowOuter: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBox: { width: 26, alignItems: 'center' },
  rankText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.10)' },
  name: { color: C.text, fontSize: 15, fontWeight: '500' },
  sub: { color: C.muted, fontSize: 11 },
  places: { width: PLACES_WIDTH, flexDirection: 'row', justifyContent: 'space-between' },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  medalText: { color: '#fff', fontSize: 14, fontWeight: '600', minWidth: 14 },
  points: { color: C.text, fontSize: 18, fontWeight: '600', width: POINTS_WIDTH - 12, textAlign: 'right' },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingRight: 12 },
  legendText: { color: C.muted, fontSize: 10, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' },
  showAll: { color: C.primary, fontSize: 13, fontWeight: '500' },
  section: { marginTop: 22 },
  sectionTitle: { color: C.muted, fontSize: 13, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  champRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  champMonth: { color: '#AEAEB2', fontSize: 14 },
  champNames: { color: C.text, fontSize: 15, fontWeight: '500' },
  infoBox: { marginTop: 22, paddingHorizontal: 2 },
  infoTitle: { color: C.muted, fontSize: 13, fontWeight: '500' },
  infoLine: { color: '#AEAEB2', fontSize: 13, lineHeight: 19 },
  infoPts: { color: C.text, fontWeight: '500' },
  closeButton: { backgroundColor: C.primary, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
