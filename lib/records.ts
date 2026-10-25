// =====================================================================
// DVORANA SLAVNIH - rekordi vseh časov
// Štejejo vse igre z vsaj eno vpisano točko (enako kot lestvica).
// Pri izenačenju so navedeni vsi nosilci rekorda.
// =====================================================================
import { computeSeasons } from '@/lib/season';

export type RecGame = { id: string; created_at: string };
export type RecPlayer = { id: string; game_id: string; name: string; total_score: number };
export type RecEntry = { id: string; player_id: string; game_id: string; points: number; created_at: string; is_valat?: boolean | null; is_beggar?: boolean | null };

export type HallRecord = {
  id: string;
  icon: string;
  title: string;
  holders: string[];   // nosilci rekorda (lahko več pri izenačenju)
  value: string;       // npr. "+1045" ali "31"
  detail?: string;     // npr. datum
};

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const date = (iso: string) => new Date(iso).toLocaleDateString('sl-SI');
const holdersOf = <T,>(items: T[], val: (x: T) => number, best: 'max' | 'min') => {
  if (!items.length) return { value: 0, items: [] as T[] };
  const v = best === 'max' ? Math.max(...items.map(val)) : Math.min(...items.map(val));
  return { value: v, items: items.filter(x => val(x) === v) };
};
const uniq = (a: string[]) => [...new Set(a)];

