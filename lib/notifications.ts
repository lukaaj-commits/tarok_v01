// =====================================================================
// OBVESTILA (zvonček)
// Vsa obvestila se izračunajo iz obstoječih podatkov v bazi (igre, igralci,
// vpisi točk). V bazi se zanje nič ne shranjuje. Če se vpis razveljavi,
// obvestilo samo izgine.
//
// Dve vrsti obvestil:
//  - 'live' (V ŽIVO): se pojavijo takoj ob vpisu točk med igro
//  - 'end'  (OB KONCU IGRE): se pojavijo, ko je igra zaključena
// =====================================================================

import { standingsFor, computeSeasons, monthKeyOf, MONTH_LOCATIVE, SeasonPlayer } from '@/lib/season';
import { computeChallenges, CHALLENGES, IZZIVI, CRadelc } from '@/lib/challenges';

export type NotifGame = { id: string; name: string; created_at: string; is_active: boolean };
export type NotifPlayer = { id: string; game_id: string; name: string; total_score: number };
export type NotifEntry = {
  id: string;
  player_id: string;
  game_id: string;
  points: number;
  created_at: string;
  played?: boolean | null;
  is_partner?: boolean | null;
  is_beggar?: boolean | null;
  is_valat?: boolean | null;
  is_penalty?: boolean | null;
};

export type NotificationKind = 'live' | 'end';

export type AppNotification = {
  id: string;            // stalen ključ (za prebrano/neprebrano)
  kind: NotificationKind;
  time: string;          // ISO čas dogodka
  gameId: string;
  icon: string;
  title: string;
  text: string;
  player?: string;       // ime igralca (za avatar)
};

export type GameSummary = {
  gameId: string;
  time: string;
  gameDate: string;
  winners: string;
  winnerScore: number;
  awards: string[];
  items: AppNotification[]; // obvestila ob koncu te igre
};

// ---------------------------------------------------------------------
// NASTAVITVE (pragovi) - tukaj jih lahko enostavno spreminjaš
// ---------------------------------------------------------------------
export const SETTINGS = {
  hotHandStreak: 5,                 // Vroča roka: toliko dobljenih iger zapored kot igralec
  partnerStreak: 3,                 // Večni par: toliko klicev zapored
  careerPointsStep: 5000,           // Mejnik kariernih točk na vsakih X točk
  beggarMilestoneStep: 5,           // Mejnik dobljenih beračev: 10., 15., 20. ... (5. = dosežek Kralj beračev)
  photoFinishMargin: 10,            // Fotofiniš: zmaga za največ toliko točk
  comebackMinDeficit: 50,           // Comeback: zmagovalec je bil med igro vsaj toliko v minusu
  revengeMinLossPct: 60,            // Maščevanje: proti temu nasprotniku izgubi vsaj toliko % iger
  winStreakMin: 3,                  // Niz zmag: obvestilo od toliko zmag zapored naprej
  brokenStreakMin: 3,               // Prekinjen niz: niz vsaj toliko zmag
  droughtGames: 10,                 // Konec suše: zmaga po vsaj toliko igrah brez zmage
  gameMilestones: [50, 100, 150, 200, 250, 300, 400, 500],
  winMilestones: [10, 25, 50, 75, 100, 150, 200],
  minEntriesForEntryRecord: 200,    // rekordni vpis šele, ko je v bazi dovolj zgodovine
  minGamesForGroupRecord: 10,       // rekord družbe šele po toliko zaključenih igrah
  minGamesForPersonalRecord: 3,     // osebni rekord šele po toliko igrah igralca
  indexMinGames: 5,                 // indeks % (enako kot v lestvici)
};

// ---------------------------------------------------------------------
// VEČNI DOSEŽKI - en seznam za vse. Nov dosežek dodaš sem.
// Za vsak dosežek: kako se izračuna napredek in kdaj je odklenjen.
// ---------------------------------------------------------------------
type CareerStats = {
  name: string;
  games: number;
  wins: number;
  second: number;
  third: number;
  currentStreak: number;
  longestStreak: number;
  gamesSinceWin: number;
  valats: number;
  beggarWins: number;
  phoenix: number;
  dominator: number;
  careerPoints: number;      // vsota vseh vpisov
  bestGame: number | null;
  worstGame: number | null;
  performance: number[];     // % premaganih nasprotnikov po igrah
  recentRanks: number[];     // najnovejše na koncu
  h2h: Record<string, { wins: number; losses: number; total: number }>;
  unlocked: Set<string>;
  milestonesPassed: Set<number>;
};

