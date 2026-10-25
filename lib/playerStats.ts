// =====================================================================
// STATISTIKA IGRALCEV (profil, lestvica, indeks, rivali, dosežki)
// Prestavljeno iz zaslona Zgodovina - logika je NESPREMENJENA, da jo lahko
// uporabljajo vsi zasloni (profil igralca se odpre od koderkoli).
// =====================================================================
import { supabase } from '@/lib/supabase';
import { computeSeasons, monthTitles } from '@/lib/season';
import { computeChallenges } from '@/lib/challenges';

export type H2HStat = { 
    opponent: string; 
    wins: number; 
    losses: number; 
    ties: number; 
    total: number; 
    winPct: number; 
    lossPct: number; 
};

export type GameRecord = { score: number; date: string };

export type PlayerStats = { 
    name: string; 
    wins: number; 
    second: number; 
    third: number; 
    total_games: number; 
    recent_ranks: { rank: number, date: string, gameName: string }[]; 
    performance_scores: number[]; 
    avg_performance: number;     
    prev_performance: number;     
    h2h: Record<string, H2HStat>; 
    best_game: GameRecord | null;
    worst_game: GameRecord | null;
    total_score_sum: number;
    longest_win_streak: number;
    current_win_streak: number; 
    valat_count: number; 
    beggar_wins: number;
    phoenix_count: number;
    dominator_count: number;
    month_titles?: string[];   // naslovi "Igralec meseca" (npr. "Oktober 2026")
    challenges?: Record<string, number>;  // dosežki zbirke Izzivi: id -> kolikokrat
};

// Vsi podatki naenkrat (za Dvoboj): igre, igralci, vpisi in statistika
export type AllData = { games: any[]; players: any[]; entries: any[]; radelci: any[]; stats: PlayerStats[] };
export async function fetchAllData(): Promise<AllData> {
  const [g, p, e, r] = await Promise.all([
    supabase.from('games').select('id, name, created_at, is_active').order('created_at', { ascending: false }),
    supabase.from('players').select('*'),
    supabase.from('score_entries').select('*').order('created_at', { ascending: true }),
    supabase.from('radelci').select('player_id, game_id'),
  ]);
  if (g.error) throw g.error;
  if (p.error) throw p.error;
  if (e.error) throw e.error;
  const games = g.data || [], players = p.data || [], entries = e.data || [], radelci = r.data || [];
  const stats = computePlayerStats(games, players, entries);
  const titles = monthTitles(computeSeasons(games, players));
  const ch = computeChallenges(games, players, entries, radelci).counts;
  stats.forEach(s => { s.month_titles = (titles[s.name] || []).map(m => m.label); s.challenges = ch[s.name] || {}; });
  return { games, players, entries, radelci, stats };
}

// Naloži podatke iz baze in izračuna statistiko vseh igralcev
export async function fetchPlayerStats(): Promise<PlayerStats[]> {
  return (await fetchAllData()).stats;
}