export function computeRecords(games: RecGame[], players: RecPlayer[], entries: RecEntry[]): HallRecord[] {
  const gameById = new Map(games.map(g => [g.id, g]));
  const playerById = new Map(players.map(p => [p.id, p]));
  const byGame = new Map<string, RecPlayer[]>();
  players.forEach(p => { if (!byGame.has(p.game_id)) byGame.set(p.game_id, []); byGame.get(p.game_id)!.push(p); });
  // veljavne igre, po vrsti
  const valid = games
    .filter(g => (byGame.get(g.id) || []).some(p => p.total_score !== 0))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const validIds = new Set(valid.map(g => g.id));
  const vPlayers = players.filter(p => validIds.has(p.game_id));
  const vEntries = entries.filter(e => validIds.has(e.game_id));
  const out: HallRecord[] = [];

  // 1-2) najvišji / najnižji rezultat igre
  const hi = holdersOf(vPlayers, p => p.total_score, 'max');
  if (hi.items.length) out.push({ id: 'best-game', icon: '🚀', title: 'Najvišji rezultat igre', holders: uniq(hi.items.map(p => p.name)), value: fmt(hi.value), detail: hi.items.map(p => date(gameById.get(p.game_id)!.created_at)).join(', ') });
  const lo = holdersOf(vPlayers, p => p.total_score, 'min');
  if (lo.items.length) out.push({ id: 'worst-game', icon: '💀', title: 'Najnižji rezultat igre', holders: uniq(lo.items.map(p => p.name)), value: fmt(lo.value), detail: lo.items.map(p => date(gameById.get(p.game_id)!.created_at)).join(', ') });

  // 3-4) največji posamezni vpis / minus
  const eHi = holdersOf(vEntries, e => e.points, 'max');
  if (eHi.items.length) out.push({ id: 'best-entry', icon: '💥', title: 'Največji posamezni vpis', holders: uniq(eHi.items.map(e => playerById.get(e.player_id)?.name || '?')), value: fmt(eHi.value), detail: eHi.items.map(e => date(e.created_at)).join(', ') });
  const eLo = holdersOf(vEntries, e => e.points, 'min');
  if (eLo.items.length) out.push({ id: 'worst-entry', icon: '🧨', title: 'Največji posamezni minus', holders: uniq(eLo.items.map(e => playerById.get(e.player_id)?.name || '?')), value: fmt(eLo.value), detail: eLo.items.map(e => date(e.created_at)).join(', ') });

  // 5) najbolj prepričljiva zmaga (prednost pred 2. mestom)
  const margins = valid.map(g => {
    const gp = [...(byGame.get(g.id) || [])].sort((a, b) => b.total_score - a.total_score);
    return gp.length > 1 ? { name: gp[0].name, margin: gp[0].total_score - gp[1].total_score, date: g.created_at } : null;
  }).filter((x): x is { name: string; margin: number; date: string } => !!x && x.margin > 0);
  const mg = holdersOf(margins, m => m.margin, 'max');
  if (mg.items.length) out.push({ id: 'margin', icon: '👑', title: 'Najvišja prednost', holders: uniq(mg.items.map(m => m.name)), value: `+${mg.value}`, detail: `prednost pred 2. mestom · ${mg.items.map(m => date(m.date)).join(', ')}` });

  // števci po igralcih
  const wins: Record<string, number> = {}, gamesCnt: Record<string, number> = {}, career: Record<string, number> = {};
  const streak: Record<string, number> = {}, maxStreak: Record<string, number> = {};
  valid.forEach(g => {
    const gp = byGame.get(g.id) || [];
    gp.forEach(p => {
      const won = !gp.some(o => o.total_score > p.total_score);
      gamesCnt[p.name] = (gamesCnt[p.name] || 0) + 1;
      career[p.name] = (career[p.name] || 0) + p.total_score;
      if (won) wins[p.name] = (wins[p.name] || 0) + 1;
      streak[p.name] = won ? (streak[p.name] || 0) + 1 : 0;
      maxStreak[p.name] = Math.max(maxStreak[p.name] || 0, streak[p.name]);
    });
  });
  const valats: Record<string, number> = {}, beggars: Record<string, number> = {};
  vEntries.forEach(e => {
    const n = playerById.get(e.player_id)?.name;
    if (!n || e.points <= 0) return;
    if (e.is_valat) valats[n] = (valats[n] || 0) + 1;
    if (e.is_beggar) beggars[n] = (beggars[n] || 0) + 1;
  });
  const countRecord = (id: string, icon: string, title: string, m: Record<string, number>, unit: (v: number) => string) => {
    const r = holdersOf(Object.entries(m), x => x[1], 'max');
    if (r.items.length && r.value > 0) out.push({ id, icon, title, holders: r.items.map(x => x[0]), value: unit(r.value) });
  };
  countRecord('wins', '🏆', 'Največ zmag', wins, v => `${v}`);
  countRecord('games', '🎴', 'Največ odigranih iger', gamesCnt, v => `${v}`);
  countRecord('career', '💰', 'Največ kariernih točk', career, v => fmt(v));
  countRecord('valats', '⚡', 'Največ valatov', valats, v => `${v}`);
  countRecord('beggars', '🙏', 'Največ dobljenih beračev', beggars, v => `${v}`);
  countRecord('streak', '🔥', 'Najdaljši niz zmag', maxStreak, v => `${v} zapored`);

  // maraton: igra z največ vpisi
  const lens = valid.map(g => ({ g, n: vEntries.filter(e => e.game_id === g.id).length }));
  const ln = holdersOf(lens, x => x.n, 'max');
  if (ln.items.length && ln.value > 0) {
    const winners = ln.items.map(x => {
      const gp = byGame.get(x.g.id) || [];
      const mx = Math.max(...gp.map(p => p.total_score));
      return gp.filter(p => p.total_score === mx).map(p => p.name).join(' & ');
    });
    out.push({ id: 'marathon', icon: '⏱️', title: 'Najdaljša igra (maraton)', holders: [], value: `${ln.value} vpisov`, detail: ln.items.map((x, i) => `${date(x.g.created_at)} · zmagovalec: ${winners[i]}`).join(', ') });
  }

  // največ naslovov Igralec meseca
  const titles: Record<string, number> = {};
  computeSeasons(games, players).forEach(m => m.champions.forEach(n => { titles[n] = (titles[n] || 0) + 1; }));
  countRecord('titles', '🏅', 'Največ naslovov Igralec meseca', titles, v => `${v}`);

  return out;
}
