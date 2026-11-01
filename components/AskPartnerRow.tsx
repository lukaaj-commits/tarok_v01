// Nastavitev telefona "Vprašaj za klicanega" (privzeto izklopljeno).
// Ko je vklopljena: po vpisu igralca aplikacija vpraša "Koga je klical?" (in obratno "Kdo je igral?").
import { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tarok_vprasaj_klicanega_v1';
let current: boolean | undefined;
const listeners = new Set<(v: boolean) => void>();

export async function getAskPartner(): Promise<boolean> {
  if (current !== undefined) return current;
  try { current = (await AsyncStorage.getItem(KEY)) === '1'; } catch { current = false; }
  return current;
}
export async function setAskPartner(v: boolean) {
  current = v;
  try { await AsyncStorage.setItem(KEY, v ? '1' : '0'); } catch {}
  listeners.forEach(l => l(v));
}
export function useAskPartner() {
  const [v, setV] = useState<boolean>(current ?? false);
  useEffect(() => { getAskPartner().then(setV); listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return v;
}

// vrstica na dnu profila (pod "Na tem telefonu")
export default function AskPartnerRow() {
  const on = useAskPartner();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>Vprašaj za klicanega</Text>
        <Text style={styles.sub}>Po vpisu igralca vpraša, koga je klical.</Text>
      </View>
      <Switch value={on} onValueChange={setAskPartner} trackColor={{ false: 'rgba(120,120,128,0.32)', true: '#30D158' }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as any)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 14, marginTop: 28, marginBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  text: { fontSize: 13, color: '#EBEBF5' },
  sub: { fontSize: 11.5, color: '#636366', marginTop: 1 },
});

// ---------------------------------------------------------------------
// Nastavitev telefona "Zaslon med igro ne ugasne" (privzeto izklopljeno)
// ---------------------------------------------------------------------
const AWAKE_KEY = 'tarok_zaslon_med_igro_v1';
let awake: boolean | undefined;
const awakeListeners = new Set<(v: boolean) => void>();

export async function getKeepAwake(): Promise<boolean> {
  if (awake !== undefined) return awake;
  try { awake = (await AsyncStorage.getItem(AWAKE_KEY)) === '1'; } catch { awake = false; }
  return awake;
}
export async function setKeepAwake(v: boolean) {
  awake = v;
  try { await AsyncStorage.setItem(AWAKE_KEY, v ? '1' : '0'); } catch {}
  awakeListeners.forEach(l => l(v));
}
export function useKeepAwake() {
  const [v, setV] = useState<boolean>(awake ?? false);
  useEffect(() => { getKeepAwake().then(setV); awakeListeners.add(setV); return () => { awakeListeners.delete(setV); }; }, []);
  return v;
}

export function KeepAwakeRow() {
  const on = useKeepAwake();
  return (
    <View style={[styles.row, { borderTopWidth: 0, marginTop: 0, paddingTop: 4 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>Zaslon med igro ne ugasne</Text>
        <Text style={styles.sub}>Telefon se med aktivno igro ne zaklene.</Text>
      </View>
      <Switch value={on} onValueChange={setKeepAwake} trackColor={{ false: 'rgba(120,120,128,0.32)', true: '#30D158' }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as any)} />
    </View>
  );
}
