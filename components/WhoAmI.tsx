// "Kdo si?" - kateri igralec uporablja ta telefon (shranjeno samo na telefonu).
// Potrebno za vstop "Tvoj oktober" na začetnem zaslonu; v profilu ga lahko kadarkoli spremeniš.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, Pressable, Animated, ActivityIndicator, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Eye } from 'lucide-react-native';
import { getData } from '@/lib/dataCache';
import { getAvatarUrl } from '@/lib/avatars';

const KEY = 'tarok_moj_igralec_v1';
let current: string | null | undefined;
const listeners = new Set<(n: string | null) => void>();

export async function getMyPlayer(): Promise<string | null> {
  if (current !== undefined) return current;
  try { current = (await AsyncStorage.getItem(KEY)) || null; } catch { current = null; }
  return current;
}
export async function setMyPlayer(name: string | null) {
  current = name;
  try { name ? await AsyncStorage.setItem(KEY, name) : await AsyncStorage.removeItem(KEY); } catch {}
  listeners.forEach(l => l(name));
}
export function useMyPlayer() {
  const [name, setName] = useState<string | null>(current ?? null);
  useEffect(() => {
    getMyPlayer().then(setName);
    listeners.add(setName);
    return () => { listeners.delete(setName); };
  }, []);
  return name;
}

// seznam igralcev: vsi, ki so odigrali vsaj 3 partije (abecedno); naloži se vnaprej
let namesCache: string[] | null = null;
export async function preloadPlayerNames() { if (!namesCache) namesCache = await playerNames(); return namesCache; }
async function playerNames() {
  const d = await getData();
  const count: Record<string, number> = {};
  d.players.forEach((p: any) => { count[p.name] = (count[p.name] || 0) + 1; });
  return Object.keys(count).filter(n => count[n] >= 3).sort((a, b) => a.localeCompare(b, 'sl'));
}

// okno od spodaj; onPick(ime) ali onPick(null) = "Samo gledam" (se ne shrani)
export function WhoAmISheet({ onPick, onClose }: { onPick: (name: string | null) => void; onClose: () => void }) {
  const [names, setNames] = useState<string[] | null>(namesCache);
  const mine = useMyPlayer();
  const { height } = useWindowDimensions();
  const sheetH = Math.round(height * 0.8);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(sheetH)).current;

  useEffect(() => {
    preloadPlayerNames().then(setNames);
    // ozadje se pojavi, okno pride od spodaj
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.spring(slide, { toValue: 0, damping: 26, stiffness: 260, mass: 0.9, useNativeDriver: false }),
    ]).start();
  }, []);

  // zapiranje: okno zdrsne dol, ozadje izgine, nato šele obvestimo
  const close = (after: () => void) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(slide, { toValue: sheetH, duration: 220, useNativeDriver: false }),
    ]).start(() => after());
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close(onClose)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(onClose)} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { height: sheetH, transform: [{ translateY: slide }] }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Kdo si?</Text>
        <Text style={styles.sub}>Izberi svoje ime. Telefon si ga zapomni.</Text>
        {!names ? (
          <ActivityIndicator color="#0A84FF" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView style={{ marginTop: 14, flex: 1 }} showsVerticalScrollIndicator={false}>
            {names.map(n => (
              <TouchableOpacity key={n} activeOpacity={0.7} style={styles.row} onPress={async () => { await setMyPlayer(n); close(() => onPick(n)); }}>
                <Image source={{ uri: getAvatarUrl(n) }} style={styles.avatar} />
                <Text style={styles.name}>{n}</Text>
                {mine === n && <Check size={20} color="#0A84FF" strokeWidth={2.6} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity activeOpacity={0.7} style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => close(() => onPick(null))}>
              <View style={[styles.avatar, styles.eye]}><Eye size={18} color="#8E8E93" /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: '#EBEBF5' }]}>Samo gledam</Text>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>Tega si telefon ne zapomni.</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

// vrstica na dnu profila: "Na tem telefonu: Tina · Spremeni"
export function PhoneOwnerRow() {
  const mine = useMyPlayer();
  const [open, setOpen] = useState(false);
  useEffect(() => { preloadPlayerNames(); }, []);
  return (
    <>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(true)} style={styles.ownerRow}>
        <Text style={styles.ownerText}>Na tem telefonu: <Text style={{ color: mine ? '#EBEBF5' : '#8E8E93' }}>{mine || 'ni izbrano'}</Text></Text>
        <Text style={styles.ownerLink}>{mine ? 'Spremeni' : 'Izberi'}</Text>
      </TouchableOpacity>
      {/* v profilu "Samo gledam" počisti izbiro (če se je kdo zmotil) */}
      {open && <WhoAmISheet onPick={async n => { if (!n) await setMyPlayer(null); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#121A2B', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,190,255,0.40)', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 34 },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginTop: 22, letterSpacing: -0.4 },
  sub: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1C1C1E' },
  eye: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)' },
  name: { flex: 1, fontSize: 17, color: '#FFFFFF' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, marginBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  ownerText: { fontSize: 13, color: '#8E8E93' },
  ownerLink: { fontSize: 13, fontWeight: '500', color: '#0A84FF' },
});
