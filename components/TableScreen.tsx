// Mizni zaslon: velik, živ prikaz točk za telefon ali tablico sredi mize.
// Samo prikaz (nič se ne vpisuje); vrstni red po točkah, vodilni s tankim zlatim robom.
// Pokončno: vrstice; ležeče: stolpci. Zaslon med prikazom ne ugasne.
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, Animated, Easing, useWindowDimensions, StyleSheet } from 'react-native';
import { X, Triangle } from 'lucide-react-native';
import { getAvatarUrl } from '@/lib/avatars';
import { g } from '@/lib/gender';
import { AnimatedNumber } from '@/components/Motion';

type Player = { id: string; name: string; total_score: number };
export type TableCounts = Record<string, { played: number; partner: number; beggar: number }>;

const GOLD = '#E8C766';
const GAP = 12;

function useScreenWakeLock(on: boolean) {
  useEffect(() => {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (!on || !nav?.wakeLock || typeof document === 'undefined') return;
    let lock: any = null, off = false;
    const take = async () => { try { if (!off && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen'); } catch {} };
    take();
    document.addEventListener('visibilitychange', take);
    return () => { off = true; document.removeEventListener('visibilitychange', take); try { lock?.release(); } catch {} };
  }, [on]);
}

function Stats({ name, c, vertical, size, keepBeggarSpace, radelci = 0 }: { name: string; c?: { played: number; partner: number; beggar: number }; vertical: boolean; size: number; keepBeggarSpace?: boolean; radelci?: number }) {
  const played = c?.played || 0, partner = c?.partner || 0, beggar = c?.beggar || 0;
  const d = Math.round(size * 0.55);
  const txt = { color: '#8E8E93', fontSize: size };
  const item = (icon: React.ReactNode, label: string, hidden?: boolean) => (
    <View style={[s.statItem, hidden && { opacity: 0 }]}>{icon}<Text style={txt}>{label}</Text></View>
  );
  return (
    <View style={vertical ? { gap: 3 } : { flexDirection: 'row', gap: 14 }}>
      {item(<View style={{ width: d, height: d, borderRadius: d, backgroundColor: '#8E8E93' }} />, `${g(name, 'igral', 'igrala')} ${played}`)}
      {item(<View style={{ width: d, height: d, borderRadius: d, borderWidth: 1.5, borderColor: '#8E8E93' }} />, `${g(name, 'klican', 'klicana')} ${partner}`)}
      {(beggar > 0 || keepBeggarSpace) && item(<Triangle size={d + 1} color="#8E8E93" fill="#8E8E93" />, `berač ${beggar}`, beggar === 0)}
      {radelci > 0
        ? <Radelci n={radelci} size={Math.round(size * 0.85)} style={vertical ? { marginTop: 4 } : { alignSelf: 'center' }} />
        : (keepBeggarSpace && <View style={{ height: Math.round(size * 0.85), marginTop: 4 }} />)}
    </View>
  );
}

// neporabljeni radelci: prazni svetlo modri krogci (kot v aktivni igri)
function Radelci({ n, size, style }: { n: number; size: number; style?: any }) {
  if (n <= 0) return style ? <View style={style} /> : null;
  return (
    <View style={[{ flexDirection: 'row', gap: 4 }, style]}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: '#64D2FF' }} />
      ))}
    </View>
  );
}

