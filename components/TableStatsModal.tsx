// Okno "Za mizo": statistika celotne družbe (odpre se s tapom na "134 odigranih iger" v Zgodovini)
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { getData } from '@/lib/dataCache';
import { computeTableStats, TableStats, fmtDate, fmtMin } from '@/lib/tableStats';
import { getAvatarUrl } from '@/lib/avatars';
import TintBg from '@/components/TintBg';
import { g } from '@/lib/gender';

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const n3 = (n: number, a: string, b: string, c: string, d: string) => { const r = n % 100; return r === 1 ? a : r === 2 ? b : r === 3 || r === 4 ? c : d; };

export default function TableStatsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [st, setSt] = useState<TableStats | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getData().then(d => { if (!cancelled) setSt(computeTableStats(d)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [visible]);

  const Mini = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
    <View style={styles.mini}>
      <Text style={styles.miniLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
  const Bars = ({ data, top, h = 96 }: { data: { label: string; n: number }[]; top: number; h?: number }) => {
    const mx = Math.max(1, ...data.map(x => x.n));
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: h }}>
          {data.map((x, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
              <Text style={[styles.barNum, i === top && styles.barOn]}>{x.n}</Text>
              <View style={{ width: '100%', height: Math.max(3, (x.n / mx) * (h - 22)), borderRadius: 6, backgroundColor: i === top ? '#0A84FF' : 'rgba(10,132,255,0.30)' }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {data.map((x, i) => <Text key={i} style={[styles.barLabel, i === top && styles.barOn]}>{x.label}</Text>)}
        </View>
      </View>
    );
  };
  const Row = ({ label, sub, value, last }: { label: string; sub: string; value: string; last?: boolean }) => (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowSub}>{sub}</Text></View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
  const Head = ({ title, side }: { title: string; side?: string }) => (
    <View style={styles.head}><Text style={styles.headTitle}>{title}</Text>{!!side && <Text style={styles.headSide}>{side}</Text>}</View>
  );

  const topIdx = (arr: { n: number }[]) => arr.reduce((b, x, i) => (x.n > arr[b].n ? i : b), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Za mizo</Text>
          {!!st?.since && <Text style={styles.since}>od {fmtDate(st.since)}</Text>}
          {!st ? (
            <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 40, flex: 1 }} />
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              {/* skupaj */}
              <View style={styles.hero}>
                <TintBg />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>ODIGRANIH IGER</Text>
                  <Text style={styles.heroValue}>{fmt(st.games)}</Text>
                  <Text style={styles.heroSub}>{fmt(st.deals)} {n3(st.deals, 'deljenje', 'deljenji', 'deljenja', 'deljenj')}</Text>
                </View>
                <View style={styles.heroSep} />
                <View style={{ flex: 1, paddingLeft: 14 }}>
                  <Text style={styles.heroLabel}>SKUPAJ IGRANO</Text>
                  <Text style={styles.heroValue}>{fmt(st.hours)} h</Text>
                  <Text style={styles.heroSub}>to je {st.days} {n3(st.days, 'dan', 'dneva', 'dni', 'dni')}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Mini label="VEČER" value={fmtMin(st.avgMin)} sub="povprečno" />
                <Mini label="NIZ DNI" value={`${st.streak} ${n3(st.streak, 'dan', 'dneva', 'dni', 'dni')}`} sub="zapored" />
                <Mini label="ZAČETEK" value={st.startHour !== null ? `${String(st.startHour).padStart(2, '0')}:00` : '–'} sub="najpogosteje" />
              </View>

              <Head title="Kdaj igramo" side={`največ ob ${st.topDay}`} />
              <Bars data={st.weekdays} top={topIdx(st.weekdays)} />

              <Head title="Po mesecih" side={st.topMonth ? `rekord: ${st.topMonth}` : undefined} />
              <Bars data={st.months} top={topIdx(st.months)} h={106} />

              <Head title="Rekordni večeri" />
              <View style={[styles.card, { paddingVertical: 2 }]}>
                {st.longest && <Row label="Najdaljši večer" sub={`${fmtDate(st.longest.date)}${st.longest.winner ? ` · ${g(st.longest.winner, 'zmagal', 'zmagala')} ${st.longest.winner}` : ''}`} value={fmtMin(st.longest.min)} />}
                {st.mostDeals && <Row label="Največ deljenj" sub={`${fmtDate(st.mostDeals.date)} · iger in klopov v enem večeru`} value={String(st.mostDeals.n)} />}
                {st.latest && <Row label="Najpoznejši konec" sub={fmtDate(st.latest.date)} value={st.latest.time} />}
                {st.shortest && <Row label="Najkrajši večer" sub={fmtDate(st.shortest.date)} value={fmtMin(st.shortest.min)} last />}
              </View>

              <Head title="Najbolj zvesti" side={`od ${st.games} ${n3(st.games, 'večera', 'večerov', 'večerov', 'večerov')}`} />
              <View style={[styles.card, { paddingVertical: 4 }]}>
                {st.loyal.map((p, i) => (
                  <View key={p.name} style={[styles.loyal, i === st.loyal.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Image source={{ uri: getAvatarUrl(p.name) }} style={styles.avatar} />
                      <Text style={styles.loyalName}>{p.name}</Text>
                      <Text style={styles.loyalPct}>{Math.round((p.n / st.games) * 100)} %</Text>
                      <Text style={styles.rowValue}>{p.n}</Text>
                    </View>
                    <View style={styles.track}><View style={[styles.fill, { width: `${(p.n / st.games) * 100}%` }]} /></View>
                  </View>
                ))}
              </View>

              {st.lineup && (
                <>
                  <Head title="Najpogostejša zasedba" />
                  <View style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', flex: 1 }}>
                        {st.lineup.names.map((n, i) => <Image key={n} source={{ uri: getAvatarUrl(n) }} style={[styles.avatar, styles.stack, i > 0 && { marginLeft: -8 }]} />)}
                      </View>
                      <Text style={styles.rowValue}>{st.lineup.n}×</Text>
                    </View>
                    <Text style={styles.lineupNames}>{st.lineup.names.slice(0, -1).join(', ')}{st.lineup.names.length > 1 ? ' in ' : ''}{st.lineup.names[st.lineup.names.length - 1]}</Text>
                  </View>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Mini label="VALATI" value={String(st.valats)} sub={`${st.valatsSolo} ${n3(st.valatsSolo, 'sam', 'sama', 'sami', 'samih')} · ${st.valats - st.valatsSolo} v paru`} />
                <Mini label="DOBLJENI BERAČI" value={String(st.beggars)} sub="vsi skupaj" />
              </View>
              <Text style={styles.note}>Čas za mizo ne šteje premorov, daljših od 1 ure, in iger, vpisanih naknadno.</Text>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Zapri</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const CARD = { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)' } as const;
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#121A2B', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 28, height: '88%', borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '600', textAlign: 'center' },
  since: { color: '#8E8E93', fontSize: 12.5, textAlign: 'center', marginTop: 2, marginBottom: 14 },
  hero: { flexDirection: 'row', borderRadius: 20, overflow: 'hidden', paddingVertical: 16, paddingHorizontal: 18, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  heroSep: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  heroValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  heroSub: { color: '#AEAEB2', fontSize: 11.5 },
  mini: { flex: 1, minWidth: 0, ...CARD, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 12, gap: 3 },
  miniLabel: { color: '#8E8E93', fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3 },
  miniValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  miniSub: { color: '#636366', fontSize: 11 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10, paddingHorizontal: 2 },
  headTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  headSide: { color: '#8E8E93', fontSize: 13 },
  card: { ...CARD, paddingVertical: 14, paddingHorizontal: 12 },
  barNum: { color: '#8E8E93', fontSize: 10.5 },
  barLabel: { flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: 10.5 },
  barOn: { color: '#FFFFFF', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  rowLabel: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '500' },
  rowSub: { color: '#8E8E93', fontSize: 11.5, marginTop: 1 },
  rowValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  loyal: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  loyalName: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  loyalPct: { color: '#8E8E93', fontSize: 12, marginRight: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1C1C1E' },
  stack: { borderWidth: 2, borderColor: '#121A2B' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8 },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#0A84FF' },
  lineupNames: { color: '#AEAEB2', fontSize: 13, marginTop: 8 },
  note: { color: '#636366', fontSize: 11.5, fontStyle: 'italic', textAlign: 'center', marginTop: 16 },
  closeButton: { backgroundColor: '#0A84FF', height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
