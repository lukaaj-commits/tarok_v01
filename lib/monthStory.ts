// =====================================================================
// ZGODBE (mesečni in letni pregled igralca)
// Samo izračun iz obstoječih podatkov - nič se ne zapisuje v bazo.
//
// Izraza (enako kot v Izzivih):
//   partija = cela igra od "Začni novo igro" do "Zaključi igro"
//   igra    = ena runda v partiji (nekdo igra / berač / valat ...)
// =====================================================================
import { monthKeyOf, standingsFor, SeasonPlayer, MONTH_NAMES } from '@/lib/season';
import { gameMoment } from '@/lib/gameMoment';
import { g } from '@/lib/gender';

type G = { id: string; created_at: string; is_active: boolean };
type P = { id: string; game_id: string; name: string; total_score: number };
type E = {
  id: string; player_id: string; game_id: string; points: number; created_at: string;
  played?: boolean | null; is_partner?: boolean | null; is_beggar?: boolean | null; is_valat?: boolean | null; is_penalty?: boolean | null;
};
export type StoryData = { games: G[]; players: P[]; entries: E[] };

// obdobje: mesec ("2026-10") ali leto ("2026")
export type PeriodKey = string;

const ROUND_WINDOW_MS = 3 * 60 * 1000; // igralec in klicani sta vpisana skoraj hkrati
const isDeclarer = (e: E) => !!(e.played || e.is_beggar || (e.is_valat && !e.is_partner));
const yearOf = (iso: string) => String(new Date(iso).getFullYear());
const inPeriod = (iso: string, key: PeriodKey) => (key.length === 4 ? yearOf(iso) === key : monthKeyOf(iso) === key);

export type Counter = { total: number; won: number };
export type StoryGame = {
  gameId: string; date: string; rank: number; score: number; players: number;
  rounds: number; durationMin: number; moment: string | null;
};
export type Story = {
  name: string;
  period: PeriodKey;
  label: string;                     // "Oktober 2026" ali "Leto 2026"
  games: number;                     // odigrane partije
  wins: number;                      // zmage (1. mesto, tudi izenačeno)
  points: number;                    // seštevek končnih točk vseh partij
  prevGames: number | null;          // partije v prejšnjem mesecu / letu (null = takrat ni igral)
  rank: { rank: number; of: number } | null;   // mesto na lestvici (null = premalo iger)
  table: { played: Counter; partner: Counter; beggar: Counter; valat: Counter; valatDates: string[] };
  biggest: { points: number; kind: 'valat' | 'berač' | 'klican' | 'igra'; date: string; gameId: string; series: { t: string; v: number }[] } | null;
  bestGame: StoryGame | null;        // večer meseca / leta
  partner: { name: string; together: number; won: number } | null;
  nemesis: { name: string; shared: number; ahead: number } | null;
  title: { key: string; text: string; why: string } | null;
  longestStreak: number;             // največ zaporednih zmag partij v obdobju
  monthly?: { key: string; label: string; games: number; rank: number | null }[]; // samo za leto
};

// --- pomožno ---------------------------------------------------------
function finishedGames(d: StoryData) {
  const byGame = new Map<string, P[]>();
  d.players.forEach(p => { if (!byGame.has(p.game_id)) byGame.set(p.game_id, []); byGame.get(p.game_id)!.push(p); });
  return d.games
    .filter(g => !g.is_active)
    .map(g => ({ g, ps: byGame.get(g.id) || [] }))
    .filter(x => x.ps.length && x.ps.some(p => p.total_score !== 0)) // prazne partije ne štejejo (enako kot Sezona)
    .sort((a, b) => a.g.created_at.localeCompare(b.g.created_at));
}
const rankIn = (ps: P[], p: P) => ps.filter(o => o.total_score > p.total_score).length + 1;

// pari igralec + klicani v isti igri (runda)
function pairs(entries: E[]) {
  const sorted = [...entries].filter(e => !e.is_penalty).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: { decl: E; partner: E }[] = [];
  const used = new Set<string>();
  sorted.forEach(p => {
    if (!p.is_partner || used.has(p.id)) return;
    const t = new Date(p.created_at).getTime();
    let best: E | null = null, bestDt = Infinity;
    sorted.forEach(d => {
      if (used.has(d.id) || d.game_id !== p.game_id || !isDeclarer(d) || d.player_id === p.player_id) return;
      const dt = Math.abs(new Date(d.created_at).getTime() - t);
      if (dt <= ROUND_WINDOW_MS && Number(d.points) === Number(p.points) && dt < bestDt) { best = d; bestDt = dt; }
    });
    if (best) { used.add((best as E).id); used.add(p.id); out.push({ decl: best, partner: p }); }
  });
  return out;
}

