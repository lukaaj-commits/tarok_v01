// "Za mizo": statistika celotne družbe (vse zaključene igre).
// Pravila (dogovorjeno):
//  - čas večera = čas med vpisi; premori, daljši od 1 ure, se ne štejejo (npr. igra, odprta več dni)
//  - igre, kjer so vsi vpisi narejeni v 5 minutah (vpisane naknadno), se pri času ne štejejo
//  - deljenje (runda) = vpisi z manj kot 90 s razmika; isti igralec ne more imeti dveh vpisov v enem deljenju
//  - valat = en dogodek (par ima dva vpisa, šteje enkrat)

const GAP_MS = 60 * 60 * 1000;
const LATE_ENTRY_MS = 5 * 60 * 1000;
const ROUND_MS = 90 * 1000;

const DAY_SHORT = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
const DAY_LOC = ['ponedeljkih', 'torkih', 'sredah', 'četrtkih', 'petkih', 'sobotah', 'nedeljah'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const MON_NAME = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];

export type TableStats = {
  games: number; since: string | null; deals: number; hours: number; days: number;
  avgMin: number; streak: number; startHour: number | null;
  weekdays: { label: string; n: number }[]; topDay: string;
  months: { label: string; n: number }[]; topMonth: string;
  longest: { date: string; min: number; winner: string } | null;
  mostDeals: { date: string; n: number } | null;
  latest: { date: string; time: string } | null;
  shortest: { date: string; min: number } | null;
  loyal: { name: string; n: number }[];
  lineup: { names: string[]; n: number } | null;
  valats: number; valatsSolo: number; beggars: number;
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('sl-SI');
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}′` : `${Math.round(m)} min`);

export function computeTableStats(d: { games: any[]; players: any[]; entries: any[] }): TableStats {
  const fin = d.games.filter(g => !g.is_active);
  const finIds = new Set(fin.map(g => g.id));
  const E: Record<string, any[]> = {}, P: Record<string, any[]> = {};
  d.entries.forEach(e => { if (finIds.has(e.game_id)) (E[e.game_id] = E[e.game_id] || []).push(e); });
  d.players.forEach(p => { if (finIds.has(p.game_id)) (P[p.game_id] = P[p.game_id] || []).push(p); });

  let totalMin = 0, timedCount = 0, deals = 0;
  // (vrednosti se nastavijo v zanki spodaj)
  let longest = null as TableStats['longest'], shortest = null as TableStats['shortest'];
  let mostDeals = null as TableStats['mostDeals'];
  let latest = null as { date: string; time: string; key: number } | null;
  let valats = 0, valatsSolo = 0, beggars = 0;

  fin.forEach(g => {
    const es = (E[g.id] || []).slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const start = new Date(g.created_at).getTime();
    const ts = es.map(e => new Date(e.created_at).getTime());

    // deljenja
    let n = 0, last = -Infinity, cur: Record<string, true> = {};
    es.forEach((e, i) => { if (ts[i] - last > ROUND_MS || cur[e.player_id]) { n++; cur = {}; } cur[e.player_id] = true; last = ts[i]; });
    deals += n;
    if (!mostDeals || n > mostDeals.n) mostDeals = { date: g.created_at, n };

    // valati (en dogodek na deljenje) in dobljeni berači
    let vLast = -Infinity, vCount = 0;
    es.forEach((e, i) => {
      if (e.is_beggar && Number(e.points) > 0) beggars++;
      if (!e.is_valat || Number(e.points) <= 0) return;
      if (ts[i] - vLast < ROUND_MS) { vCount++; } else { if (vCount === 1) valatsSolo++; valats++; vCount = 1; }
      vLast = ts[i];
    });
    if (vCount === 1) valatsSolo++;

    // čas večera
    if (!ts.length || ts[ts.length - 1] - ts[0] < LATE_ENTRY_MS) return; // vpisano naknadno
    const all = [start, ...ts];
    let min = 0, end = ts[0];
    for (let i = 1; i < all.length; i++) { const gap = all[i] - all[i - 1]; if (gap <= GAP_MS) { min += gap / 60000; end = all[i]; } }
    totalMin += min; timedCount++;
    const winner = [...(P[g.id] || [])].sort((a, b) => b.total_score - a.total_score)[0]?.name || '';
    if (!longest || min > longest.min) longest = { date: g.created_at, min, winner };
    if (!shortest || min < shortest.min) shortest = { date: g.created_at, min };
    const e = new Date(end);
    const key = e.getHours() * 60 + e.getMinutes() + (e.getHours() < 12 ? 1440 : 0); // po polnoči je pozneje
    if (!latest || key > latest.key) latest = { date: g.created_at, time: e.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }), key };
  });

  // dnevi v tednu (pon-ned)
  const wd = [0, 0, 0, 0, 0, 0, 0];
  fin.forEach(g => { wd[(new Date(g.created_at).getDay() + 6) % 7]++; });
  const topDayI = wd.indexOf(Math.max(...wd));

  // meseci (zadnjih 12 z igrami)
  const mc: Record<string, number> = {};
  fin.forEach(g => { const t = new Date(g.created_at); const k = `${t.getFullYear()}-${String(t.getMonth()).padStart(2, '0')}`; mc[k] = (mc[k] || 0) + 1; });
  const mkeys = Object.keys(mc).sort();
  const months: { label: string; n: number }[] = [];
  if (mkeys.length) {
    let [y, m] = mkeys[0].split('-').map(Number);
    const [ly, lm] = mkeys[mkeys.length - 1].split('-').map(Number);
    while (y < ly || (y === ly && m <= lm)) { months.push({ label: MON_SHORT[m], n: mc[`${y}-${String(m).padStart(2, '0')}`] || 0 }); m++; if (m > 11) { m = 0; y++; } }
  }
  const lastMonths = months.slice(-12);
  const topM = mkeys.length ? mkeys.reduce((a, b) => (mc[b] > mc[a] ? b : a)) : null;

  // ura začetka
  const hc: Record<number, number> = {};
  fin.forEach(g => { const h = new Date(g.created_at).getHours(); hc[h] = (hc[h] || 0) + 1; });
  const startHour = Object.keys(hc).length ? Number(Object.keys(hc).reduce((a, b) => (hc[+b] > hc[+a] ? b : a))) : null;

  // niz zaporednih dni z igro
  const days = [...new Set(fin.map(g => ymd(new Date(g.created_at))))].sort();
  let streak = days.length ? 1 : 0, run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
    run = diff === 1 ? run + 1 : 1; streak = Math.max(streak, run);
  }

  // zvesti in zasedba
  const att: Record<string, number> = {}, lineups: Record<string, number> = {};
  fin.forEach(g => {
    const names = [...new Set((P[g.id] || []).map(p => p.name))].sort((a, b) => a.localeCompare(b, 'sl'));
    names.forEach(n => { att[n] = (att[n] || 0) + 1; });
    if (names.length) lineups[names.join('|')] = (lineups[names.join('|')] || 0) + 1;
  });
  const loyal = Object.entries(att).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n }));
  const topL = Object.entries(lineups).sort((a, b) => b[1] - a[1])[0];

  const hours = Math.round(totalMin / 60);
  return {
    games: fin.length,
    since: fin.length ? fin.map(g => g.created_at).sort()[0] : null,
    deals, hours, days: Math.round(hours / 24),
    avgMin: timedCount ? totalMin / timedCount : 0,
    streak, startHour,
    weekdays: DAY_SHORT.map((label, i) => ({ label, n: wd[i] })), topDay: DAY_LOC[topDayI],
    months: lastMonths, topMonth: topM ? MON_NAME[Number(topM.split('-')[1])] : '',
    longest, mostDeals, latest: latest ? { date: latest.date, time: latest.time } : null, shortest,
    loyal, lineup: topL && topL[1] >= 2 ? { names: topL[0].split('|'), n: topL[1] } : null,
    valats, valatsSolo, beggars,
  };
}
