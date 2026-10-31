// Zaščita s PIN-om: aplikacija se pokaže šele, ko je telefon prijavljen.
// PIN je geslo skupnega uporabnika v Supabase (igralci@tarok.app); telefon si prijavo zapomni.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform } from 'react-native';
import { Delete } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const PIN_EMAIL = 'igralci@tarok.app';
const MIN_LEN = 6;
const MAX_LEN = 12;
const NATIVE = Platform.OS !== 'web';

export default function PinGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState(data.session ? 'open' : 'locked')).catch(() => setState('locked'));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setState('locked');
      else if (session) setState('open');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const doShake = () => {
    shake.setValue(0);
    Animated.sequence([10, -10, 8, -8, 4, 0].map(v => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: NATIVE }))).start();
  };

  const submit = async () => {
    if (busy || pin.length < MIN_LEN) return;
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: PIN_EMAIL, password: pin });
      if (err) {
        const many = /rate|too many/i.test(err.message);
        setError(many ? 'Preveč poskusov, poskusi čez nekaj minut' : 'Napačen PIN');
        setPin(''); doShake();
      } else {
        setState('open');
      }
    } catch {
      setError('Ni povezave, poskusi znova'); doShake();
    } finally { setBusy(false); }
  };

  const press = (k: string) => {
    if (busy) return;
    setError('');
    if (k === 'DEL') setPin(p => p.slice(0, -1));
    else setPin(p => (p.length >= MAX_LEN ? p : p + k));
  };

  if (state === 'open') return <>{children}</>;
  if (state === 'checking') return <View style={styles.screen}><ActivityIndicator size="large" color="#0A84FF" /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.box}>
        <Text style={styles.title}>Tarok</Text>
        <Text style={styles.subtitle}>Vpiši PIN</Text>

        <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
          {Array.from({ length: Math.max(MIN_LEN, pin.length) }, (_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
          ))}
        </Animated.View>
        <Text style={styles.error}>{error}</Text>

        <View style={styles.pad}>
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map(n => (
                <TouchableOpacity key={n} style={styles.key} onPress={() => press(String(n))} activeOpacity={0.6}>
                  <Text style={styles.keyText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.row}>
            <View style={[styles.key, styles.keyGhost]} />
            <TouchableOpacity style={styles.key} onPress={() => press('0')} activeOpacity={0.6}><Text style={styles.keyText}>0</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.key, styles.keyAction]} onPress={() => press('DEL')} activeOpacity={0.6}><Delete size={24} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.enter, pin.length < MIN_LEN && styles.enterOff]} onPress={submit} disabled={pin.length < MIN_LEN || busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.enterText}>Vstopi</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 340, alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 44, fontWeight: '700', letterSpacing: -1 },
  subtitle: { color: '#8E8E93', fontSize: 16, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 14, marginTop: 34, minHeight: 14 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#0A84FF', borderColor: '#0A84FF' },
  error: { color: '#FF453A', fontSize: 14, marginTop: 14, minHeight: 20 },
  pad: { width: '100%', gap: 10, marginTop: 14 },
  row: { flexDirection: 'row', gap: 10 },
  key: { flex: 1, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.14)' },
  keyAction: { backgroundColor: 'rgba(255,255,255,0.17)' },
  keyGhost: { backgroundColor: 'transparent', borderTopWidth: 0 },
  keyText: { color: '#FFFFFF', fontSize: 26, fontWeight: '500' },
  enter: { width: '100%', height: 54, borderRadius: 16, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  enterOff: { opacity: 0.4 },
  enterText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
