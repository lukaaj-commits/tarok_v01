// =====================================================================
// DOSEŽKI - zbirka "Izzivi"
// Štejejo samo partije od IZZIVI_START naprej (ne za nazaj).
//
// Izraza:
//   partija = cela igra od "Začni novo igro" do "Zaključi igro"
//   igra    = ena runda v partiji (nekdo igra / berač / valat ...)
// =====================================================================

export const IZZIVI_START = new Date(2026, 9, 25, 0, 0, 0).toISOString(); // 25. 10. 2026
export const IZZIVI = {
  name: 'Izzivi',
  completionTitle: 'TAROK GEEK',
  completionIcon: '🎴',
  reward: 'Nagrada za pravega tarok geeka: Premium tarok karte od ekipe, ta večer ješ in piješ zastonj!',
};

export type ChallengeDef = { id: string; icon: string; title: string; desc: string; threshold: number; live: boolean };

// threshold = kolikokrat se mora zgoditi, da se odklene
// live = obvestilo pride takoj med partijo (sicer ob koncu partije)
export const CHALLENGES: ChallengeDef[] = [
  { id: 'potapljac', icon: '🤿', title: 'Potapljač', desc: 'Trikrat končaj partijo z −300 točkami ali manj.', threshold: 3, live: false },
  { id: 'stotica', icon: '💯', title: 'Stotica', desc: 'Končaj partijo s točno 100 točkami.', threshold: 1, live: false },
  { id: 'nedosegljiv', icon: '🚀', title: 'Nedosegljiv', desc: 'Zmagaj partijo z vsaj 500 točkami prednosti pred drugim.', threshold: 1, live: false },
  { id: 'dvojcka', icon: '👯', title: 'Dvojčka', desc: 'Končaj partijo z enakim številom točk kot drug igralec.', threshold: 1, live: false },
  { id: 'nicla', icon: '0️⃣', title: 'Ničla', desc: 'Končaj partijo s točno 0 točkami (po kazni za radelce).', threshold: 1, live: false },
  { id: 'cistilec', icon: '🧽', title: 'Čistilec', desc: 'Trikrat imej vsaj 3 radelce in jih do konca partije porabi vse.', threshold: 3, live: false },
  { id: 'tisocak', icon: '💶', title: 'Tisočak', desc: 'Končaj partijo z 1000 točkami ali več.', threshold: 1, live: false },
  { id: 'opazovalec', icon: '👀', title: 'Opazovalec', desc: 'V partiji z vsaj 4 igrami ne igraj niti enkrat.', threshold: 1, live: false },
  { id: 'kralj_ulice', icon: '👑', title: 'Kralj ulice', desc: 'Dobi dva berača v isti partiji.', threshold: 1, live: true },
  { id: 'klopar', icon: '🪲', title: 'Klopar', desc: 'Dvakrat bodi kriv za obvezen klop (pristani točno na 0).', threshold: 2, live: true },
  { id: 'senca', icon: '🤝', title: 'Senca', desc: 'Bodi klican 5 iger zapored.', threshold: 1, live: true },
  { id: 'neustavljiv', icon: '🚂', title: 'Neustavljiv', desc: 'Igraj 5 iger zapored.', threshold: 1, live: true },
];

export type CGame = { id: string; created_at: string; is_active: boolean };
export type CPlayer = { id: string; game_id: string; name: string; total_score: number };
export type CEntry = {
  id: string; player_id: string; game_id: string; points: number; created_at: string;
  played?: boolean | null; is_partner?: boolean | null; is_beggar?: boolean | null; is_valat?: boolean | null; is_penalty?: boolean | null;
};
export type CRadelc = { player_id: string; game_id: string };

export type ChallengeEvent = {
  challengeId: string;
  player: string;
  time: string;
  gameId: string;
  count: number;       // katera ponovitev je to (1, 2, 3 ...)
  unlocked: boolean;   // true, ko se s to ponovitvijo dosežek odklene
};

export type ChallengeResult = {
  counts: Record<string, Record<string, number>>; // igralec -> dosežek -> kolikokrat
  events: ChallengeEvent[];
};

const ROUND_WINDOW_MS = 3 * 60 * 1000; // igralec in klicani sta vpisana skoraj hkrati
const isDeclarer = (e: CEntry) => !!(e.played || e.is_beggar || (e.is_valat && !e.is_partner));