// --- glavni izračun ---------------------------------------------------
export function computeStory(d: StoryData, name: string, period: PeriodKey): Story | null {
  const isYear = period.length === 4;
  const all = finishedGames(d);
  const inP = all.filter(x => inPeriod(x.g.created_at, period));
  const mine = inP.filter(x => x.ps.some(p => p.name === name));
  if (!mine.length) return null;

  const playerIds = new Set<string>();
  const nameById = new Map<string, string>();
  d.players.forEach(p => nameById.set(p.id, p.name));
  mine.forEach(x => x.ps.forEach(p => { if (p.name === name) playerIds.add(p.id); }));
  const gameIds = new Set(mine.map(x => x.g.id));
  const entries = d.entries.filter(e => gameIds.has(e.game_id));
  const myEntries = entries.filter(e => playerIds.has(e.player_id) && !e.is_penalty);

  // partije, zmage, točke, niz zmag
  let wins = 0, points = 0, streak = 0, longestStreak = 0;
  const results = mine.map(x => {
    const me = x.ps.find(p => p.name === name)!;
    const rank = rankIn(x.ps, me);
    if (rank === 1) { wins++; streak++; longestStreak = Math.max(longestStreak, streak); } else streak = 0;
    points += me.total_score;
    return { x, me, rank };
  });

  // prejšnje obdobje
  let prevKey: string;
  if (isYear) prevKey = String(Number(period) - 1);
  else { const [y, m] = period.split('-').map(Number); prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
  const prevCount = all.filter(x => inPeriod(x.g.created_at, prevKey) && x.ps.some(p => p.name === name)).length;

  // lestvica: mesec = Sezona (isto pravilo kot v aplikaciji); leto = vse partije leta
  const standings = isYear ? yearStandings(inP.map(x => x.ps)) : standingsFor(inP.map(x => x.ps as SeasonPlayer[]));
  const row = standings.find(r => r.name === name);
  const eligibleCount = standings.filter(r => r.eligible).length;
  const rank = row && row.eligible ? { rank: row.rank, of: eligibleCount } : null;

  // za mizo
  const c = () => ({ total: 0, won: 0 });
  const table = { played: c(), partner: c(), beggar: c(), valat: c(), valatDates: [] as string[] };
  myEntries.forEach(e => {
    const won = Number(e.points) > 0;
    const add = (k: Counter) => { k.total++; if (won) k.won++; };
    if (e.is_beggar) add(table.beggar);
    else if (e.is_partner) add(table.partner);
    else if (e.played) add(table.played);
    if (e.is_valat) { add(table.valat); if (won) table.valatDates.push(e.created_at); }
  });

  // največji vpis + potek točk tiste partije
  let big: E | null = null;
  myEntries.forEach(e => { if (!big || Number(e.points) > Number(big.points)) big = e; });
  let biggest: Story['biggest'] = null;
  const b = big as E | null;
  if (b && Number(b.points) > 0) {
    let run = 0;
    const series = entries
      .filter(e => e.game_id === b.game_id && playerIds.has(e.player_id))
      .sort((a, z) => a.created_at.localeCompare(z.created_at))
      .map(e => { run += Number(e.points); return { t: e.created_at, v: run }; });
    biggest = {
      points: Number(b.points),
      kind: b.is_valat ? 'valat' : b.is_beggar ? 'berač' : b.is_partner ? 'klican' : 'igra',
      date: b.created_at, gameId: b.game_id, series,
    };
  }

  // večer obdobja: najboljše mesto, nato največ točk
  const best = [...results].sort((a, z) => a.rank - z.rank || z.me.total_score - a.me.total_score)[0];
  let bestGame: StoryGame | null = null;
  if (best) {
    const ge = entries.filter(e => e.game_id === best.x.g.id).sort((a, z) => a.created_at.localeCompare(z.created_at));
    const t0 = ge.length ? new Date(ge[0].created_at).getTime() : 0;
    const t1 = ge.length ? new Date(ge[ge.length - 1].created_at).getTime() : 0;
    bestGame = {
      gameId: best.x.g.id, date: best.x.g.created_at, rank: best.rank, score: best.me.total_score,
      players: best.x.ps.length,
      rounds: ge.filter(e => !e.is_penalty && isDeclarer(e)).length,
      durationMin: Math.round((t1 - t0) / 60000),
      moment: gameMoment(best.x.ps, ge as any),
    };
  }

  // partner: s kom je največkrat igral v paru (igralec + klicani), vsaj 3 skupne igre
  const together = new Map<string, Counter>();
  pairs(entries).forEach(({ decl, partner }) => {
    const me = playerIds.has(decl.player_id) ? decl : playerIds.has(partner.player_id) ? partner : null;
    if (!me) return;
    const other = nameById.get(me === decl ? partner.player_id : decl.player_id);
    if (!other) return;
    if (!together.has(other)) together.set(other, c());
    const k = together.get(other)!; k.total++; if (Number(me.points) > 0) k.won++;
  });
  const minTogether = isYear ? 10 : 3; // pri letu šele od 10 skupnih iger naprej (da 3 igre ne premagajo 50)
  const partnerBest = [...together.entries()].filter(([, k]) => k.total >= minTogether)
    .sort((a, z) => z[1].won / z[1].total - a[1].won / a[1].total || z[1].won - a[1].won)[0];
  const partner = partnerBest ? { name: partnerBest[0], together: partnerBest[1].total, won: partnerBest[1].won } : null;

  // nasprotnik: kdo je bil največkrat pred tabo (vsaj 3 skupne partije)
  const vs = new Map<string, { shared: number; ahead: number }>();
  results.forEach(({ x, me }) => x.ps.forEach(o => {
    if (o.name === name) return;
    if (!vs.has(o.name)) vs.set(o.name, { shared: 0, ahead: 0 });
    const v = vs.get(o.name)!; v.shared++; if (o.total_score > me.total_score) v.ahead++;
  }));
  const nem = [...vs.entries()].filter(([, v]) => v.shared >= minTogether && v.ahead > v.shared / 2)
    .sort((a, z) => z[1].ahead / z[1].shared - a[1].ahead / a[1].shared || z[1].ahead - a[1].ahead)[0];
  const nemesis = nem ? { name: nem[0], shared: nem[1].shared, ahead: nem[1].ahead } : null;

  // mesečni pregled (samo za leto)
  let monthly: Story['monthly'];
  if (isYear) {
    monthly = [];
    for (let m = 1; m <= 12; m++) {
      const k = `${period}-${String(m).padStart(2, '0')}`;
      const list = all.filter(x => monthKeyOf(x.g.created_at) === k);
      const n = list.filter(x => x.ps.some(p => p.name === name)).length;
      const r = standingsFor(list.map(x => x.ps as SeasonPlayer[])).find(s => s.name === name);
      monthly.push({ key: k, label: MONTH_NAMES[m - 1], games: n, rank: r && r.eligible ? r.rank : null });
    }
  }

  const label = isYear ? `Leto ${period}` : `${MONTH_NAMES[Number(period.split('-')[1]) - 1]} ${period.split('-')[0]}`;
  const story: Story = {
    name, period, label, games: mine.length, wins, points,
    prevGames: prevCount || null, rank, table, biggest, bestGame, partner, nemesis,
    title: null, longestStreak, monthly,
  };
  story.title = pickTitle(d, story, inP, period);
  return story;
}

// letna lestvica: šteje samo število zmag (ne glede na število partij); enako zmag = isto mesto
function yearStandings(list: P[][]) {
  const wins = new Map<string, number>();
  list.forEach(ps => ps.forEach(p => {
    if (!wins.has(p.name)) wins.set(p.name, 0);
    if (rankIn(ps, p) === 1) wins.set(p.name, wins.get(p.name)! + 1);
  }));
  const rows = [...wins.entries()].map(([name, w]) => ({ name, wins: w, eligible: true, rank: 0 }));
  rows.forEach(r => { r.rank = rows.filter(o => o.wins > r.wins).length + 1; });
  return rows;
}

// naslov obdobja (z razlago); vrstni red = prednost
function pickTitle(d: StoryData, s: Story, inP: { g: G; ps: P[] }[], period: PeriodKey): Story['title'] {
  // primerjava z vsemi igralci v obdobju
  const names = [...new Set(inP.flatMap(x => x.ps.map(p => p.name)))];
  const gameIds = new Set(inP.map(x => x.g.id));
  const idName = new Map(d.players.map(p => [p.id, p.name]));
  const beg: Record<string, number> = {}, called: Record<string, number> = {}, gamesOf: Record<string, number> = {};
  d.entries.forEach(e => {
    if (!gameIds.has(e.game_id) || e.is_penalty) return;
    const n = idName.get(e.player_id); if (!n) return;
    if (e.is_beggar && Number(e.points) > 0) beg[n] = (beg[n] || 0) + 1;
    if (e.is_partner) called[n] = (called[n] || 0) + 1;
  });
  const podium: Record<string, number> = {};
  inP.forEach(x => x.ps.forEach(p => {
    gamesOf[p.name] = (gamesOf[p.name] || 0) + 1;
    if (rankIn(x.ps, p) <= 3) podium[p.name] = (podium[p.name] || 0) + 1;
  }));
  // feniks: zmaga v partiji, v kateri je bil igralec med igro v minusu
  let phoenix = 0;
  inP.forEach(x => {
    const me = x.ps.find(p => p.name === s.name);
    if (!me || rankIn(x.ps, me) !== 1) return;
    let run = 0, neg = false;
    d.entries.filter(e => e.player_id === me.id).sort((a, z) => a.created_at.localeCompare(z.created_at))
      .forEach(e => { run += Number(e.points); if (run < 0) neg = true; });
    if (neg) phoenix++;
  });
  const top = (m: Record<string, number>) => Math.max(0, ...names.map(n => m[n] || 0));
  const only = (m: Record<string, number>) => names.filter(n => (m[n] || 0) === top(m)).length === 1;
  const me = s.name;
  const yr = period.length === 4;

  const f = (m: string, z: string) => g(me, m, z);
  const n3 = (n: number, a: string, b: string, c: string, d5: string) => { const r = n % 100; return r === 1 ? a : r === 2 ? b : r === 3 || r === 4 ? c : d5; };
  if (s.rank && s.rank.rank === 1) return { key: 'prvak', text: yr ? f('Igralec leta', 'Igralka leta') : f('Igralec meseca', 'Igralka meseca'), why: yr ? 'Prvo mesto na letni lestvici.' : 'Prvo mesto na lestvici sezone.' };
  if ((beg[me] || 0) >= 2 && beg[me] === top(beg) && only(beg)) return { key: 'berac', text: f('Kralj beračev', 'Kraljica beračev'), why: `${beg[me]} ${n3(beg[me], 'dobljen berač', 'dobljena berača', 'dobljeni berači', 'dobljenih beračev')}. Nihče v družbi jih ni imel več.` };
  if (s.table.valatDates.length) { const v = s.table.valatDates.length; return { key: 'valat', text: f('Valatist', 'Valatistka'), why: `${v} ${n3(v, 'dobljen valat', 'dobljena valata', 'dobljeni valati', 'dobljenih valatov')}.` }; }
  if ((called[me] || 0) >= 3 && called[me] === top(called) && only(called)) return { key: 'klican', text: f('Najbolj klican', 'Najbolj klicana'), why: `${f('Klican', 'Klicana')} ${called[me]}-krat. Nihče ni bil klican večkrat.` };
  if (gamesOf[me] === top(gamesOf) && only(gamesOf) && s.games >= 3) return { key: 'vztrajni', text: f('Vztrajni', 'Vztrajna'), why: `${s.games} ${n3(s.games, 'partija', 'partiji', 'partije', 'partij')}. Nihče ni igral več.` };
  if (phoenix) return { key: 'feniks', text: 'Feniks', why: phoenix === 1 ? `Zmaga v partiji, v kateri si bil${f('', 'a')} v minusu.` : `${phoenix} zmage iz minusa.` };
  const pa = s.table.partner;
  if (pa.total >= 5 && pa.won / pa.total >= 0.8) return { key: 'partner', text: f('Zanesljivi partner', 'Zanesljiva partnerka'), why: `${f('Klican', 'Klicana')} ${pa.total}-krat, ${pa.won} ${n3(pa.won, 'igra dobljena', 'igri dobljeni', 'igre dobljene', 'iger dobljenih')}.` };
  if ((podium[me] || 0) >= 3 && podium[me] === top(podium) && only(podium)) return { key: 'stopnicke', text: 'Na stopničkah', why: `${podium[me]}-krat med prvimi tremi. Nihče večkrat.` };
  if (s.longestStreak >= 2) return { key: 'niz', text: 'V nizu', why: `${s.longestStreak} ${n3(s.longestStreak, 'zmaga', 'zmagi', 'zmage', 'zmag')} zapored.` };
  return { key: 'gost', text: f('Stalni gost', 'Stalna gostja'), why: `${s.games} ${n3(s.games, 'partija', 'partiji', 'partije', 'partij')} za mizo.` };
}

// vsa obdobja igralca (za kroge v profilu): najnovejši najprej, brez tekočega meseca
export function storyPeriods(d: StoryData, name: string, now: Date = new Date()) {
  const cur = monthKeyOf(now.toISOString());
  const months = new Set<string>();
  finishedGames(d).forEach(x => { if (x.ps.some(p => p.name === name)) months.add(monthKeyOf(x.g.created_at)); });
  const list = [...months].filter(k => k < cur).sort().reverse();
  // leto se pokaže po koncu decembra, pred svojim decembrom
  const out: string[] = [];
  list.forEach(k => {
    const y = k.slice(0, 4);
    if (!out.includes(y) && `${y}-12` < cur && list.some(m => m.startsWith(y))) out.push(y);
    out.push(k);
  });
  return out;
}
