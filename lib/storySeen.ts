// Katere zgodbe so na tem telefonu že ogledane (shranjeno samo na telefonu, ne v bazi).
// Modro (novo) je samo zadnje obdobje: zadnji mesec, 1. januarja pa tudi leto pred njim.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tarok_zgodbe_videno_v1';
let cache: Set<string> | null = null;

export async function loadSeen(): Promise<Set<string>> {
  if (cache) return cache;
  try { cache = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) || '[]')); }
  catch { cache = new Set(); }
  return cache;
}

export async function markSeen(name: string, period: string) {
  const s = await loadSeen();
  const k = `${name}|${period}`;
  if (s.has(k)) return;
  s.add(k);
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...s])); } catch {}
}

// obdobja, ki so lahko nova (najnovejša izdaja)
export function releasePeriods(periods: string[]) {
  if (!periods.length) return [];
  return periods[0].length === 4 && periods[1] ? [periods[0], periods[1]] : [periods[0]];
}

export const isNewStory = (seen: Set<string>, name: string, periods: string[], period: string) =>
  releasePeriods(periods).includes(period) && !seen.has(`${name}|${period}`);
