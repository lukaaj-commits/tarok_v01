// Kdo je na katerem telefonu izbral svoje ime (tabela izbrani_igralci).
// Ni zaklepanja: če ime drži drug telefon, okno "Kdo si?" najprej vpraša "Si res ti?",
// drugi telefon pa ob naslednjem odprtju izgubi izbiro.
// Če tabele ni ali baza ni dosegljiva, vse deluje naprej samo s shranjenim na telefonu.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const DEVICE_KEY = 'tarok_naprava_v1';
let device: string | null = null;

// naključna oznaka tega telefona (brez osebnih podatkov)
export async function deviceId(): Promise<string> {
  if (device) return device;
  try { device = await AsyncStorage.getItem(DEVICE_KEY); } catch {}
  if (!device) {
    device = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('');
    try { await AsyncStorage.setItem(DEVICE_KEY, device); } catch {}
  }
  return device;
}

// imena, ki jih drži drug telefon (null = ne vemo, npr. ni povezave)
export async function takenByOthers(): Promise<Set<string> | null> {
  try {
    const me = await deviceId();
    const { data, error } = await supabase.from('izbrani_igralci').select('ime, naprava');
    if (error) return null;
    return new Set((data || []).filter((r: any) => r.naprava !== me).map((r: any) => r.ime));
  } catch { return null; }
}

// ime dobi ta telefon; prejšnje ime tega telefona se sprosti
export async function claimName(name: string, previous: string | null) {
  try {
    const me = await deviceId();
    if (previous && previous !== name) await releaseName(previous);
    await supabase.from('izbrani_igralci').upsert({ ime: name, naprava: me, posodobljeno: new Date().toISOString() });
  } catch {}
}

// sprosti ime (samo, če ga drži ta telefon)
export async function releaseName(name: string) {
  try {
    const me = await deviceId();
    await supabase.from('izbrani_igralci').delete().eq('ime', name).eq('naprava', me);
  } catch {}
}

// ali ime še pripada temu telefonu: 'mine' | 'lost' (drži ga drug telefon) | 'unknown'
export async function checkName(name: string): Promise<'mine' | 'lost' | 'unknown'> {
  try {
    const me = await deviceId();
    const { data, error } = await supabase.from('izbrani_igralci').select('naprava').eq('ime', name).maybeSingle();
    if (error) return 'unknown';
    if (!data) { await claimName(name, null); return 'mine'; } // izbrano pred to posodobitvijo: zapišemo
    return data.naprava === me ? 'mine' : 'lost';
  } catch { return 'unknown'; }
}
