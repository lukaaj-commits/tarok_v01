// Vstop v zgodbo prejšnjega meseca (začetni zaslon in zvonec).
// Prvih 7 dni v novem mesecu, dokler igralec zgodbe ne pogleda. 1. januarja je to letna zgodba.
import { storyPeriods } from '@/lib/monthStory';
import { MONTH_NAMES } from '@/lib/season';

export const ENTRY_DAYS = 7;

// samo za preizkušanje (privzeto je to današnji dan)
let testNow: Date | null = null;
export const setStoryTestNow = (d: Date | null) => { testNow = d; emit(); };
export const storyNow = () => testNow ?? new Date();

export type StoryEntry = { target: string; title: string; sub: string; year: boolean };

export function entryTarget(now: Date) {
  const y = now.getFullYear(), m = now.getMonth(); // m: 0-11
  const prev = m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`;
  return { prev, year: m === 0 ? String(y - 1) : null };
}

// me = igralec na tem telefonu (ali null); seen = ogledane zgodbe na tem telefonu
export function computeEntry(d: any, me: string | null, seen: Set<string>, now = storyNow()): StoryEntry | null {
  if (now.getDate() > ENTRY_DAYS) return null;
  const { prev, year } = entryTarget(now);
  let target = year ?? prev;
  if (me) {
    const periods = storyPeriods(d, me, now);
    if (!periods.includes(target)) {
      if (year && periods.includes(prev)) target = prev; else return null; // ta mesec / leto ni igral
    }
    if (seen.has(`${me}|${target}`)) return null;
  } else {
    // nihče še ni izbran: pokažemo, če se je v tistem obdobju sploh igralo
    const any = d.games.some((g: any) => !g.is_active && (year ? String(new Date(g.created_at).getFullYear()) === year : monthKey(g.created_at) === prev));
    if (!any) return null;
  }
  const isYear = target.length === 4;
  const monthName = isYear ? '' : MONTH_NAMES[Number(target.slice(5)) - 1];
  return {
    target,
    year: isYear,
    title: isYear ? `Leto ${target} je za nami` : `${monthName} je za nami`,
    sub: me ? (isYear ? 'Tvoje leto v taroku je pripravljeno' : 'Tvoj mesec v taroku je pripravljen') : 'Poglej, kako ti je šlo',
  };
}
const monthKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// --- dogodki: "odpri zgodbo" in "stanje se je spremenilo" (ogledano, izbran igralec) ---
const openers = new Set<() => void>();
const changes = new Set<() => void>();
export const onOpenStory = (f: () => void) => { openers.add(f); return () => { openers.delete(f); }; };
export const openStoryFlow = () => openers.forEach(f => f());
export const onStoryChange = (f: () => void) => { changes.add(f); return () => { changes.delete(f); }; };
export const emit = () => changes.forEach(f => f());
