// Zanimivosti za začetni zaslon: vsakič ena naključna, kratka, v stavku.
// Vsaka zanimivost je seznam delov; "strong" deli (imena, številke) so poudarjeni.
import { getData } from '@/lib/dataCache';
import { computeSeasons, MONTH_LOCATIVE } from '@/lib/season';
import { fetchPlayerStats } from '@/lib/playerStats';
import { g } from '@/lib/gender';
import { computeRecords } from '@/lib/records';
import { CHALLENGES } from '@/lib/challenges';

export type FactPart = { t: string; strong?: boolean };
export type Fact = { key: string; parts: FactPart[] };

const MONTH_GENITIVE = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
const igerWord = (n: number) => { const r = n % 100; return r === 1 ? 'igro' : r === 2 ? 'igri' : r === 3 || r === 4 ? 'igre' : 'iger'; };
const S = (t: string): FactPart => ({ t, strong: true });
const T = (t: string): FactPart => ({ t });

// vrne imena tistih z največjo vrednostjo (samo če je vrednost > 0 in sta največ dva)
function leaders<X>(list: X[], val: (x: X) => number, name: (x: X) => string, min = 1): string[] | null {
  const max = Math.max(-Infinity, ...list.map(val));
  if (!isFinite(max) || max < min) return null;
  const top = list.filter(x => val(x) === max).map(name);
  return top.length >= 1 && top.length <= 2 ? top : null;
}
const verbIma = (names: string[]) => (names.length === 1 ? 'ima' : 'imata');
const joinNames = (names: string[]) => names.join(' & ');

