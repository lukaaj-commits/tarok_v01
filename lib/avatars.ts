// Slike igralcev (enako kot na zaslonih Aktivna igra in Zgodovina).
// Igralec si lahko v svojem profilu naloži svojo sliko (tabela profilne_slike); ta ima prednost.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const PLAYER_IMAGES: Record<string, string> = {
  "Filip": "https://i.postimg.cc/jW6qppPX/filip01.png",
  "Luka M": "https://i.postimg.cc/FHDntBY5/luka-M02.png",
  "Luka Š": "https://i.postimg.cc/CZCM33kc/luka-S01.png",
  "Mark": "https://i.postimg.cc/t1dRKKWr/mark01.png",
  "Metka": "https://i.postimg.cc/67V6kknj/metka01.png",
  "Miha": "https://i.postimg.cc/8Fdk22M0/miha01.png",
  "Nejc": "https://i.postimg.cc/ph2VRsJQ/nejc01.png",
  "Sara": "https://i.postimg.cc/wy6xgwQQ/sara01.png",
  "Tiffany": "https://i.postimg.cc/7GxPwKnN/tiff01.png",
  "Tina": "https://i.postimg.cc/tZXRpBN5/tina01.png"
};

// naložene slike igralcev; zadnje znane hranimo tudi na telefonu, da ob zagonu ne utripne stara slika
const LS_KEY = 'tarok_profilne_slike_v1';
let custom: Record<string, string> = {};
try { custom = JSON.parse((globalThis as any).localStorage?.getItem(LS_KEY) || '{}') || {}; } catch { custom = {}; }
const listeners = new Set<() => void>();
const changed = (next: Record<string, string>) => {
  if (JSON.stringify(next) === JSON.stringify(custom)) return;
  custom = next;
  try { (globalThis as any).localStorage?.setItem(LS_KEY, JSON.stringify(custom)); } catch {}
  listeners.forEach(l => l());
};

// osveži iz baze (kliče se ob vsakem nalaganju podatkov)
export async function refreshCustomAvatars() {
  try {
    const { data, error } = await supabase.from('profilne_slike').select('ime, url');
    if (error || !data) return;
    const next: Record<string, string> = {};
    data.forEach((r: any) => { if (r.ime && r.url) next[r.ime] = r.url; });
    changed(next);
  } catch {}
}
export function setCustomAvatar(name: string, url: string | null) {
  const next = { ...custom };
  if (url) next[name.trim()] = url; else delete next[name.trim()];
  changed(next);
}
export const hasCustomAvatar = (name?: string | null) => !!name && !!custom[name.trim()];
// komponente, ki morajo sliko zamenjati takoj (profil, krogec zgoraj)
export function useAvatarVersion() {
  const [v, setV] = useState(0);
  useEffect(() => { const l = () => setV(x => x + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return v;
}

export const getAvatarUrl = (name: string) => {
  const cleanName = name.trim();
  if (custom[cleanName]) return custom[cleanName];
  if (PLAYER_IMAGES[cleanName]) return PLAYER_IMAGES[cleanName];
  return `https://api.dicebear.com/8.x/lorelei/png?seed=${encodeURIComponent(cleanName)}&backgroundColor=transparent`;
};