export type AchievementDef = {
  id: string;
  title: string;
  icon: string;
  isUnlocked: (s: CareerStats) => boolean;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'metla', title: 'Zlata metla', icon: '🧹', isUnlocked: s => s.longestStreak >= 3 },
  { id: 'valat', title: 'Kralj valatov', icon: '⚡', isUnlocked: s => s.valats >= 2 },
  { id: 'feniks', title: 'Feniks', icon: '🦅', isUnlocked: s => s.phoenix >= 3 },
  { id: 'berac', title: 'Kralj beračev', icon: '🙏', isUnlocked: s => s.beggarWins >= 5 },
  { id: 'dominator', title: 'Gospodar mize', icon: '👑', isUnlocked: s => s.dominator >= 3 },
];

// ---------------------------------------------------------------------
const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const fmtBig = (n: number) => n.toLocaleString('sl-SI');
const dateSl = (iso: string) => new Date(iso).toLocaleDateString('sl-SI');
// slovnica: 1 zmaga, 2 zmagi, 3-4 zmage, 5+ zmag
const igerZapored = (n: number) => (n === 2 ? 'dobljeni igri' : n === 3 || n === 4 ? 'dobljene igre' : 'dobljenih iger');
const klicev = (n: number) => (n === 2 ? 'klica' : n === 3 || n === 4 ? 'klici' : 'klicev');
const zmag = (n: number) => (n % 100 === 1 ? 'zmaga' : n % 100 === 2 ? 'zmagi' : n % 100 === 3 || n % 100 === 4 ? 'zmage' : 'zmag');