export async function buildFacts(finishedCount: number | null): Promise<Fact[]> {
  const facts: Fact[] = [];
  const d = await getData();
  const stats = await fetchPlayerStats(); // naloži tudi spol igralcev

  // 1) število iger
  if (finishedCount !== null && finishedCount >= 10) facts.push({ key: 'games', parts: [T('Odigrali smo že '), S(String(finishedCount)), T(' ' + igerWord(finishedCount))] });

  // 2) mesec: vodilni, število iger, zadnji igralec meseca
  const months = computeSeasons(d.games, d.players);
  const cur = months.find(m => m.isCurrent);
  if (cur) {
    const top = cur.standings.filter(r => r.eligible && r.rank === 1).map(r => r.name);
    if (top.length >= 1 && top.length <= 2) {
      facts.push({ key: 'monthLead', parts: [T(`V ${MONTH_LOCATIVE[cur.month]} ${top.length === 1 ? 'vodi' : 'vodita'} `), S(joinNames(top))] });
    }
    if (cur.gameCount >= 10) facts.push({ key: 'monthGames', parts: [T('Ta mesec smo odigrali že '), S(String(cur.gameCount)), T(' ' + igerWord(cur.gameCount))] });
  }
  const lastChamp = months.find(m => !m.isCurrent && m.champions.length === 1);
  if (lastChamp) {
    const n = lastChamp.champions[0];
    facts.push({ key: 'champion', parts: [S(n), T(` je ${g(n, 'igralec', 'igralka')} meseca ${MONTH_GENITIVE[lastChamp.month]}`)] });
  }

  // 3) zadnji zmagovalec (zadnja zaključena igra)
  const lastGame = d.games.filter(x => !x.is_active).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (lastGame) {
    const gp = d.players.filter(p => p.game_id === lastGame.id);
    if (gp.length) {
      const max = Math.max(...gp.map(p => p.total_score));
      const w = gp.filter(p => p.total_score === max).map(p => p.name);
      if (w.length === 1) facts.push({ key: 'lastWinner', parts: [T(g(w[0], 'Zadnji zmagovalec: ', 'Zadnja zmagovalka: ')), S(w[0])] });
      else if (w.length === 2) facts.push({ key: 'lastWinner', parts: [T('Zadnja zmagovalca: '), S(joinNames(w))] });
    }
  }

  // 4) vsi rekordi (enako kot zavihek Rekordi na Lestvici)
  const REC: Record<string, string> = {
    'best-game': 'Najvišji rezultat igre',
    'worst-game': 'Najnižji rezultat igre',
    'best-entry': 'Največji posamezni vpis',
    'worst-entry': 'Največji posamezni minus',
    'margin': 'Najvišjo prednost pred drugim',
    'wins': 'Največ zmag',
    'games': 'Največ odigranih iger',
    'career': 'Največ točk v karieri',
    'valats': 'Največ valatov',
    'beggars': 'Največ dobljenih beračev',
    'streak': 'Najdaljši niz zmag',
    'titles': 'Največ naslovov meseca',
  };
  computeRecords(d.games, d.players, d.entries).forEach(r => {
    if (r.id === 'marathon') {
      const n = parseInt(r.value, 10);
      if (n > 0) facts.push({ key: 'rec-marathon', parts: [T('Najdaljša igra je imela '), S(String(n)), T(' vpisov')] });
      return;
    }
    const label = REC[r.id];
    if (!label || r.holders.length < 1 || r.holders.length > 2) return;
    if (r.id === 'streak' && parseInt(r.value, 10) < 3) return;
    facts.push({ key: 'rec-' + r.id, parts: [T(`${label} ${verbIma(r.holders)} `), S(joinNames(r.holders))] });
  });

  // 5) iz statistike igralcev
  const add = (key: string, label: string, names: string[] | null) => { if (names) facts.push({ key, parts: [T(`${label} ${verbIma(names)} `), S(joinNames(names))] }); };
  add('index', 'Najboljši indeks', leaders(stats.filter(s => s.total_games >= 5), s => s.avg_performance, s => s.name));
  // največ odklenjenih izzivov
  const unlocked = (s: any) => CHALLENGES.filter(c => (s.challenges?.[c.id] || 0) >= c.threshold).length;
  const ch = leaders(stats, unlocked, s => s.name);
  if (ch && ch.length === 1) facts.push({ key: 'challenges', parts: [T('Največ izzivov '), T(g(ch[0], 'je odklenil ', 'je odklenila ')), S(ch[0])] });

  // Grand Slam: vseh 5 dosežkov v profilu (enaki pogoji kot v Profilu igralca)
  const gs = stats.filter(x => x.longest_win_streak >= 3 && x.valat_count >= 2 && x.phoenix_count >= 3 && x.beggar_wins >= 5 && x.dominator_count >= 3).map(x => x.name);
  if (gs.length === 0) facts.push({ key: 'grandslam', parts: [T('Grand Slama še nihče ni osvojil')] });
  else if (gs.length === 1) facts.push({ key: 'grandslam', parts: [T(g(gs[0], 'Grand Slam je osvojil ', 'Grand Slam je osvojila ')), S(gs[0])] });
  else if (gs.length === 2) facts.push({ key: 'grandslam', parts: [T('Grand Slam imata '), S(joinNames(gs))] });
  else facts.push({ key: 'grandslam', parts: [T('Grand Slam ima že '), S(String(gs.length)), T(' igralcev')] });

  // 6) trenutni niz zmag (vsaj 3, en igralec)
  const hot = leaders(stats, s => s.current_win_streak, s => s.name, 3);
  if (hot && hot.length === 1) {
    const s = stats.find(x => x.name === hot[0])!;
    facts.push({ key: 'hot', parts: [S(hot[0]), T(` je ${g(hot[0], 'zmagal', 'zmagala')} `), S(String(s.current_win_streak)), T('-krat zapored')] });
  }

  // 7) največkrat klican (vse igre)
  const nameOf = new Map(d.players.map(p => [p.id, p.name]));
  const called: Record<string, number> = {};
  d.entries.forEach(e => { if (e.is_partner) { const n = nameOf.get(e.player_id); if (n) called[n] = (called[n] || 0) + 1; } });
  const cl = leaders(Object.entries(called), x => x[1], x => x[0]);
  if (cl && cl.length === 1) facts.push({ key: 'called', parts: [T(g(cl[0], 'Največkrat klican je ', 'Največkrat klicana je ')), S(cl[0])] });

  // 8) najpogostejši par za mizo (skupaj odigrane igre)
  const pairs: Record<string, number> = {};
  const finished = new Set(d.games.filter(x => !x.is_active).map(x => x.id));
  const byGame = new Map<string, string[]>();
  d.players.forEach(p => { if (finished.has(p.game_id)) byGame.set(p.game_id, [...(byGame.get(p.game_id) || []), p.name]); });
  byGame.forEach(names => {
    const u = [...new Set(names)].sort();
    for (let a = 0; a < u.length; a++) for (let b = a + 1; b < u.length; b++) { const k = u[a] + '|' + u[b]; pairs[k] = (pairs[k] || 0) + 1; }
  });
  const pr = leaders(Object.entries(pairs), x => x[1], x => x[0], 10);
  if (pr && pr.length === 1) {
    const [a, b] = pr[0].split('|');
    facts.push({ key: 'pair', parts: [S(a), T(' in '), S(b), T(': že '), S(String(pairs[pr[0]])), T(' skupnih iger')] });
  }

  // 9) ta mesec največ iger
  if (cur) {
    const most = leaders(cur.standings, r => r.games, r => r.name, 3);
    if (most && most.length === 1) facts.push({ key: 'monthMost', parts: [T('Ta mesec je največ '), T(g(most[0], 'igral ', 'igrala ')), S(most[0])] });
  }
  // varovalka: predolgi stavki ne gredo v eno vrstico na telefonu
  return facts.filter(f => f.parts.reduce((n, p) => n + p.t.length, 0) <= 40);
}

// naključna zanimivost, ki ni enaka prejšnji
let lastKey: string | null = null;
export function pickFact(facts: Fact[]): Fact | null {
  if (!facts.length) return null;
  const pool = facts.length > 1 ? facts.filter(f => f.key !== lastKey) : facts;
  const f = pool[Math.floor(Math.random() * pool.length)];
  lastKey = f.key;
  return f;
}