export function computeChallenges(games: CGame[], players: CPlayer[], entries: CEntry[], radelci: CRadelc[]): ChallengeResult {
  const counts: ChallengeResult['counts'] = {};
  const events: ChallengeEvent[] = [];
  const thresholdOf = new Map(CHALLENGES.map(c => [c.id, c.threshold]));
  const hit = (challengeId: string, player: string, time: string, gameId: string) => {
    counts[player] = counts[player] || {};
    const n = (counts[player][challengeId] || 0) + 1;
    counts[player][challengeId] = n;
    events.push({ challengeId, player, time, gameId, count: n, unlocked: n === thresholdOf.get(challengeId) });
  };

  const nameOf = new Map(players.map(p => [p.id, p.name]));
  const validGames = games.filter(g => g.created_at >= IZZIVI_START).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const tl: { t: string; order: number; run: () => void }[] = [];

  validGames.forEach(g => {
    const gp = players.filter(p => p.game_id === g.id);
    const ge = entries.filter(e => e.game_id === g.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!gp.length) return;

    // ---------- igre (runde) v partiji ----------
    const declEntries = ge.filter(isDeclarer);
    const rounds = declEntries.map(d => ({ decl: d, partners: new Set<string>() }));
    ge.filter(e => e.is_partner).forEach(pe => {
      const t = new Date(pe.created_at).getTime();
      let best = -1, bestDt = Infinity;
      rounds.forEach((r, i) => {
        if (r.decl.player_id === pe.player_id) return;
        const dt = Math.abs(new Date(r.decl.created_at).getTime() - t);
        if (dt < bestDt) { bestDt = dt; best = i; }
      });
      if (best >= 0 && bestDt <= ROUND_WINDOW_MS) rounds[best].partners.add(pe.player_id);
    });

    // ---------- V ŽIVO ----------
    // Neustavljiv (igra 5 zapored) in Senca (klican 5 zapored)
    const playStreak: Record<string, number> = {}, partnerStreak: Record<string, number> = {};
    rounds.forEach(r => {
      tl.push({ t: r.decl.created_at, order: 1, run: () => {
        gp.forEach(p => {
          playStreak[p.id] = r.decl.player_id === p.id ? (playStreak[p.id] || 0) + 1 : 0;
          if (playStreak[p.id] === 5) { hit('neustavljiv', p.name, r.decl.created_at, g.id); playStreak[p.id] = 0; }
          partnerStreak[p.id] = r.partners.has(p.id) ? (partnerStreak[p.id] || 0) + 1 : 0;
          if (partnerStreak[p.id] === 5) { hit('senca', p.name, r.decl.created_at, g.id); partnerStreak[p.id] = 0; }
        });
      } });
    });

    // Kralj ulice (2 dobljena berača v partiji) in Klopar (kriv za klop)
    const beggarWins: Record<string, number> = {};
    const running: Record<string, number> = {};
    const zeroHits: { e: CEntry }[] = [];
    ge.forEach(e => {
      if (e.is_penalty) return; // kazen ob zaključku ni klop
      running[e.player_id] = (running[e.player_id] || 0) + Number(e.points);
      if (e.is_beggar && e.points > 0) {
        beggarWins[e.player_id] = (beggarWins[e.player_id] || 0) + 1;
        if (beggarWins[e.player_id] === 2) {
          const n = nameOf.get(e.player_id);
          if (n) tl.push({ t: e.created_at, order: 0, run: () => hit('kralj_ulice', n, e.created_at, g.id) });
        }
      }
      if (running[e.player_id] === 0) zeroHits.push({ e });
    });
    zeroHits.forEach(({ e }) => {
      // če v isti igri na 0 pade tudi tisti, ki je igral, je kriv on (ne klicani)
      if (e.is_partner) {
        const round = rounds.find(r => r.partners.has(e.player_id) && Math.abs(new Date(r.decl.created_at).getTime() - new Date(e.created_at).getTime()) <= ROUND_WINDOW_MS);
        if (round && zeroHits.some(z => z.e.id === round.decl.id)) return;
      }
      const n = nameOf.get(e.player_id);
      if (n) tl.push({ t: e.created_at, order: 0, run: () => hit('klopar', n, e.created_at, g.id) });
    });

    // ---------- OB KONCU PARTIJE ----------
    if (g.is_active) return;
    const endTime = ge.length ? ge[ge.length - 1].created_at : g.created_at;
    tl.push({ t: endTime, order: 2, run: () => {
      const sorted = [...gp].sort((a, b) => b.total_score - a.total_score);
      gp.forEach(p => {
        const s = p.total_score;
        if (s <= -300) hit('potapljac', p.name, endTime, g.id);
        if (s === 100) hit('stotica', p.name, endTime, g.id);
        if (s === 0) hit('nicla', p.name, endTime, g.id);
        if (s >= 1000) hit('tisocak', p.name, endTime, g.id);
        if (gp.some(o => o.id !== p.id && o.total_score === s)) hit('dvojcka', p.name, endTime, g.id);
        // Čistilec: vsaj 3 radelci in nobene kazni za neporabljen radelc
        const nRad = radelci.filter(r => r.game_id === g.id && r.player_id === p.id).length;
        const endMs = new Date(endTime).getTime();
        const hadPenalty = ge.some(e => e.player_id === p.id && (e.is_penalty ||
          (!e.played && !e.is_partner && !e.is_beggar && !e.is_valat && e.points < 0 && e.points % 50 === 0 && endMs - new Date(e.created_at).getTime() < 5000)));
        if (nRad >= 3 && !hadPenalty) hit('cistilec', p.name, endTime, g.id);
        // Opazovalec: vsaj 4 igre v partiji, igralec ni igral niti enkrat
        if (rounds.length >= 4 && !rounds.some(r => r.decl.player_id === p.id)) hit('opazovalec', p.name, endTime, g.id);
      });
      // Nedosegljiv: zmaga z vsaj 500 prednosti
      if (sorted.length > 1 && sorted[0].total_score - sorted[1].total_score >= 500) hit('nedosegljiv', sorted[0].name, endTime, g.id);
    } });
  });

  tl.sort((a, b) => a.t.localeCompare(b.t) || a.order - b.order).forEach(x => x.run());
  return { counts, events };
}

// Ali je igralec odklenil vse izzive?
export const allChallengesUnlocked = (c: Record<string, number> | undefined) =>
  !!c && CHALLENGES.every(ch => (c[ch.id] || 0) >= ch.threshold);
