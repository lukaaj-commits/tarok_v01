// Skupen pomnilnik podatkov za statistiko, profil, lestvico, dvoboj in obvestila.
// Prvič se naloži vse, nato se ob vsaki osvežitvi prenese SAMO NOVO:
//  - igre (majhna tabela) vedno v celoti,
//  - za igre, ki so v teku (ali so se pravkar zaključile), vse njihove podatke na novo
//    (točke se tam spreminjajo, razveljavitve brišejo vpise),
//  - za ostale samo vpise, ustvarjene po zadnji osvežitvi.
// Rezultati so enaki, kot če bi vsakič prenesli vse, le da se prenese nekaj KB namesto ~2 MB.
import { supabase } from '@/lib/supabase';
import { refreshCustomAvatars } from '@/lib/avatars';

export type CacheData = { games: any[]; players: any[]; entries: any[]; radelci: any[] };

const ENTRY_COLS = 'id, player_id, game_id, points, created_at, played, is_partner, is_beggar, is_valat, is_penalty';
const PLAYER_COLS = 'id, game_id, name, position, total_score, created_at, profile_id';
const RADELC_COLS = 'id, player_id, game_id, created_at';
const OVERLAP_MS = 5 * 60 * 1000;   // varnostno prekrivanje pri "samo novo" (dvojnike odstranimo po id)
const FRESH_MS = 1500;              // klici v tem času dobijo isti rezultat (npr. več oken hkrati)

let state: { games: any[]; players: Map<string, any>; entries: Map<string, any>; radelci: Map<string, any>; sinceIso: string | null; liveGames: Set<string> } | null = null;
let inflight: Promise<CacheData> | null = null;
let lastSyncAt = 0;
let lastResult: CacheData | null = null;

const check = <T,>(r: { data: T | null; error: any }) => { if (r.error) throw r.error; return (r.data || []) as T; };
const maxIso = (rows: any[], prev: string | null) => rows.reduce((m, r) => (r.created_at && (!m || r.created_at > m) ? r.created_at : m), prev);

async function fullLoad() {
  const [g, p, e, r] = await Promise.all([
    supabase.from('games').select('id, name, created_at, is_active').order('created_at', { ascending: false }),
    supabase.from('players').select(PLAYER_COLS),
    supabase.from('score_entries').select(ENTRY_COLS),
    supabase.from('radelci').select(RADELC_COLS),
  ]);
  const games = check<any[]>(g), players = check<any[]>(p), entries = check<any[]>(e), radelci = check<any[]>(r);
  state = {
    games,
    players: new Map(players.map(x => [x.id, x])),
    entries: new Map(entries.map(x => [x.id, x])),
    radelci: new Map(radelci.map(x => [x.id, x])),
    sinceIso: maxIso(players, maxIso(entries, maxIso(radelci, null))),
    liveGames: new Set(games.filter(x => x.is_active).map(x => x.id)),
  };
}

async function incremental() {
  const s = state!;
  const g = check<any[]>(await supabase.from('games').select('id, name, created_at, is_active').order('created_at', { ascending: false }));
  const gameIds = new Set(g.map(x => x.id));
  const nowLive = g.filter(x => x.is_active).map(x => x.id);
  // igre v teku + tiste, ki so bile ob zadnji osvežitvi še v teku (pravkar zaključene)
  const refreshIds = [...new Set([...nowLive, ...[...s.liveGames].filter(id => gameIds.has(id))])];
  const since = s.sinceIso ? new Date(new Date(s.sinceIso).getTime() - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z';

  const [pNew, eNew, rNew, pLive, eLive, rLive] = await Promise.all([
    supabase.from('players').select(PLAYER_COLS).gt('created_at', since),
    supabase.from('score_entries').select(ENTRY_COLS).gt('created_at', since),
    supabase.from('radelci').select(RADELC_COLS).gt('created_at', since),
    refreshIds.length ? supabase.from('players').select(PLAYER_COLS).in('game_id', refreshIds) : Promise.resolve({ data: [], error: null }),
    refreshIds.length ? supabase.from('score_entries').select(ENTRY_COLS).in('game_id', refreshIds) : Promise.resolve({ data: [], error: null }),
    refreshIds.length ? supabase.from('radelci').select(RADELC_COLS).in('game_id', refreshIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const players = check<any[]>(pNew), entries = check<any[]>(eNew), radelci = check<any[]>(rNew);
  const playersLive = check<any[]>(pLive as any), entriesLive = check<any[]>(eLive as any), radelciLive = check<any[]>(rLive as any);

  const refreshSet = new Set(refreshIds);
  // podatki iger, ki jih osvežimo v celoti: najprej odstranimo stare (zajame razveljavitve in brisanja)
  const drop = (m: Map<string, any>) => { for (const [k, v] of m) if (!gameIds.has(v.game_id) || refreshSet.has(v.game_id)) m.delete(k); };
  drop(s.players); drop(s.entries); drop(s.radelci);
  const put = (m: Map<string, any>, rows: any[]) => rows.forEach(x => { if (gameIds.has(x.game_id)) m.set(x.id, x); });
  put(s.players, players); put(s.players, playersLive);
  put(s.entries, entries); put(s.entries, entriesLive);
  put(s.radelci, radelci); put(s.radelci, radelciLive);

  s.games = g;
  s.sinceIso = maxIso(players, maxIso(entries, maxIso(radelci, s.sinceIso)));
  s.liveGames = new Set(nowLive);
}

function snapshot(): CacheData {
  const s = state!;
  return {
    games: s.games,
    players: [...s.players.values()],
    entries: [...s.entries.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)),
    radelci: [...s.radelci.values()],
  };
}

// Vrne sveže podatke (prvič vse, nato samo spremembe)
export function getData(): Promise<CacheData> {
  if (lastResult && Date.now() - lastSyncAt < FRESH_MS) return Promise.resolve(lastResult);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const avatars = refreshCustomAvatars(); // profilne slike (majhna tabela) hkrati s podatki
      if (!state) await fullLoad();
      else {
        try { await incremental(); }
        catch (e) { state = null; await fullLoad(); } // če gre kaj narobe, raje naložimo vse znova
      }
      await avatars;
      lastResult = snapshot();
      lastSyncAt = Date.now();
      return lastResult;
    } finally { inflight = null; }
  })();
  return inflight;
}