// Izračun statistike (enako kot prej v Zgodovini)
export function computePlayerStats(finishedGames: any[], allPlayers: any[], allEntries: any[]): PlayerStats[] {
        const gameMap = new Map<string, {date: string, name: string}>();
        finishedGames?.forEach(g => gameMap.set(g.id, {date: g.created_at, name: g.name}));


        const statsMap = new Map<string, PlayerStats>();
        const playersByGame = allPlayers.reduce((acc, p) => {
            if (!acc[p.game_id]) acc[p.game_id] = [];
            acc[p.game_id].push(p);
            return acc;
        }, {} as Record<string, typeof allPlayers>);

        const runningScores: any = {}; 
        const phoenixFlags: any = {}; 

        allEntries?.forEach(e => {
            if (!runningScores[e.game_id]) runningScores[e.game_id] = {};
            if (!phoenixFlags[e.game_id]) phoenixFlags[e.game_id] = new Set();
            const gScores = runningScores[e.game_id];
            gScores[e.player_id] = (gScores[e.player_id] || 0) + Number(e.points);
            if (gScores[e.player_id] < 0) phoenixFlags[e.game_id].add(e.player_id);
        });

        finishedGames?.forEach(g => {
            const gameId = g.id;
            const gameP = playersByGame[gameId];
            if(!gameP) return;

            gameP.sort((a, b) => b.total_score - a.total_score);
            const gameInfo = gameMap.get(gameId) || {date: '', name: ''};

            const hasAnyScore = gameP.some(gp => gp.total_score !== 0);

            gameP.forEach((p) => {
                const name = p.name; 
                if (!statsMap.has(name)) {
                    statsMap.set(name, { 
                        name, wins: 0, second: 0, third: 0, total_games: 0, recent_ranks: [], performance_scores: [], avg_performance: 0, prev_performance: 0, h2h: {},
                        best_game: null, worst_game: null, total_score_sum: 0, longest_win_streak: 0, current_win_streak: 0, valat_count: 0, beggar_wins: 0, phoenix_count: 0, dominator_count: 0
                    });
                }
                const stat = statsMap.get(name)!;
                stat.total_games += 1;
                
                const myScore = p.total_score;
                const betterPlayers = gameP.filter(gp => gp.total_score > myScore).length;
                const myRank = betterPlayers + 1;

                if (hasAnyScore) {
                    if (myRank === 1) {
                        stat.wins += 1;
                        if (gameP.length > 1 && (gameP[0].total_score - gameP[1].total_score >= 300)) stat.dominator_count += 1;
                        if (phoenixFlags[gameId]?.has(p.id)) stat.phoenix_count += 1;
                    }
                    if (myRank === 2) stat.second += 1;
                    if (myRank === 3) stat.third += 1;
                }

                stat.recent_ranks.push({ rank: myRank, date: gameInfo.date, gameName: gameInfo.name });
                stat.total_score_sum += myScore;
                if (!stat.best_game || myScore > stat.best_game.score) stat.best_game = { score: myScore, date: gameInfo.date };
                if (!stat.worst_game || myScore < stat.worst_game.score) stat.worst_game = { score: myScore, date: gameInfo.date };

                const opponents = gameP.length - 1; 
                if (opponents > 0 && hasAnyScore) {
                    const beaten = gameP.filter(op => op.total_score < myScore).length;
                    const pct = (beaten / opponents) * 100;
                    stat.performance_scores.push(pct);
                }

                if (hasAnyScore) {
                    gameP.forEach((op) => {
                        if (p.name !== op.name) {
                            if (!stat.h2h[op.name]) stat.h2h[op.name] = { opponent: op.name, wins: 0, losses: 0, ties: 0, total: 0, winPct: 0, lossPct: 0 };
                            stat.h2h[op.name].total += 1;
                            if (p.total_score > op.total_score) stat.h2h[op.name].wins += 1;
                            else if (p.total_score < op.total_score) stat.h2h[op.name].losses += 1;
                            else stat.h2h[op.name].ties += 1;
                        }
                    });
                }
            });
        });

        allEntries?.forEach(e => {
            const playerName = allPlayers.find(ap => ap.id === e.player_id)?.name;
            if (playerName && statsMap.has(playerName)) {
                const pts = Number(e.points);
                const isValat = e.is_valat === true || e.is_valat === 'true';
                const isBeggar = e.is_beggar === true || e.is_beggar === 'true';

                if (isValat && pts > 0) statsMap.get(playerName)!.valat_count += 1;
                if (isBeggar && pts > 0) statsMap.get(playerName)!.beggar_wins += 1;
            }
        });

        const processedStats = Array.from(statsMap.values()).map(stat => {
            stat.recent_ranks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            if (stat.performance_scores.length > 0) {
                const sum = stat.performance_scores.reduce((acc, val) => acc + val, 0);
                stat.avg_performance = sum / stat.performance_scores.length;
                if (stat.performance_scores.length > 1) {
                    const prevScores = stat.performance_scores.slice(1);
                    const prevSum = prevScores.reduce((acc, val) => acc + val, 0);
                    stat.prev_performance = prevSum / prevScores.length;
                } else { stat.prev_performance = stat.avg_performance; }
            } else {
                stat.avg_performance = 0; stat.prev_performance = 0;
            }

            Object.values(stat.h2h).forEach(h => {
                h.winPct = h.total > 0 ? (h.wins / h.total) * 100 : 0;
                h.lossPct = h.total > 0 ? (h.losses / h.total) * 100 : 0;
            });

            let maxStreak = 0; let currentStreak = 0;
            const chronologicalRanks = [...stat.recent_ranks].reverse();
            for (let r of chronologicalRanks) {
                if (r.rank === 1) { currentStreak++; if (currentStreak > maxStreak) maxStreak = currentStreak; } else { currentStreak = 0; }
            }
            stat.longest_win_streak = maxStreak; stat.current_win_streak = currentStreak; 
            return stat;
        });

        return processedStats;
}

export const getFormStatus = (ranks: { rank: number }[]) => {
      if (ranks.length === 0) return { text: '-', color: '#666', icon: '➖' };
      const last5 = ranks.slice(0, 5);
      const wins = last5.filter(r => r.rank === 1).length;
      let totalScore = 0;
      last5.forEach(r => { if (r.rank === 1) totalScore += 10; else if (r.rank === 2) totalScore += 5; else if (r.rank === 3) totalScore += 2; });
      const avgScore = totalScore / last5.length;
      if (wins >= 3) return { text: 'Vroče', color: '#ff4500', icon: '🔥' };
      if (avgScore >= 3.5) return { text: 'Odlična', color: '#22c55e', icon: '🚀' };
      if (avgScore >= 1.5) return { text: 'Srednja', color: '#fbbf24', icon: '😐' };
      return { text: 'Hladna', color: '#94a3b8', icon: '❄️' };
  };

export const getRivals = (h2h: Record<string, H2HStat>) => {
      const qualified = Object.values(h2h).filter(h => h.total >= 3);
      if (qualified.length === 0) return null;
      let stranka = qualified[0]; let mora = qualified[0];
      qualified.forEach(h => { if (h.winPct > stranka.winPct) stranka = h; if (h.lossPct > mora.lossPct) mora = h; });
      let derbi = null;
      if (qualified.length > 2) {
          const availableForDerbi = qualified.filter(h => h.opponent !== stranka.opponent && h.opponent !== mora.opponent);
          if (availableForDerbi.length > 0) {
              derbi = availableForDerbi[0];
              let minDiff = Math.abs(derbi.winPct - 50);
              availableForDerbi.forEach(h => { const diff = Math.abs(h.winPct - 50); if (diff < minDiff) { minDiff = diff; derbi = h; } });
          }
      }
      return { stranka, mora, derbi };
  };