export default function TableScreen({ visible, onClose, players, counts, radelci }: { visible: boolean; onClose: () => void; players: Player[]; counts: TableCounts; radelci: Record<string, number> }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [box, setBox] = useState({ w: 0, h: 0 });
  useScreenWakeLock(visible);

  const sorted = [...players].sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name));
  const n = Math.max(1, sorted.length);
  // velikost ene kartice
  const size = landscape ? Math.min(280, (box.w - GAP * (n - 1)) / n) : Math.min(170, (box.h - GAP * (n - 1)) / n);

  // položaj vsakega igralca se animira, ko se vrstni red zamenja
  const pos = useRef<Record<string, Animated.Value>>({});
  sorted.forEach((p, i) => { if (!pos.current[p.id]) pos.current[p.id] = new Animated.Value(i * (size + GAP)); });
  const order = sorted.map(p => p.id).join(',');
  // ob odprtju ali obratu telefona: takoj na mesto (brez animacije)
  useEffect(() => {
    sorted.forEach((p, i) => pos.current[p.id].setValue(i * (size + GAP)));
  }, [size]);
  // ob prehitevanju: mehka animacija
  useEffect(() => {
    sorted.forEach((p, i) => {
      Animated.timing(pos.current[p.id], { toValue: i * (size + GAP), duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
  }, [order]);

  // velikosti pisave glede na prostor
  const pts = landscape ? Math.max(36, Math.min(96, size * 0.36)) : Math.max(36, Math.min(60, size * 0.4));
  const nameSize = landscape ? Math.max(15, Math.min(24, size * 0.11)) : 21;
  const av = landscape ? Math.max(32, Math.min(56, size * 0.24)) : 48;
  const statSize = landscape ? Math.max(12, Math.min(16, size * 0.08)) : 13;
  const pad = landscape ? Math.max(10, Math.min(16, size * 0.07)) : 18;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <View style={s.root}>
        <View
          style={landscape ? s.areaLand : s.areaPort}
          onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; setBox({ w, h }); }}
        >
          {box.w > 0 && sorted.map((p, i) => {
            const lead = i === 0 && sorted.length > 1;
            const anim = pos.current[p.id];
            const place = landscape
              ? { left: anim, top: 0, width: size, height: box.h }
              : { top: anim, left: 0, width: box.w, height: size };
            return (
              <Animated.View key={p.id} style={[s.card, place, lead ? s.cardLead : null, { paddingHorizontal: pad }]}>
                {landscape ? (
                  <View style={{ paddingBottom: pad * 2 }}>
                    <View style={s.row}>
                      <Image source={{ uri: getAvatarUrl(p.name) }} style={{ width: av, height: av, borderRadius: av / 2, backgroundColor: '#1C1C1E' }} />
                      <Text style={[s.name, { fontSize: nameSize, flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                    </View>
                    <AnimatedNumber value={p.total_score} style={[s.points, { fontSize: pts, marginTop: pad * 0.8 }]} />
                    <View style={{ marginTop: pad * 2.4 }}><Stats name={p.name} c={counts[p.id]} vertical size={statSize} keepBeggarSpace radelci={radelci[p.id] || 0} /></View>
                  </View>
                ) : (
                  <View>
                    <View style={s.row}>
                      <Image source={{ uri: getAvatarUrl(p.name) }} style={{ width: av, height: av, borderRadius: av / 2, backgroundColor: '#1C1C1E' }} />
                      <Text style={[s.name, { fontSize: nameSize, flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                      <AnimatedNumber value={p.total_score} style={[s.points, { fontSize: pts }]} />
                    </View>
                    <View style={{ marginTop: 8 }}><Stats name={p.name} c={counts[p.id]} vertical={false} size={statSize} radelci={radelci[p.id] || 0} /></View>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>
        <TouchableOpacity onPress={onClose} style={[s.close, landscape ? { top: 16, right: 14 } : { top: 18, right: 18 }]} hitSlop={12} accessibilityLabel="Zapri mizni zaslon">
          <X size={16} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  areaPort: { flex: 1, marginTop: 66, marginHorizontal: 16, marginBottom: 24 },
  areaLand: { flex: 1, marginTop: 16, marginBottom: 16, marginLeft: 16, marginRight: 60 },
  card: { position: 'absolute', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', justifyContent: 'center' },
  cardLead: { borderWidth: 1, borderColor: 'rgba(232,199,102,0.45)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  name: { color: '#FFFFFF', fontWeight: '600' },
  points: { color: '#FFFFFF', fontWeight: '600', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  close: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
});
