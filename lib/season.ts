// =====================================================================
// SEZONA - mesečna lestvica in Igralec meseca
// =====================================================================

// NASTAVITVE - tukaj jih lahko enostavno spremeniš
export const SEASON = {
  placePoints: [10, 6, 3],  // točke za 1., 2., 3. mesto v igri (ostala mesta 0)
  bestGames: 6,             // šteje najboljših toliko iger v mesecu
  minGames: 3,              // za naslov je treba odigrati vsaj toliko iger
};

export type SeasonGame = { id: string; created_at: string };
export type SeasonPlayer = { game_id: string; name: string; total_score: number };

export type SeasonRow = {
  name: string;
  points: number;     // seštevek najboljših iger
  wins: number;
  second: number;
  third: number;
  index: number;      // indeks % v mesecu (povprečen delež premaganih nasprotnikov)
  games: number;
  eligible: boolean;  // vsaj minGames iger
  rank: number;       // mesto na lestvici (izenačeni imajo isto mesto)
};

export type SeasonMonth = {
  key: string;            // npr. "2026-10"
  year: number;
  month: number;          // 0-11
  label: string;          // "Oktober 2026"
  gameCount: number;
  isCurrent: boolean;     // tekoči mesec (še ni zaključen)
  standings: SeasonRow[];
  champions: string[];    // igralec meseca (prazno, dokler mesec teče)
};

export const MONTH_NAMES = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];
// za stavke "vodi v oktobru"
export const MONTH_LOCATIVE = ['januarju', 'februarju', 'marcu', 'aprilu', 'maju', 'juniju', 'juliju', 'avgustu', 'septembru', 'oktobru', 'novembru', 'decembru'];

export const monthKeyOf = (iso: string) => {
  const d = new Date(iso); // lokalni čas telefona
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Izenačenja: več točk, več zmag, več 2. mest, več 3. mest, višji indeks %
const better = (a: SeasonRow, b: SeasonRow) =>
  a.points !== b.points ? a.points - b.points :
  a.wins !== b.wins ? a.wins - b.wins :
  a.second !== b.second ? a.second - b.second :
  a.third !== b.third ? a.third - b.third :
  a.index - b.index;

// Lestvica za seznam iger enega meseca (vsaka igra = seznam igralcev s končnim seštevkom)
export function standingsFor(gamesPlayers: SeasonPlayer[][]): SeasonRow[] {
  const acc = new Map<string, { results: number[]; perf: number[]; wins: number; second: number; third: number }>();
  gamesPlayers.forEach(gp => {
    if (!gp.length || !gp.some(p => p.total_score !== 0)) return; // prazne igre ne štejejo
    gp.forEach(p => {
      const rank = gp.filter(o => o.total_score > p.total_score).length + 1;
      if (!acc.has(p.name)) acc.set(p.name, { results: [], perf: [], wins: 0, second: 0, third: 0 });
      const x = acc.get(p.name)!;
      x.results.push(SEASON.placePoints[rank - 1] || 0);
      x.perf.push(gp.length > 1 ? (gp.filter(o => o.total_score < p.total_score).length / (gp.length - 1)) * 100 : 0);
      if (rank === 1) x.wins++;
      if (rank === 2) x.second++;
      if (rank === 3) x.third++;
    });
  });
  const rows: SeasonRow[] = [...acc.entries()].map(([name, x]) => ({
    name,
    points: [...x.results].sort((a, b) => b - a).slice(0, SEASON.bestGames).reduce((s, v) => s + v, 0),
    wins: x.wins, second: x.second, third: x.third,
    index: x.perf.length ? x.perf.reduce((s, v) => s + v, 0) / x.perf.length : 0,
    games: x.results.length,
    eligible: x.results.length >= SEASON.minGames,
    rank: 0,
  }));
  // najprej tisti z dovolj igrami, nato ostali
  rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || better(b, a));
  rows.forEach(r => {
    r.rank = rows.filter(o => o.eligible === r.eligible && better(o, r) > 0).length + 1;
  });
  return rows;
}

export function computeSeasons(games: SeasonGame[], players: SeasonPlayer[], now: Date = new Date()): SeasonMonth[] {
  const byGame = new Map<string, SeasonPlayer[]>();
  players.forEach(p => {
    if (!byGame.has(p.game_id)) byGame.set(p.game_id, []);
    byGame.get(p.game_id)!.push(p);
  });
  const byMonth = new Map<string, SeasonPlayer[][]>();
  games.forEach(g => {
    const gp = byGame.get(g.id) || [];
    if (!gp.length || !gp.some(p => p.total_score !== 0)) return;
    const k = monthKeyOf(g.created_at);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(gp);
  });
  const currentKey = monthKeyOf(now.toISOString());
  // tekoči mesec prikažemo tudi, če v njem še ni iger
  if (!byMonth.has(currentKey)) byMonth.set(currentKey, []);

  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // najnovejši najprej
    .map(([key, list]) => {
      const [y, m] = key.split('-').map(Number);
      const standings = standingsFor(list);
      const isCurrent = key >= currentKey;
      const top = standings.filter(r => r.eligible && r.rank === 1);
      return {
        key, year: y, month: m - 1,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        gameCount: list.length,
        isCurrent,
        standings,
        champions: isCurrent ? [] : top.map(r => r.name),
      };
    });
}

// Naslovi "Igralec meseca" za vsakega igralca: ime -> seznam mesecev (najnovejši najprej)
export function monthTitles(months: SeasonMonth[]): Record<string, SeasonMonth[]> {
  const out: Record<string, SeasonMonth[]> = {};
  months.forEach(m => m.champions.forEach(n => { (out[n] = out[n] || []).push(m); }));
  return out;
}
