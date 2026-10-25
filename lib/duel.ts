// =====================================================================
// DVOBOJ - primerjava dveh igralcev
// =====================================================================

export type DuelGame = { id: string; created_at: string };
export type DuelPlayer = { id: string; game_id: string; name: string; total_score: number };
export type DuelEntry = { id: string; player_id: string; game_id: string; points: number; created_at: string; played?: boolean | null; is_partner?: boolean | null };

export type DuelResult = {
  common: number;                 // skupne igre
  aAhead: number;                 // kolikokrat je bil A višje
  bAhead: number;
  ties: number;
  last: { winner: 'A' | 'B' | '='; date: string }[];   // zadnjih 5 skupnih iger (najnovejša prva)
  biggest: { winner: 'A' | 'B'; diff: number; date: string } | null; // največja razlika v eni igri
  partner: {
    aCallsB: number; aCallsBWon: number;   // A je igral, B je bil klican
    bCallsA: number; bCallsAWon: number;   // B je igral, A je bil klican
    aPlayed: number; aPlayedWon: number;   // vse igre, ki jih je A igral (s komerkoli)
    bPlayed: number; bPlayedWon: number;
  };
};

// Klicani in igralec v isti rundi sta vpisana skoraj hkrati - povežemo ju po času
const ROUND_WINDOW_MS = 3 * 60 * 1000;

export function computeDuel(a: string, b: string, games: DuelGame[], players: DuelPlayer[], entries: DuelEntry[]): DuelResult {
  const byGame = new Map<string, DuelPlayer[]>();
  players.forEach(p => { if (!byGame.has(p.game_id)) byGame.set(p.game_id, []); byGame.get(p.game_id)!.push(p); });
  const sorted = [...games].sort((x, y) => y.created_at.localeCompare(x.created_at)); // najnovejše najprej

  let aAhead = 0, bAhead = 0, ties = 0;
  const last: DuelResult['last'] = [];
  let biggest: DuelResult['biggest'] = null;
  let common = 0;
  sorted.forEach(g => {
    const gp = byGame.get(g.id) || [];
    if (!gp.some(p => p.total_score !== 0)) return;
    const pa = gp.find(p => p.name === a), pb = gp.find(p => p.name === b);
    if (!pa || !pb) return;
    common++;
    const w: 'A' | 'B' | '=' = pa.total_score > pb.total_score ? 'A' : pa.total_score < pb.total_score ? 'B' : '=';
    if (w === 'A') aAhead++; else if (w === 'B') bAhead++; else ties++;
    if (last.length < 5) last.push({ winner: w, date: g.created_at });
    const diff = Math.abs(pa.total_score - pb.total_score);
    if (w !== '=' && (!biggest || diff > biggest.diff)) biggest = { winner: w, diff, date: g.created_at };
  });

  // partnerstvo: klicani vpis + najbližji vpis igralca (igral) v isti igri
  const nameOf = new Map(players.map(p => [p.id, p.name]));
  const partner = { aCallsB: 0, aCallsBWon: 0, bCallsA: 0, bCallsAWon: 0, aPlayed: 0, aPlayedWon: 0, bPlayed: 0, bPlayedWon: 0 };
  const declarers = entries.filter(e => e.played);
  declarers.forEach(d => {
    const n = nameOf.get(d.player_id);
    if (n === a) { partner.aPlayed++; if (d.points > 0) partner.aPlayedWon++; }
    if (n === b) { partner.bPlayed++; if (d.points > 0) partner.bPlayedWon++; }
  });
  entries.filter(e => e.is_partner).forEach(pe => {
    const partnerName = nameOf.get(pe.player_id);
    if (partnerName !== a && partnerName !== b) return;
    const t = new Date(pe.created_at).getTime();
    let best: DuelEntry | null = null, bestDt = Infinity;
    declarers.forEach(d => {
      if (d.game_id !== pe.game_id || d.player_id === pe.player_id) return;
      const dt = Math.abs(new Date(d.created_at).getTime() - t);
      if (dt < bestDt) { bestDt = dt; best = d; }
    });
    if (!best || bestDt > ROUND_WINDOW_MS) return;
    const decl = best as DuelEntry;
    const declName = nameOf.get(decl.player_id);
    const won = decl.points > 0;
    if (declName === a && partnerName === b) { partner.aCallsB++; if (won) partner.aCallsBWon++; }
    if (declName === b && partnerName === a) { partner.bCallsA++; if (won) partner.bCallsAWon++; }
  });

  return { common, aAhead, bAhead, ties, last, biggest, partner };
}