export function computeNotifications(
  games: NotifGame[],
  players: NotifPlayer[],
  entries: NotifEntry[],
  radelci: CRadelc[] = []
): { live: AppNotification[]; summaries: GameSummary[] } {
  const live: AppNotification[] = [];
  const summaries: GameSummary[] = [];

  const playerById = new Map(players.map(p => [p.id, p]));
  const playersByGame = new Map<string, NotifPlayer[]>();
  players.forEach(p => {
    if (!playersByGame.has(p.game_id)) playersByGame.set(p.game_id, []);
    playersByGame.get(p.game_id)!.push(p);
  });
  const sortedEntries = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const entriesByGame = new Map<string, NotifEntry[]>();
  sortedEntries.forEach(e => {
    if (!entriesByGame.has(e.game_id)) entriesByGame.set(e.game_id, []);
    entriesByGame.get(e.game_id)!.push(e);
  });

  // --- skupna stanja
  const career = new Map<string, CareerStats>();
  const getCareer = (name: string): CareerStats => {
    if (!career.has(name)) {
      career.set(name, {
        name, games: 0, wins: 0, second: 0, third: 0, currentStreak: 0, longestStreak: 0,
        gamesSinceWin: 0, valats: 0, beggarWins: 0, phoenix: 0, dominator: 0, careerPoints: 0,
        bestGame: null, worstGame: null, performance: [], recentRanks: [], h2h: {},
        unlocked: new Set(), milestonesPassed: new Set(),
      });
    }
    return career.get(name)!;
  };

  // Preveri večne dosežke in vrne nova obvestila (tudi Grand Slam)
  const checkAchievements = (s: CareerStats, kind: NotificationKind, gameId: string, time: string, push: (n: AppNotification) => void) => {
    ACHIEVEMENTS.forEach(a => {
      if (!s.unlocked.has(a.id) && a.isUnlocked(s)) {
        s.unlocked.add(a.id);
        push({ id: `ach:${a.id}:${s.name}`, kind, time, gameId, icon: a.icon, title: `Nov dosežek: ${a.title}`, text: s.name, player: s.name });
      }
    });
    if (!s.unlocked.has('grandslam') && ACHIEVEMENTS.every(a => s.unlocked.has(a.id))) {
      s.unlocked.add('grandslam');
      push({ id: `ach:grandslam:${s.name}`, kind, time, gameId, icon: '🏆', title: 'GRAND SLAM!', text: `${s.name}: vse značke! Vsak plača pivo 🍻`, player: s.name });
    }
  };

  // --- časovnica: vsak vpis + konec vsake zaključene igre
  type Ev = { t: string; order: number; entry?: NotifEntry; game?: NotifGame };
  const timeline: Ev[] = sortedEntries.map(e => ({ t: e.created_at, order: 0, entry: e }));
  games.forEach(g => {
    if (g.is_active) return;
    const ge = entriesByGame.get(g.id) || [];
    const endTime = ge.length ? ge[ge.length - 1].created_at : g.created_at;
    timeline.push({ t: endTime, order: 1, game: g });
  });
  timeline.sort((a, b) => a.t.localeCompare(b.t) || a.order - b.order);

  // stanja za obvestila v živo
  let entryCount = 0;
  let maxEntry: number | null = null;
  let minEntry: number | null = null;
  const gameRunning = new Map<string, Map<string, number>>();   // igra -> igralec -> trenutne točke
  const gamePhoenix = new Map<string, Set<string>>();           // igra -> igralci, ki so bili v minusu
  const gameMinRun = new Map<string, number>();                 // igra|igralec -> najnižji seštevek med igro
  const hotHand = new Map<string, number>();                    // igra|igralec -> zaporedne zmage kot igralec
  const lastPartners = new Map<string, string[]>();             // igra -> zadnji klicani

  // stanja za obvestila ob koncu
  let finishedGames = 0;
  let groupBest: number | null = null;
  let groupWorst: number | null = null;
  let maxEntriesInGame: number | null = null;
  let indexLeader: string | null = null;
  const monthGames = new Map<string, SeasonPlayer[][]>();          // mesec -> zaključene igre (za vodjo meseca)

  // Lestvica "po zmagah": več zmag, nato več 2. mest, nato več 3. mest (enako kot v Zgodovini)
  type Triple = { wins: number; second: number; third: number };
  const betterTriple = (a: Triple, b: Triple) =>
    a.wins !== b.wins ? a.wins > b.wins : a.second !== b.second ? a.second > b.second : a.third > b.third;
  const classicRanks = () => {
    const list = [...career.values()].filter(s => s.games > 0);
    const ranks = new Map<string, number>();
    list.forEach(s => ranks.set(s.name, 1 + list.filter(o => betterTriple(o, s)).length));
    return { ranks };
  };
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  for (const ev of timeline) {
    // ================= V ŽIVO (ob vsakem vpisu) =================
    if (ev.entry) {
      const e = ev.entry;
      const p = playerById.get(e.player_id);
      if (!p) continue;
      const name = p.name;
      const s = getCareer(name);
      const pts = Number(e.points);
      const t = e.created_at;
      const push = (n: AppNotification) => live.push(n);
      entryCount++;

      // trenutni seštevek v igri
      if (!gameRunning.has(e.game_id)) gameRunning.set(e.game_id, new Map());
      const run = gameRunning.get(e.game_id)!;
      const newRun = (run.get(e.player_id) || 0) + pts;
      run.set(e.player_id, newRun);
      const minKey = `${e.game_id}|${e.player_id}`;
      gameMinRun.set(minKey, Math.min(gameMinRun.get(minKey) ?? 0, newRun));
      if (newRun < 0) {
        if (!gamePhoenix.has(e.game_id)) gamePhoenix.set(e.game_id, new Set());
        gamePhoenix.get(e.game_id)!.add(e.player_id);
      }

      // 1) Valat
      if (e.is_valat && pts > 0) {
        s.valats++;
        push({ id: `valat:${e.id}`, kind: 'live', time: t, gameId: e.game_id, icon: '⚡', title: 'Valat!', text: `${name}: ${fmt(pts)}`, player: name });
      }
      // dobljen berač (samo za dosežek, brez lastnega obvestila)
      if (e.is_beggar && pts > 0) {
        s.beggarWins++;
        // 5. berač odklene "Kralj beračev" (spodaj), nato mejnik na vsakih 5 (10., 15., 20. ...)
        if (s.beggarWins > SETTINGS.beggarMilestoneStep && s.beggarWins % SETTINGS.beggarMilestoneStep === 0) {
          push({ id: `beggar:${s.beggarWins}:${name}`, kind: 'live', time: t, gameId: e.game_id, icon: '🙏', title: 'Mejnik', text: `${name}: ${s.beggarWins}. dobljeni berač`, player: name });
        }
      }

      // 2) + 3) Rekordni vpis / rekordni minus vseh časov
      if (entryCount > SETTINGS.minEntriesForEntryRecord) {
        if (maxEntry !== null && pts > maxEntry) push({ id: `rec-max:${e.id}`, kind: 'live', time: t, gameId: e.game_id, icon: '💥', title: 'Rekordni vpis vseh časov', text: `${name}: ${fmt(pts)} (prej ${fmt(maxEntry)})`, player: name });
        if (minEntry !== null && pts < minEntry) push({ id: `rec-min:${e.id}`, kind: 'live', time: t, gameId: e.game_id, icon: '💀', title: 'Rekordni minus vseh časov', text: `${name}: ${fmt(pts)} (prej ${fmt(minEntry)})`, player: name });
      }
      maxEntry = maxEntry === null ? pts : Math.max(maxEntry, pts);
      minEntry = minEntry === null ? pts : Math.min(minEntry, pts);

      // 4) Vroča roka: dobljene igre zapored kot igralec (igral ali berač)
      if (e.played || e.is_beggar) {
        const key = `${e.game_id}|${e.player_id}`;
        const streak = pts > 0 ? (hotHand.get(key) || 0) + 1 : 0;
        hotHand.set(key, streak);
        if (streak === SETTINGS.hotHandStreak) push({ id: `hot:${e.id}`, kind: 'live', time: t, gameId: e.game_id, icon: '🔥', title: 'Vroča roka', text: `${name}: ${streak} ${igerZapored(streak)} zapored`, player: name });
      }

      // 5) Večni par: isti igralec klican večkrat zapored
      if (e.is_partner) {
        const list = [...(lastPartners.get(e.game_id) || []), e.player_id].slice(-SETTINGS.partnerStreak);
        lastPartners.set(e.game_id, list);
        if (list.length === SETTINGS.partnerStreak && list.every(x => x === e.player_id)) {
          push({ id: `pair:${e.id}`, kind: 'live', time: t, gameId: e.game_id, icon: '🤝', title: 'Večni par', text: `${name}: ${SETTINGS.partnerStreak} ${klicev(SETTINGS.partnerStreak)} zapored`, player: name });
          lastPartners.set(e.game_id, []); // naslednje obvestilo šele po novih 3 klicih
        }
      }

      // 6) Obvezen klop: igralec pade točno na 0
      if (newRun === 0 && pts !== 0) push({ id: `klop:${e.id}`, kind: 'live', time: t, gameId: e.game_id, icon: '0️⃣', title: 'Obvezen klop!', text: `${name} je na 0 točkah`, player: name });

      // 7) Mejnik kariernih točk
      s.careerPoints += pts;
      const step = SETTINGS.careerPointsStep;
      const reached = Math.floor(s.careerPoints / step) * step;
      if (reached >= step && !s.milestonesPassed.has(reached)) {
        // vse vmesne mejnike označimo, obvestimo samo za najvišjega
        for (let m = step; m <= reached; m += step) s.milestonesPassed.add(m);
        push({ id: `pts:${reached}:${name}`, kind: 'live', time: t, gameId: e.game_id, icon: '🎯', title: 'Mejnik', text: `${name}: ${fmtBig(reached)} kariernih točk`, player: name });
      }

      // Večni dosežki, ki se štejejo po vpisih (Kralj valatov, Kralj beračev)
      checkAchievements(s, 'live', e.game_id, t, push);
      continue;
    }

    // ================= OB KONCU IGRE =================
    const g = ev.game!;
    const gp = (playersByGame.get(g.id) || []).slice().sort((a, b) => b.total_score - a.total_score);
    if (gp.length === 0) continue;
    const hasAnyScore = gp.some(p => p.total_score !== 0);
    if (!hasAnyScore) continue;
    const t = ev.t;
    const items: AppNotification[] = [];
    const push = (n: AppNotification) => items.push({ ...n, kind: 'end', gameId: g.id });
    const ge = entriesByGame.get(g.id) || [];

    const rankOf = (p: NotifPlayer) => gp.filter(o => o.total_score > p.total_score).length + 1;
    const maxScore = gp[0].total_score;
    const winners = gp.filter(p => p.total_score === maxScore);
    const winnerNames = winners.map(w => w.name);
    const secondScore = gp.find(p => p.total_score < maxScore)?.total_score;

    // stanje lestvice in indeksa PRED to igro
    const before = classicRanks();
    const beforeStats = new Map([...career.values()].map(s => [s.name, { wins: s.wins, second: s.second, third: s.third, games: s.games }]));
    const hotBefore = new Map([...career.values()].map(s => [s.name, s.recentRanks.slice(-5).filter(r => r === 1).length >= 3]));
    // "Trn v peti" za vsakega zmagovalca pred to igro
    const thornBefore = new Map<string, string>();
    winnerNames.forEach(n => {
      const s = career.get(n);
      if (!s) return;
      const q = Object.entries(s.h2h).filter(([, h]) => h.total >= 3);
      if (!q.length) return;
      q.sort((a, b) => b[1].losses / b[1].total - a[1].losses / a[1].total);
      if ((q[0][1].losses / q[0][1].total) * 100 >= SETTINGS.revengeMinLossPct) thornBefore.set(n, q[0][0]);
    });
    // nizi pred igro (za prekinjen niz)
    const streaksBefore = new Map(gp.map(p => [p.name, getCareer(p.name).currentStreak]));

    // posodobi kariero
    gp.forEach(p => {
      const s = getCareer(p.name);
      const rank = rankOf(p);
      const score = p.total_score;
      const prevBest = s.bestGame, prevWorst = s.worstGame, prevGames = s.games;
      s.games++;
      s.recentRanks.push(rank);
      if (rank === 1) {
        s.wins++;
        s.currentStreak++;
        s.longestStreak = Math.max(s.longestStreak, s.currentStreak);
        if (secondScore !== undefined && winners.length === 1 && maxScore - secondScore >= 300) s.dominator++;
        if (gamePhoenix.get(g.id)?.has(p.id)) s.phoenix++;
      } else {
        s.currentStreak = 0;
      }
      if (rank === 2) s.second++;
      if (rank === 3) s.third++;
      if (gp.length > 1) s.performance.push((gp.filter(o => o.total_score < score).length / (gp.length - 1)) * 100);
      gp.forEach(o => {
        if (o.name === p.name) return;
        if (!s.h2h[o.name]) s.h2h[o.name] = { wins: 0, losses: 0, total: 0 };
        s.h2h[o.name].total++;
        if (score > o.total_score) s.h2h[o.name].wins++;
        else if (score < o.total_score) s.h2h[o.name].losses++;
      });
      s.bestGame = prevBest === null ? score : Math.max(prevBest, score);
      s.worstGame = prevWorst === null ? score : Math.min(prevWorst, score);

      // Osebni rekord / Črni dan
      if (prevGames >= SETTINGS.minGamesForPersonalRecord) {
        if (prevBest !== null && score > prevBest) push({ id: `pb:${g.id}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '📈', title: 'Osebni rekord', text: `${p.name}: ${fmt(score)} (prej ${fmt(prevBest)})`, player: p.name });
        if (prevWorst !== null && score < prevWorst) push({ id: `pw:${g.id}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '📉', title: 'Črni dan', text: `${p.name}: ${fmt(score)} (prej ${fmt(prevWorst)})`, player: p.name });
      }
      // Mejniki iger in zmag
      if (SETTINGS.gameMilestones.includes(s.games)) push({ id: `mg:${s.games}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '🎯', title: 'Mejnik', text: `${p.name}: ${s.games}. igra`, player: p.name });
      if (rank === 1) {
        if (s.wins === 1) push({ id: `firstwin:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '🎉', title: 'Prva zmaga v karieri', text: p.name, player: p.name });
        else if (SETTINGS.winMilestones.includes(s.wins)) push({ id: `mw:${s.wins}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '🎯', title: 'Mejnik', text: `${p.name}: ${s.wins}. zmaga`, player: p.name });
        if (s.wins > 1 && s.gamesSinceWin >= SETTINGS.droughtGames) push({ id: `drought:${g.id}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '🌧️', title: 'Konec suše', text: `${p.name}: zmaga po ${s.gamesSinceWin} igrah`, player: p.name });
        s.gamesSinceWin = 0;
      } else {
        s.gamesSinceWin++;
      }
    });

    // Niz zmag / prekinjen niz
    winnerNames.forEach(n => {
      const st = getCareer(n).currentStreak;
      if (st >= SETTINGS.winStreakMin) push({ id: `streak:${g.id}:${n}`, kind: 'end', time: t, gameId: g.id, icon: '🔥', title: 'Niz zmag', text: `${n}: ${st} ${zmag(st)} zapored`, player: n });
    });
    gp.forEach(p => {
      const was = streaksBefore.get(p.name) || 0;
      if (was >= SETTINGS.brokenStreakMin && rankOf(p) !== 1) push({ id: `broken:${g.id}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '✂️', title: 'Prekinjen niz', text: `${winnerNames.join(' & ')} prekine niz: ${p.name} (${was} ${zmag(was)} zapored)`, player: winnerNames[0] });
    });

    // Fotofiniš, comeback
    if (winners.length === 1 && secondScore !== undefined && maxScore - secondScore <= SETTINGS.photoFinishMargin) {
      const second = gp.find(p => p.total_score === secondScore)!;
      push({ id: `photo:${g.id}`, kind: 'end', time: t, gameId: g.id, icon: '📸', title: 'Fotofiniš', text: `${winners[0].name} pred ${second.name} za ${maxScore - secondScore} točk`, player: winners[0].name });
    }
    winners.forEach(w => {
      const low = gameMinRun.get(`${g.id}|${w.id}`) ?? 0;
      if (low <= -SETTINGS.comebackMinDeficit) push({ id: `comeback:${g.id}:${w.name}`, kind: 'end', time: t, gameId: g.id, icon: '🚀', title: 'Comeback', text: `${w.name}: zmaga po tem, ko je bilo stanje ${low}`, player: w.name });
    });

    // Maščevanje "Trnu v peti"
    winnerNames.forEach(n => {
      const thorn = thornBefore.get(n);
      if (thorn && gp.some(p => p.name === thorn)) push({ id: `revenge:${g.id}:${n}`, kind: 'end', time: t, gameId: g.id, icon: '⚔️', title: 'Maščevanje', text: `${n} premaga svoj Trn v peti: ${thorn}`, player: n });
    });

    // Rekordi družbe in maraton
    finishedGames++;
    if (finishedGames > SETTINGS.minGamesForGroupRecord) {
      if (groupBest !== null && maxScore > groupBest) push({ id: `gbest:${g.id}`, kind: 'end', time: t, gameId: g.id, icon: '🏆', title: 'Rekord družbe', text: `Najvišji rezultat vseh časov: ${winnerNames.join(' & ')} ${fmt(maxScore)}`, player: winnerNames[0] });
      const low = gp[gp.length - 1];
      if (groupWorst !== null && low.total_score < groupWorst) push({ id: `gworst:${g.id}`, kind: 'end', time: t, gameId: g.id, icon: '🥶', title: 'Najnižji rezultat vseh časov', text: `${low.name}: ${fmt(low.total_score)}`, player: low.name });
      if (maxEntriesInGame !== null && ge.length > maxEntriesInGame) push({ id: `marathon:${g.id}`, kind: 'end', time: t, gameId: g.id, icon: '⏱️', title: 'Maraton', text: `Najdaljša igra vseh časov: ${ge.length} vpisov` });
    }
    groupBest = groupBest === null ? maxScore : Math.max(groupBest, maxScore);
    groupWorst = groupWorst === null ? gp[gp.length - 1].total_score : Math.min(groupWorst, gp[gp.length - 1].total_score);
    maxEntriesInGame = maxEntriesInGame === null ? ge.length : Math.max(maxEntriesInGame, ge.length);

    // Večni dosežki, ki so odvisni od rezultata igre
    gp.forEach(p => checkAchievements(getCareer(p.name), 'end', g.id, t, push));

    // Lestvica: novo 1. mesto in prehitevanja
    const after = classicRanks();
    const firstBefore = [...before.ranks.entries()].filter(([, r]) => r === 1).map(([n]) => n);
    const firstAfter = [...after.ranks.entries()].filter(([, r]) => r === 1).map(([n]) => n);
    firstAfter.forEach(n => {
      if (!firstBefore.includes(n)) push({ id: `lead:${g.id}:${n}`, kind: 'end', time: t, gameId: g.id, icon: '🥇', title: 'Novo 1. mesto na lestvici', text: n, player: n });
    });
    gp.forEach(p => {
      const me = career.get(p.name)!;
      const meBefore = beforeStats.get(p.name);
      if (!meBefore || meBefore.games === 0) return; // prva igra igralca: brez prehitevanj
      const passed: string[] = [];
      career.forEach(o => {
        if (o.name === p.name) return;
        const oBefore = beforeStats.get(o.name);
        if (!oBefore || oBefore.games === 0) return;
        const wasBehind = betterTriple(oBefore, meBefore);
        const nowAhead = betterTriple(me, o);
        if (wasBehind && nowAhead) passed.push(o.name);
      });
      const r = after.ranks.get(p.name)!;
      if (passed.length && !firstAfter.includes(p.name)) {
        push({ id: `pass:${g.id}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '📊', title: `${p.name} na ${r}. mestu lestvice`, text: `Prehiti: ${passed.join(', ')}`, player: p.name });
      }
    });

    // Nov vodja indeksa %
    const indexList = [...career.values()].filter(s => s.games >= SETTINGS.indexMinGames && s.performance.length > 0);
    if (indexList.length) {
      const top = indexList.reduce((a, b) => (avg(b.performance) > avg(a.performance) ? b : a));
      if (indexLeader !== null && top.name !== indexLeader) push({ id: `index:${g.id}:${top.name}`, kind: 'end', time: t, gameId: g.id, icon: '📊', title: 'Nov vodja indeksa', text: `${top.name} (${Math.round(avg(top.performance))} %)`, player: top.name });
      indexLeader = top.name;
    }

    // Vroča forma (3 zmage v zadnjih 5 igrah)
    gp.forEach(p => {
      const s = career.get(p.name)!;
      const hotNow = s.recentRanks.slice(-5).filter(r => r === 1).length >= 3;
      if (hotNow && !hotBefore.get(p.name)) push({ id: `form:${g.id}:${p.name}`, kind: 'end', time: t, gameId: g.id, icon: '🔥', title: 'Vroča forma', text: `${p.name}: 3 zmage v zadnjih 5 igrah`, player: p.name });
    });

    // Nov vodja meseca (sezona)
    const mk = monthKeyOf(g.created_at);
    const monthList = monthGames.get(mk) || [];
    const leadersOf = (list: SeasonPlayer[][]) => standingsFor(list).filter(r => r.eligible && r.rank === 1).map(r => r.name);
    const leadBefore = leadersOf(monthList);
    monthList.push(gp);
    monthGames.set(mk, monthList);
    const leadAfter = leadersOf(monthList);
    leadAfter.forEach(n => {
      if (!leadBefore.includes(n)) push({ id: `monthlead:${g.id}:${n}`, kind: 'end', time: t, gameId: g.id, icon: '📅', title: 'Nov vodja meseca', text: `${n} vodi v ${MONTH_LOCATIVE[new Date(g.created_at).getMonth()]}`, player: n });
    });

    // Nagrade igre (enako kot v Zgodovini)
    const awards = gameAwards(gp, ge);

    summaries.push({
      gameId: g.id,
      time: t,
      gameDate: dateSl(g.created_at),
      winners: winnerNames.join(' & '),
      winnerScore: maxScore,
      awards,
      items,
    });
  }

  // Dosežki zbirke Izzivi: obvestilo ob odklepu (v živo ali ob koncu partije)
  const unlockedSets: Record<string, Set<string>> = {};
  computeChallenges(games, players, entries, radelci).events.forEach(ev => {
    if (!ev.unlocked) return;
    const def = CHALLENGES.find(c => c.id === ev.challengeId)!;
    const n: AppNotification = { id: `izziv:${def.id}:${ev.player}`, kind: def.live ? 'live' : 'end', time: ev.time, gameId: ev.gameId, icon: def.icon, title: `Nov dosežek: ${def.title}`, text: ev.player, player: ev.player };
    const list: AppNotification[] = [n];
    (unlockedSets[ev.player] = unlockedSets[ev.player] || new Set()).add(def.id);
    if (unlockedSets[ev.player].size === CHALLENGES.length) {
      list.push({ id: `izziv-complete:${ev.player}`, kind: n.kind, time: ev.time, gameId: ev.gameId, icon: IZZIVI.completionIcon, title: IZZIVI.completionTitle, text: `${ev.player}: vsi izzivi odklenjeni!`, player: ev.player });
    }
    list.forEach(x => {
      const summary = !def.live ? summaries.find(s => s.gameId === ev.gameId) : undefined;
      if (summary) summary.items.push(x); else live.push(x);
    });
  });

  // Igralec meseca: obvestilo ob začetku naslednjega meseca (samostojno, ne v živo)
  computeSeasons(games, players).forEach(m => {
    if (!m.champions.length) return;
    const start = new Date(m.year, m.month + 1, 1, 0, 0, 0).toISOString();
    m.champions.forEach(n => {
      const row = m.standings.find(r => r.name === n)!;
      live.push({ id: `champion:${m.key}:${n}`, kind: 'end', time: start, gameId: '', icon: '🏅', title: `Igralec meseca: ${m.label}`, text: `${n} (${row.points} točk)`, player: n });
    });
  });

  live.sort((a, b) => b.time.localeCompare(a.time));
  summaries.sort((a, b) => b.time.localeCompare(a.time));
  return { live, summaries };
}

// Nagrade igre - enaka logika kot calculateGameAwards v Zgodovini
function gameAwards(gp: NotifPlayer[], ge: NotifEntry[]): string[] {
  const stats = gp.map(p => {
    const en = ge.filter(e => e.player_id === p.id);
    return {
      id: p.id, name: p.name,
      playedCount: en.filter(e => e.played && !e.is_beggar).length,
      partnerCount: en.filter(e => e.is_partner).length,
      beggarCount: en.filter(e => e.is_beggar).length,
      actions: en.filter(e => e.played || e.is_partner || e.is_beggar).length,
      minus: en.reduce((acc, e) => (e.points < 0 ? acc + e.points : acc), 0),
    };
  });
  if (!ge.length) return [];
  const out: string[] = [];
  const used = new Set<string>();
  const pohlepnez = [...stats].sort((a, b) => b.playedCount - a.playedCount)[0];
  if (pohlepnez && pohlepnez.playedCount > 0) { out.push(`💰 Pohlepnež: ${pohlepnez.name}`); used.add(pohlepnez.id); }
  const pijavka = stats.filter(s => !used.has(s.id)).sort((a, b) => b.partnerCount - a.partnerCount)[0];
  if (pijavka && pijavka.partnerCount > 0) { out.push(`🦟 Pijavka: ${pijavka.name}`); used.add(pijavka.id); }
  const berac = stats.filter(s => !used.has(s.id)).sort((a, b) => b.beggarCount - a.beggarCount)[0];
  if (berac && berac.beggarCount >= 2) { out.push(`🙏 Socialni problem: ${berac.name}`); used.add(berac.id); }
  else {
    const kamikaza = stats.filter(s => !used.has(s.id)).sort((a, b) => a.minus - b.minus)[0];
    if (kamikaza && kamikaza.minus < 0) { out.push(`🧨 Kamikaza: ${kamikaza.name}`); used.add(kamikaza.id); }
  }
  const turist = stats.filter(s => !used.has(s.id)).sort((a, b) => a.actions - b.actions)[0];
  if (turist) out.push(`📸 Turist: ${turist.name}`);
  return out.slice(0, 4);
}
