import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Image
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Trophy, Trash2, Info, TrendingUp, TrendingDown, Calendar, Clock, BarChart2, Swords, Triangle, Circle, Zap, Share2, Lock, Users, X } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient'; 
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

// @ts-ignore
import ConfettiCannon from 'react-native-confetti-cannon';

type PlayerSummary = { name: string; total_score: number; };

type Game = { 
  id: string; 
  name: string; 
  created_at: string; 
  is_active: boolean; 
  radelci_active: number; 
  radelci_used: number;
  players?: PlayerSummary[]; 
};

type GamePlayer = { id: string; name: string; total_score: number; position: number; };
type Radelc = { id: string; player_id: string; is_used: boolean; position: number; };

type ScoreEntry = { 
  id: string; 
  points: number; 
  created_at: string; 
  played: boolean; 
  player_id?: string;
  is_partner?: boolean;
  is_beggar?: boolean;
  is_valat?: boolean;
};

type H2HStat = { 
    opponent: string; 
    wins: number; 
    losses: number; 
    ties: number; 
    total: number; 
    winPct: number; 
    lossPct: number; 
};

type GameRecord = { score: number; date: string };

type PlayerStats = { 
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
};

const COLORS = {
  bg: '#0d1321',
  card: '#1e293b',
  primary: '#556eeb',
  text: '#FFFFFF',
  textMuted: '#94A3B8',
  border: '#334155',
  success: '#10B981', 
  danger: '#EF4444',  
  warning: '#F59E0B', 
  inputBg: '#334155',
  radelcBorder: '#20B2AA', 
  radelcFill: '#28323e',
  playedDot: '#FFFFFF',
  slateBlue: 'rgb(74, 87, 106)',
  winnerGrey: 'rgb(148, 163, 184)'
};

const GRADIENT_COLORS = ['#556eeb', '#6050ea']; 

const getAvatarUrl = (name: string) => {
    const cleanName = name.trim();
    return `https://api.dicebear.com/8.x/lorelei/png?seed=${encodeURIComponent(cleanName)}&backgroundColor=transparent`;
};

export default function History() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [loading, setLoading] = useState(true);

  const [showGlobalStatsModal, setShowGlobalStatsModal] = useState(false);
  const [globalStats, setGlobalStats] = useState<PlayerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [globalStatsTab, setGlobalStatsTab] = useState<'classic' | 'index'>('classic');
  
  const [selectedGlobalPlayer, setSelectedGlobalPlayer] = useState<PlayerStats | null>(null);
  const [showGlobalPlayerModal, setShowGlobalPlayerModal] = useState(false);
  
  const [showAllGames, setShowAllGames] = useState(false);
  const [showPlayerSelectModal, setShowPlayerSelectModal] = useState(false);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [winnerData, setWinnerData] = useState<{names: string, score: number} | null>(null);

  const [chartWidth, setChartWidth] = useState(0);

  const viewShotRef = useRef<ViewShot>(null);
  const detailScrollRef = useRef<ScrollView>(null);

  const isFocused = useIsFocused();
  useEffect(() => { if (isFocused) loadGames(); }, [isFocused]);

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*, players(name, total_score)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setGames(data as any || []);
    } catch (error) { console.error('Error loading games:', error); } finally { setLoading(false); }
  };

  const loadGameDetails = async (game: Game) => {
    try {
      const [playersResult, radelciResult, historyResult] = await Promise.all([
        supabase.from('players').select('*').eq('game_id', game.id).order('total_score', { ascending: false }),
        supabase.from('radelci').select('*').eq('game_id', game.id).order('position'),
        supabase.from('score_entries').select('*').eq('game_id', game.id).order('created_at', { ascending: true })
      ]);
      if (playersResult.error) throw playersResult.error;
      if (radelciResult.error) throw radelciResult.error;
      setGamePlayers(playersResult.data || []);
      setRadelci(radelciResult.data || []);
      setPlayerHistory(historyResult.data || []);
      setSelectedGame(game);
      setShowGameModal(true);
    } catch (error) { console.error('Error loading game details:', error); }
  };

  // --- NOVA IN NEPREBOJNA LOGIKA ZA KAZNI RADELCEV ---
  // Aplikacija preveri zadnje vnose v igri. Če so bili ustvarjeni manj kot 5 sekund 
  // pred samim koncem in ustrezajo kazni za radelc, jih obravnava kot kazen.
  const penaltyEntryIds = new Set<string>();
  if (!selectedGame?.is_active && playerHistory.length > 0) {
      const timestamps = playerHistory.map(e => new Date(e.created_at).getTime()).filter(t => !isNaN(t));
      if (timestamps.length > 0) {
          const maxTime = Math.max(...timestamps);
          playerHistory.forEach(e => {
              const eTime = new Date(e.created_at).getTime();
              // Poiščemo tiste, ki so vpisani na samem koncu in so generične kazni (-50)
              if (maxTime - eTime < 5000 && e.points < 0 && !e.played && !e.is_partner && !e.is_beggar && !e.is_valat && Math.abs(e.points) % 50 === 0) {
                  penaltyEntryIds.add(e.id);
              }
          });
      }
  }

  const getRealRadelciStats = (playerId: string) => {
      const pRadelci = radelci.filter((r) => r.player_id === playerId);
      const totalCount = pRadelci.length;
      if (totalCount === 0) return null;

      if (selectedGame?.is_active) {
          const used = pRadelci.filter(r => r.is_used).length;
          return { used, total: totalCount };
      }

      // Za zaključene igre preštejemo točno določene kazni iz penaltyEntryIds
      const pHistory = playerHistory.filter(e => e.player_id === playerId && penaltyEntryIds.has(e.id));
      let penaltyPoints = 0;
      pHistory.forEach(e => { penaltyPoints += Math.abs(e.points); });

      const unusedCount = Math.round(penaltyPoints / 50);
      const usedCount = Math.max(0, totalCount - unusedCount);

      return { used: usedCount, total: totalCount };
  };

  const renderRadelciDots = (playerId: string, centered: boolean = false) => {
      const rStats = getRealRadelciStats(playerId);
      if (!rStats || rStats.total === 0) return null;
      
      const dots = [];
      if (selectedGame?.is_active) {
          const pRadelci = radelci.filter((r) => r.player_id === playerId);
          pRadelci.forEach(r => {
              dots.push(<View key={r.id} style={[styles.radelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />);
          });
      } else {
          for (let i = 0; i < rStats.total; i++) {
              const isUsed = i < rStats.used;
              dots.push(<View key={`r-${i}`} style={[styles.radelc, isUsed ? styles.radelcUsed : styles.radelcUnused]} />);
          }
      }
      return (
          <View style={[styles.radelciContainer, centered && { justifyContent: 'center', marginTop: 10, marginLeft: 0 }]}>
              {dots}
          </View>
      );
  };
  // ----------------------------------------------------

  const endGame = async (gameId: string) => {
      if (Platform.OS === 'web') {
        if (!window.confirm('Ali želiš zaključiti to igro?')) return;
      } else {
        Alert.alert('Zaključi igro', 'Ali želiš zaključiti to igro?', [{ text: 'Prekliči', style: 'cancel' }, { text: 'Zaključi', onPress: async () => await performEndGame(gameId) }]);
        return;
      }
      await performEndGame(gameId);
  };
  
  const performEndGame = async (gameId: string) => {
      try {
          if (gamePlayers.length > 0) {
              const maxScore = Math.max(...gamePlayers.map(p => p.total_score));
              const winners = gamePlayers.filter(p => p.total_score === maxScore);
              const names = winners.map(w => w.name).join(' & ');
              setWinnerData({ names, score: maxScore });
          }

          const { error } = await supabase.from('games').update({ is_active: false }).eq('id', gameId);
          if (error) throw error;

          setShowGameModal(false); 
          setSelectedGame(null); 
          await loadGames();

          if (gamePlayers.length > 0) {
              setShowWinnerPopup(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setTimeout(() => { setShowWinnerPopup(false); }, 5000);
          }
      } catch (error) { console.error(error); }
  };
  
  const deleteGame = async (gameId: string) => {
      if (Platform.OS === 'web') {
          if(!window.confirm('Ali si prepričan?')) return;
      } else {
          Alert.alert('Izbriši igro', 'Ali si prepričan?', [{ text: 'Prekliči', style: 'cancel' }, { text: 'Izbriši', style: 'destructive', onPress: async () => await performDeleteGame(gameId) }]);
          return;
      }
      await performDeleteGame(gameId);
  };
  
  const performDeleteGame = async (gameId: string) => {
      try { await supabase.from('games').delete().eq('id', gameId); setShowGameModal(false); await loadGames(); } catch (e) { console.error(e); }
  };

  const loadAllPlayersHistory = async () => {
    if (!selectedGame) return;
    try {
      const playerIds = gamePlayers.map((p) => p.id);
      const { data, error } = await supabase.from('score_entries').select('*').in('player_id', playerIds).order('created_at', { ascending: true });
      if (error) throw error;
      setPlayerHistory(data || []); setSelectedPlayerName('Vsi igralci'); setShowPlayerHistoryModal(true);
    } catch (error) { console.error(error); }
  };

  const loadGlobalStats = async (destination: 'leaderboard' | 'select' = 'leaderboard') => {
    setStatsLoading(true);
    if (destination === 'leaderboard') setShowGlobalStatsModal(true);
    else setShowPlayerSelectModal(true);
    try {
        const { data: finishedGames } = await supabase.from('games').select('id, name, created_at').eq('is_active', false).order('created_at', { ascending: false }); 
        const gameIds = finishedGames?.map(g => g.id) || [];
        const gameMap = new Map<string, {date: string, name: string}>();
        finishedGames?.forEach(g => gameMap.set(g.id, {date: g.created_at, name: g.name}));

        if (gameIds.length === 0) { setGlobalStats([]); setStatsLoading(false); return; }

        const { data: allPlayers } = await supabase.from('players').select('id, name, game_id, total_score').in('game_id', gameIds);
        if (!allPlayers) { setGlobalStats([]); return; }
        
        const { data: allEntries } = await supabase.from('score_entries').select('player_id, game_id, points, is_valat, is_beggar, created_at').in('game_id', gameIds).order('created_at', { ascending: true });

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
            gScores[e.player_id] = (gScores[e.player_id] || 0) + e.points;
            if (gScores[e.player_id] < 0) phoenixFlags[e.game_id].add(e.player_id);
        });

        finishedGames?.forEach(g => {
            const gameId = g.id;
            const gameP = playersByGame[gameId];
            if(!gameP) return;

            gameP.sort((a, b) => b.total_score - a.total_score);
            const gameInfo = gameMap.get(gameId) || {date: '', name: ''};

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

                if (myRank === 1) {
                    stat.wins += 1;
                    if (gameP.length > 1 && (gameP[0].total_score - gameP[1].total_score >= 300)) stat.dominator_count += 1;
                    if (phoenixFlags[gameId]?.has(p.id)) stat.phoenix_count += 1;
                }
                if (myRank === 2) stat.second += 1;
                if (myRank === 3) stat.third += 1;

                stat.recent_ranks.push({ rank: myRank, date: gameInfo.date, gameName: gameInfo.name });
                stat.total_score_sum += myScore;
                if (!stat.best_game || myScore > stat.best_game.score) stat.best_game = { score: myScore, date: gameInfo.date };
                if (!stat.worst_game || myScore < stat.worst_game.score) stat.worst_game = { score: myScore, date: gameInfo.date };

                const opponents = gameP.length - 1; 
                if (opponents > 0) {
                    const beaten = gameP.filter(op => op.total_score < myScore).length;
                    const pct = (beaten / opponents) * 100;
                    stat.performance_scores.push(pct);
                }

                gameP.forEach((op) => {
                    if (p.name !== op.name) {
                        if (!stat.h2h[op.name]) stat.h2h[op.name] = { opponent: op.name, wins: 0, losses: 0, ties: 0, total: 0, winPct: 0, lossPct: 0 };
                        stat.h2h[op.name].total += 1;
                        if (p.total_score > op.total_score) stat.h2h[op.name].wins += 1;
                        else if (p.total_score < op.total_score) stat.h2h[op.name].losses += 1;
                        else stat.h2h[op.name].ties += 1;
                    }
                });
            });
        });

        allEntries?.forEach(e => {
            const playerName = allPlayers.find(ap => ap.id === e.player_id)?.name;
            if (playerName && statsMap.has(playerName)) {
                if (e.is_valat) statsMap.get(playerName)!.valat_count += 1;
                if (e.is_beggar && e.points > 0) statsMap.get(playerName)!.beggar_wins += 1;
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

        setGlobalStats(processedStats);
    } catch (e) { console.error(e); } finally { setStatsLoading(false); }
  };

  const calculateGameAwards = () => {
    if (!gamePlayers.length || !playerHistory.length) return [];
    
    const stats = gamePlayers.map(p => {
      const entries = playerHistory.filter(e => e.player_id === p.id);
      return {
        id: p.id, name: p.name,
        playedCount: entries.filter(e => e.played && !e.is_beggar).length,
        partnerCount: entries.filter(e => e.is_partner).length,
        beggarCount: entries.filter(e => e.is_beggar).length,
        actions: entries.filter(e => e.played || e.is_partner || e.is_beggar).length,
        minus: entries.reduce((acc, e) => e.points < 0 ? acc + e.points : acc, 0)
      };
    });

    const awards: any[] = [];
    const assignedIds = new Set();

    const pohlepnez = [...stats].sort((a, b) => b.playedCount - a.playedCount)[0];
    if (pohlepnez && pohlepnez.playedCount > 0) { awards.push({ t: "Pohlepnež", n: pohlepnez.name, i: "💰", d: `Odigral ${pohlepnez.playedCount} iger.` }); assignedIds.add(pohlepnez.id); }

    const pijavka = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => b.partnerCount - a.partnerCount)[0];
    if (pijavka && pijavka.partnerCount > 0) { awards.push({ t: "Pijavka", n: pijavka.name, i: "🦟", d: `Klican ${pijavka.partnerCount}-krat.` }); assignedIds.add(pijavka.id); }

    const beggarCandidate = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => b.beggarCount - a.beggarCount)[0];
    if (beggarCandidate && beggarCandidate.beggarCount >= 2) { awards.push({ t: "Socialni problem", n: beggarCandidate.name, i: "🙏", d: `Berač ${beggarCandidate.beggarCount}-krat.` }); assignedIds.add(beggarCandidate.id); } 
    else {
      const kamikaza = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => a.minus - b.minus)[0];
      if (kamikaza && kamikaza.minus < 0) { awards.push({ t: "Kamikaza", n: kamikaza.name, i: "🧨", d: `${kamikaza.minus} minus točk.` }); assignedIds.add(kamikaza.id); }
    }

    const turist = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => a.actions - b.actions)[0];
    if (turist) awards.push({ t: "Turist", n: turist.name, i: "📸", d: "Najmanj sodeloval." });

    return awards.slice(0, 4);
  };

  const renderGameIcon = (entry: ScoreEntry) => {
    const iconColor = entry.is_valat ? COLORS.warning : "#fff";
    if (entry.is_beggar) return <Triangle size={8} color={iconColor} fill={iconColor} style={{ opacity: 0.9 }} />;
    if (entry.is_partner) return <Circle size={8} color={iconColor} style={{ opacity: 0.8 }} />;
    if (entry.played) return <View style={[styles.playedDot, entry.is_valat && {backgroundColor: COLORS.warning}]} />;
    return null;
  };
  
  const shareResults = async () => {
    if (viewShotRef.current && viewShotRef.current.capture) {
      const uri = await viewShotRef.current.capture();
      await Sharing.shareAsync(uri);
    }
  };

  const openGlobalPlayerDetails = (player: PlayerStats) => {
      setSelectedGlobalPlayer(player);
      setShowAllGames(false); 
      setShowGlobalPlayerModal(true);
      
      // Zabičamo iPhonu, da ob odprtju skoči nazaj na vrh
      setTimeout(() => {
          if (detailScrollRef.current) {
              detailScrollRef.current.scrollTo({ y: 0, animated: false });
          }
      }, 100);
  };
  
  const getFormStatus = (ranks: { rank: number }[]) => {
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

  const getRivals = (h2h: Record<string, H2HStat>) => {
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

  const getFormattedTitle = (game: Game | null) => {
    if (!game) return '';
    const dateObj = new Date(game.created_at);
    let cleanName = game.name.replace(/\d{1,2}\.\s\d{1,2}\.\s\d{4}/g, '').replace(/\d{1,2}\.\s\d{1,2}\./g, '').replace(/\d{1,2}:\d{2}/g, '').replace(/\bob\b/gi, '').trim().replace(/[,.-]+$/, '').trim();
    if (!cleanName) cleanName = "Tarok";
    return `${cleanName}, ${dateObj.toLocaleDateString('sl-SI')} (${dateObj.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })})`;
  };

  const renderGameWinner = (game: Game) => {
    if (!game.players || game.players.length === 0) return null;
    const hasScore = game.players.some(p => p.total_score !== 0);
    if (game.is_active && !hasScore) return null;
    const maxScore = Math.max(...game.players.map(p => p.total_score));
    const winners = game.players.filter(p => p.total_score === maxScore);
    const names = winners.map(w => w.name).join(' & ');
    return (
        <Text style={{ color: COLORS.winnerGrey, fontSize: 13, marginTop: 4 }}>
            {game.is_active ? "Trenutno vodilni: " : "Zmagovalec: "} <Text style={{ fontWeight: '700', color: COLORS.winnerGrey }}>{names} ({maxScore})</Text>
        </Text>
    );
  };

  const renderGame = ({ item }: { item: Game }) => {
    return (
      <TouchableOpacity style={styles.cardWrapper} onPress={() => loadGameDetails(item)}>
        <View style={styles.gameCard}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, item.is_active && {backgroundColor: 'rgba(85, 110, 235, 0.2)'}]}><Calendar size={18} color={item.is_active ? COLORS.primary : COLORS.textMuted} /></View>
                <View style={{flex: 1, justifyContent: 'center'}}>
                    <Text style={styles.gameTitleCombined}>{getFormattedTitle(item)}</Text>
                    {renderGameWinner(item)}
                </View>
                {item.is_active && <View style={styles.activeBadge}><Clock size={12} color="#fff" style={{marginRight: 4}}/><Text style={styles.activeBadgeText}>V TEKU</Text></View>}
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Line = ({ x1, y1, x2, y2, color }: { x1: number, y1: number, x2: number, y2: number, color: string }) => {
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      return (<View style={{ position: 'absolute', left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - 1, width: length, height: 2, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />);
  };

  const classicSortedStats = [...globalStats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins; if (b.second !== a.second) return b.second - a.second; return b.third - a.third;
  });

  const indexSortedStats = [...globalStats].filter(s => s.total_games >= 5).sort((a, b) => b.avg_performance - a.avg_performance);

  if (loading) return (<View style={styles.container}><Text style={styles.loadingText}>Nalaganje...</Text></View>);

  return (
    <View style={styles.container}>
      <View style={styles.mainHeader}>
          <Text style={styles.headerTitle}>Pregled</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={styles.globalStatsButton} onPress={() => loadGlobalStats('select')}><LinearGradient colors={['#334155', '#1e293b']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} /><View style={styles.relativeContent}><Users size={22} color="#fff" /></View></TouchableOpacity>
              <TouchableOpacity style={styles.globalStatsButton} onPress={() => loadGlobalStats('leaderboard')}><LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} /><View style={styles.relativeContent}><Trophy size={22} color="#fff" /></View></TouchableOpacity>
          </View>
      </View>

      <Modal visible={showPlayerSelectModal} transparent animationType="fade" onRequestClose={() => setShowPlayerSelectModal(false)}>
         <View style={[styles.modalOverlay, {justifyContent: 'center', alignItems: 'center'}]}>
            <View style={[styles.modalContent, {width: '85%', maxHeight: '70%', borderRadius: 24, padding: 20}]}>
                <Text style={[styles.modalTitle, {marginBottom: 20}]}>Izberi igralca</Text>
                {statsLoading ? (<ActivityIndicator size="large" color={COLORS.primary} style={{marginVertical: 40}} />) : (
                    <ScrollView style={{width: '100%'}} showsVerticalScrollIndicator={false}>
                        {[...globalStats].sort((a, b) => a.name.localeCompare(b.name)).map(stat => (
                            <TouchableOpacity key={stat.name} style={styles.selectPlayerItem} onPress={() => { setShowPlayerSelectModal(false); openGlobalPlayerDetails(stat); }}>
                                <View style={{flexDirection: 'row', alignItems: 'center'}}><Image source={{ uri: getAvatarUrl(stat.name) }} style={[styles.playerAvatar, {marginRight: 12}]} /><Text style={{color: '#fff', fontSize: 18, fontWeight: '600'}}>{stat.name}</Text></View>
                                <ChevronRight size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
                <TouchableOpacity style={[styles.closeButton, {marginTop: 10}]} onPress={() => setShowPlayerSelectModal(false)}><Text style={styles.closeButtonText}>Prekliči</Text></TouchableOpacity>
            </View>
         </View>
      </Modal>

      <FlatList data={games} keyExtractor={(item) => item.id} renderItem={renderGame} contentContainerStyle={styles.listContainer} ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Ni še nobene igre</Text></View>} />

      <Modal visible={showGlobalStatsModal} transparent animationType="slide" onRequestClose={() => setShowGlobalStatsModal(false)}>
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.historyModal]}>
                <Text style={[styles.modalTitle, { marginBottom: 20 }]}>Lestvica 🏆</Text>
                <View style={styles.tabContainer}>
                    <TouchableOpacity style={[styles.tabButton, globalStatsTab === 'classic' && styles.tabButtonActive]} onPress={() => setGlobalStatsTab('classic')}><Text style={[styles.tabText, globalStatsTab === 'classic' && styles.tabTextActive]}>Po zmagah</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.tabButton, globalStatsTab === 'index' && styles.tabButtonActive]} onPress={() => setGlobalStatsTab('index')}><Text style={[styles.tabText, globalStatsTab === 'index' && styles.tabTextActive]}>Indeks %</Text></TouchableOpacity>
                </View>
                {statsLoading ? (<ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 20}} />) : (
                    <>
                        {globalStatsTab === 'classic' ? (
                            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                                {classicSortedStats.map((stat, index) => {
                                    const rank = classicSortedStats.findIndex(s => s.wins === stat.wins && s.second === stat.second && s.third === stat.third) + 1;
                                    return (
                                        <TouchableOpacity key={stat.name} style={styles.leaderboardItem} onPress={() => openGlobalPlayerDetails(stat)}>
                                            <View style={{width: 32, alignItems: 'center', justifyContent: 'center'}}>{rank === 1 ? <Trophy size={20} color="#ffd700" /> : rank === 2 ? <Trophy size={20} color="#c0c0c0" /> : rank === 3 ? <Trophy size={20} color="#cd7f32" /> : <Text style={[styles.rankText, {fontSize: 16}]}>{rank}.</Text>}</View>
                                            <Image source={{ uri: getAvatarUrl(stat.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginLeft: 4, marginRight: 8}]} />
                                            <View style={{flex: 1, justifyContent: 'center'}}><Text style={[styles.leaderboardName, {fontSize: 16}]}>{stat.name}</Text><Text style={{color: COLORS.textMuted, fontSize: 11}}>{stat.total_games} iger</Text></View>
                                            <View style={{flexDirection: 'row', gap: 6, alignItems: 'center'}}>
                                                <View style={styles.medalBox}><Trophy size={14} color="#ffd700" /><Text style={styles.medalText}>{stat.wins}</Text></View>
                                                <View style={styles.medalBox}><Trophy size={14} color="#c0c0c0" /><Text style={styles.medalText}>{stat.second}</Text></View>
                                                <View style={styles.medalBox}><Trophy size={14} color="#cd7f32" /><Text style={styles.medalText}>{stat.third}</Text></View>
                                                <ChevronRight size={16} color={COLORS.textMuted} style={{marginLeft: 2}} />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : (
                            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                                {indexSortedStats.length === 0 ? (<View style={{alignItems: 'center', marginTop: 40}}><BarChart2 size={40} color={COLORS.textMuted} style={{marginBottom: 10}} /><Text style={{color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20}}>Še noben igralec ni odigral dovolj iger za izračun indeksa.</Text></View>) : (
                                    indexSortedStats.map((stat, index) => {
                                        const rank = indexSortedStats.findIndex(s => s.avg_performance === stat.avg_performance) + 1;
                                        const showUp = stat.avg_performance > stat.prev_performance;
                                        const showDown = stat.avg_performance < stat.prev_performance;
                                        return (
                                            <TouchableOpacity key={stat.name} style={styles.leaderboardItem} onPress={() => openGlobalPlayerDetails(stat)}>
                                                <View style={{width: 32, alignItems: 'center', justifyContent: 'center'}}>{rank === 1 ? <Trophy size={20} color="#ffd700" /> : rank === 2 ? <Trophy size={20} color="#c0c0c0" /> : rank === 3 ? <Trophy size={20} color="#cd7f32" /> : <Text style={[styles.rankText, {fontSize: 16}]}>{rank}.</Text>}</View>
                                                <Image source={{ uri: getAvatarUrl(stat.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginLeft: 4, marginRight: 8}]} />
                                                <View style={{flex: 1, justifyContent: 'center'}}><Text style={[styles.leaderboardName, {fontSize: 16}]}>{stat.name}</Text><Text style={{color: COLORS.textMuted, fontSize: 11}}>{stat.total_games} iger</Text></View>
                                                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4}}>
                                                    {showUp && <TrendingUp size={14} color={COLORS.success} style={{marginRight: 8}} />}
                                                    {showDown && <TrendingDown size={14} color={COLORS.danger} style={{marginRight: 8}} />}
                                                    <Text style={{color: COLORS.text, fontSize: 18, fontWeight: '800'}}>{Math.round(stat.avg_performance)} %</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                                <Text style={{color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 10, marginBottom: 10}}>* Prikazani so le igralci z vsaj 5 odigranimi igrami. Puščica označuje spremembo po zadnji igri.</Text>
                            </ScrollView>
                        )}
                    </>
                )}
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowGlobalStatsModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
            </View>
         </View>
      </Modal>

      <Modal visible={showGlobalPlayerModal} transparent animationType="slide" onRequestClose={() => setShowGlobalPlayerModal(false)}>
         <View style={styles.modalOverlay}>
             <View style={[styles.modalContent, styles.historyModal]}>
                {selectedGlobalPlayer && (
                    <>
                        <ScrollView ref={detailScrollRef} style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                            <View style={styles.detailHeader}>
                                <Image source={{ uri: getAvatarUrl(selectedGlobalPlayer.name) }} style={[styles.playerAvatar, {width: 80, height: 80, borderRadius: 40, marginRight: 0, marginBottom: 12, borderWidth: 2}]} />
                                <Text style={styles.modalTitle}>{selectedGlobalPlayer.name}   <Text style={{ color: 'rgb(148, 163, 184)' }}>{Math.round(selectedGlobalPlayer.avg_performance)}%</Text></Text>
                            </View>

                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>Trenutna forma</Text>
                                {(() => {
                                    const form = getFormStatus(selectedGlobalPlayer.recent_ranks);
                                    return (
                                        <View style={styles.formCard}><Text style={{fontSize: 40}}>{form.icon}</Text><Text style={styles.formSubText}>{selectedGlobalPlayer.recent_ranks.slice(0, 5).length} iger v analizi</Text></View>
                                    );
                                })()}
                            </View>

                            <View style={styles.chartSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:20}}><TrendingUp size={20} color={COLORS.primary} style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Gibanje uvrstitev (Zadnjih 10)</Text></View>
                                <View style={styles.chartContainer} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
                                    <View style={[styles.gridLine, {top: 0}]}><Text style={styles.gridLabel}>1.</Text></View><View style={[styles.gridLine, {top: '50%'}]}><Text style={styles.gridLabel}>5.</Text></View><View style={[styles.gridLine, {top: '100%'}]}><Text style={styles.gridLabel}>10.</Text></View>
                                    {(() => {
                                        if (chartWidth === 0) return null;
                                        const data = selectedGlobalPlayer.recent_ranks.slice(0, 10).reverse();
                                        const chartHeight = 120;
                                        const totalPoints = data.length;
                                        const stepX = totalPoints > 1 ? chartWidth / (totalPoints - 1) : chartWidth / 2;
                                        const points = data.map((r, i) => { const cappedRank = Math.min(r.rank, 10); const y = ((cappedRank - 1) / 9) * chartHeight; const x = totalPoints > 1 ? i * stepX : chartWidth / 2; return { x, y, rank: r.rank }; });
                                        return (
                                            <View style={{ width: '100%', height: '100%' }}>
                                                {points.map((p, i) => { if (i === points.length - 1) return null; const nextP = points[i+1]; return (<Line key={`line-${i}`} x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y} color={COLORS.primary} />); })}
                                                {points.map((p, i) => { let dotColor = '#fff'; if (p.rank === 1) dotColor = '#ffd700'; else if (p.rank === 2) dotColor = '#c0c0c0'; else if (p.rank === 3) dotColor = '#cd7f32'; return (<View key={`dot-${i}`} style={{position: 'absolute', left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: dotColor, zIndex: 10}} />); })}
                                            </View>
                                        );
                                    })()}
                                </View>
                                <View style={styles.chartXAxis}><Text style={styles.axisLabel}>Starejše</Text><Text style={styles.axisLabel}>Novejše</Text></View>
                            </View>

                            <View style={styles.lastGamesSection}>
                                <View style={{flexDirection:'row', alignItems:'center', justifyContent: 'space-between', marginBottom:10}}>
                                    <View style={{flexDirection:'row', alignItems:'center'}}><Calendar size={20} color={COLORS.textMuted} style={{marginRight:8}} /><Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{showAllGames ? 'Vse igre' : 'Zadnjih 5 iger'}</Text></View>
                                    {selectedGlobalPlayer.recent_ranks.length > 5 && (<TouchableOpacity onPress={() => setShowAllGames(!showAllGames)}><Text style={{color: COLORS.primary, fontWeight: '600', fontSize: 14}}>{showAllGames ? 'Pokaži manj' : 'Pokaži vse'}</Text></TouchableOpacity>)}
                                </View>
                                {(showAllGames ? selectedGlobalPlayer.recent_ranks : selectedGlobalPlayer.recent_ranks.slice(0, 5)).map((r, i) => (
                                    <View key={i} style={styles.rankRow}><Text style={styles.rankRowDate}>{new Date(r.date).toLocaleDateString('sl-SI')}</Text><View style={styles.rankBadge}><Text style={styles.rankBadgeText}>{r.rank}. mesto</Text></View></View>
                                ))}
                            </View>

                            <View style={styles.rivalsSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}><Swords size={20} color={COLORS.danger} style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Osebni rivali</Text></View>
                                {(() => {
                                    const rivals = getRivals(selectedGlobalPlayer.h2h);
                                    if (!rivals) return <Text style={styles.emptyText}>Premalo odigranih skupnih iger za izračun rivalov (vsaj 3 igre z istim nasprotnikom).</Text>;
                                    return (
                                        <View>
                                            {rivals.stranka && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Najljubša stranka</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.stranka.opponent) }} style={[styles.playerAvatar, {width: 24, height: 24, borderRadius: 12, marginRight: 8}]} /><Text style={styles.rivalName}>{rivals.stranka.opponent}</Text></View><Text style={styles.rivalDesc}>Zmage proti njemu: <Text style={{fontWeight: '700', color: COLORS.text}}>{Math.round(rivals.stranka.winPct)} %</Text> ({rivals.stranka.wins} Z / {rivals.stranka.losses} P)</Text></View>)}
                                            {rivals.mora && rivals.mora.opponent !== rivals.stranka.opponent && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Trn v peti</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.mora.opponent) }} style={[styles.playerAvatar, {width: 24, height: 24, borderRadius: 12, marginRight: 8}]} /><Text style={styles.rivalName}>{rivals.mora.opponent}</Text></View><Text style={styles.rivalDesc}>Porazi proti njemu: <Text style={{fontWeight: '700', color: COLORS.text}}>{Math.round(rivals.mora.lossPct)} %</Text> ({rivals.mora.losses} P / {rivals.mora.wins} Z)</Text></View>)}
                                            {rivals.derbi && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Večni derbi</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.derbi.opponent) }} style={[styles.playerAvatar, {width: 24, height: 24, borderRadius: 12, marginRight: 8}]} /><Text style={styles.rivalName}>{rivals.derbi.opponent}</Text></View><Text style={styles.rivalDesc}>Izenačen boj: <Text style={{fontWeight: '700', color: COLORS.text}}>{Math.round(rivals.derbi.winPct)} %</Text> uspeh.</Text></View>)}
                                        </View>
                                    );
                                })()}
                            </View>

                            <View style={styles.recordsSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}><Trophy size={20} color="#ffd700" style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Osebni rekordi in ekstremi</Text></View>
                                <View style={styles.recordsGrid}>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>🚀 Življenjska igra</Text><Text style={[styles.recordValue, selectedGlobalPlayer.best_game && selectedGlobalPlayer.best_game.score > 0 ? {color: COLORS.success} : {}]}>{selectedGlobalPlayer.best_game ? (selectedGlobalPlayer.best_game.score > 0 ? `+${selectedGlobalPlayer.best_game.score}` : selectedGlobalPlayer.best_game.score) : '/'}</Text><Text style={styles.recordSub}>{selectedGlobalPlayer.best_game ? new Date(selectedGlobalPlayer.best_game.date).toLocaleDateString('sl-SI') : ''}</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>💀 Črni dan</Text><Text style={[styles.recordValue, selectedGlobalPlayer.worst_game && selectedGlobalPlayer.worst_game.score < 0 ? {color: COLORS.danger} : {}]}>{selectedGlobalPlayer.worst_game ? selectedGlobalPlayer.worst_game.score : '/'}</Text><Text style={styles.recordSub}>{selectedGlobalPlayer.worst_game ? new Date(selectedGlobalPlayer.worst_game.date).toLocaleDateString('sl-SI') : ''}</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>💰 Skupne točke</Text><Text style={[styles.recordValue, selectedGlobalPlayer.total_score_sum > 0 ? {color: COLORS.success} : (selectedGlobalPlayer.total_score_sum < 0 ? {color: COLORS.danger} : {color: COLORS.text})]}>{selectedGlobalPlayer.total_score_sum > 0 ? `+${selectedGlobalPlayer.total_score_sum}` : selectedGlobalPlayer.total_score_sum}</Text><Text style={styles.recordSub}>Karierni izkupiček</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>⚖️ Povprečje</Text><Text style={styles.recordValue}>{(selectedGlobalPlayer.total_score_sum / selectedGlobalPlayer.total_games).toFixed(1)}</Text><Text style={styles.recordSub}>Točk na igro</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>🏅 Stopničke</Text><Text style={styles.recordValue}>{Math.round(((selectedGlobalPlayer.wins + selectedGlobalPlayer.second + selectedGlobalPlayer.third) / selectedGlobalPlayer.total_games) * 100)} %</Text><Text style={styles.recordSub}>Iger med top 3</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>🔥 Niz zmag</Text><Text style={styles.recordValue}>{selectedGlobalPlayer.longest_win_streak}</Text><Text style={styles.recordSub}>Zaporednih zmag</Text></View>
                                    <View style={[styles.recordBox, {width: '100%', borderColor: 'rgba(245, 158, 11, 0.2)', borderTopColor: 'rgba(245, 158, 11, 0.5)', borderLeftColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.05)'}]}><View style={{flexDirection: 'row', alignItems: 'center'}}><Zap size={18} color={COLORS.warning} style={{marginRight: 8}} /><Text style={[styles.recordTitle, {color: COLORS.warning, marginBottom: 0, fontSize: 16}]}>Valati</Text></View><Text style={[styles.recordValue, {color: COLORS.warning, marginTop: 8, fontSize: 32}]}>{selectedGlobalPlayer.valat_count}</Text><Text style={styles.recordSub}>Skupno število uspešnih valatov</Text></View>
                                </View>
                            </View>

                            <View style={styles.recordsSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}><Trophy size={20} color="#ffd700" style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Večni dosežki</Text></View>
                                <View style={{ gap: 10 }}>
                                    {(() => {
                                        const achievements = [
                                            { id: 'metla', title: 'Zlata metla', icon: '🧹', target: 3, current: selectedGlobalPlayer.current_win_streak, unlocked: selectedGlobalPlayer.longest_win_streak >= 3, descLocked: 'Zmagaj 3 igre zapored v katerih sodeluješ.', descUnlocked: 'Dosežek odklenjen: Zmagal si 3 igre zapored.' },
                                            { id: 'valat', title: 'Kralj valatov', icon: '⚡', target: 2, current: selectedGlobalPlayer.valat_count, unlocked: selectedGlobalPlayer.valat_count >= 2, descLocked: 'Odigraj in zmagaj 2 valata v svoji karieri.', descUnlocked: 'Dosežek odklenjen: Uspešno si odigral 2 valata v karieri.' },
                                            { id: 'feniks', title: 'Feniks', icon: '🦅', target: 3, current: selectedGlobalPlayer.phoenix_count, unlocked: selectedGlobalPlayer.phoenix_count >= 3, descLocked: 'Zmagaj 3 igre, v katerih je bil tvoj skupni seštevek točk med igro pod ničlo (v minusu).', descUnlocked: 'Dosežek odklenjen: Trikrat si zmagal igro, čeprav si bil vmes v minusu.' },
                                            { id: 'berac', title: 'Kralj beračev', icon: '🙏', target: 5, current: selectedGlobalPlayer.beggar_wins, unlocked: selectedGlobalPlayer.beggar_wins >= 5, descLocked: 'Odigraj in zmagaj 5 beračev v svoji karieri.', descUnlocked: 'Dosežek odklenjen: Uspešno si zmagal 5 beračev v karieri.' },
                                            { id: 'dominator', title: 'Gospodar mize', icon: '👑', target: 3, current: selectedGlobalPlayer.dominator_count, unlocked: selectedGlobalPlayer.dominator_count >= 3, descLocked: 'Zmagaj igro z vsaj 300 točkami prednosti pred drugim mestom, in to ponovi 3x.', descUnlocked: 'Dosežek odklenjen: Trikrat si zmagal z vsaj 300 točkami prednosti.' }
                                        ];
                                        const unlockedCount = achievements.filter(a => a.unlocked).length;
                                        return (
                                            <>
                                                {achievements.map(ach => {
                                                    const isUnlocked = ach.unlocked; const progress = isUnlocked ? 1 : (ach.current / ach.target);
                                                    return (
                                                        <View key={ach.id} style={styles.achievementBox}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{isUnlocked ? (<Text style={{ fontSize: 22 }}>{ach.icon}</Text>) : (<Lock size={20} color="#64748b" />)}</View><View style={{ flex: 1 }}><Text style={{ fontSize: 18, fontWeight: '800', color: isUnlocked ? '#ffd700' : '#94a3b8' }}>{ach.title}</Text></View></View>
                                                            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>{isUnlocked ? ach.descUnlocked : ach.descLocked}</Text>
                                                            {isUnlocked ? (<View style={{ flexDirection: 'row', alignItems: 'center' }}><Trophy size={14} color="#ffd700" style={{ marginRight: 6 }} /><Text style={{ color: '#ffd700', fontSize: 12, fontWeight: '700' }}>Odklenjeno</Text></View>) : (<View><View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' }}><View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 }} /></View><Text style={{ color: '#64748b', fontSize: 11, marginTop: 6, textAlign: 'right', fontWeight: '600' }}>({Math.min(ach.current, ach.target)} / {ach.target})</Text></View>)}
                                                        </View>
                                                    );
                                                })}
                                                {unlockedCount === 5 && (
                                                    <View style={styles.grandSlamBox}>
                                                        <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.absoluteGradient} />
                                                        <View style={styles.relativeContentVertical}><Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: 1, textAlign: 'center' }}>🏆 GRAND SLAM 🏆</Text><Text style={{ fontSize: 15, color: '#e2e8f0', marginBottom: 15, textAlign: 'center', fontWeight: '500' }}>Čestitke, vse značke so tvoje!</Text><View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, width: '100%' }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' }}>Nagrada: Vsak igralec ti plača pivo! 🍻😎</Text></View></View>
                                                    </View>
                                                )}
                                            </>
                                        );
                                    })()}
                                </View>
                            </View>
                        </ScrollView>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowGlobalPlayerModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
                    </>
                )}
             </View>
         </View>
      </Modal>
      
      <Modal visible={showGameModal} transparent animationType="slide" onRequestClose={() => setShowGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <TouchableOpacity style={styles.gameModalInfoBtn} onPress={() => loadAllPlayersHistory()}><Info size={20} color="#fff" /><Text style={{color: '#fff', marginLeft: 8, fontWeight: '600'}}>Potek igre</Text></TouchableOpacity>
              {!selectedGame?.is_active && selectedGame && (<TouchableOpacity style={styles.gameModalTrashBtn} onPress={() => deleteGame(selectedGame.id)}><Trash2 size={20} color={COLORS.danger} /></TouchableOpacity>)}
            </View>

            <ScrollView style={styles.playersListContainer} showsVerticalScrollIndicator={false}>
              <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1.0 }}>
                <View style={{ backgroundColor: COLORS.card, padding: 10, paddingBottom: 20 }}>
                  <Text style={[styles.modalTitle, {color: '#FFFFFF', marginBottom: 15, textAlign: 'center'}]}>{selectedGame ? getFormattedTitle(selectedGame) : 'Igra'}</Text>
                  <Text style={styles.sectionTitle}>Končna lestvica</Text>
                  
                  {!selectedGame?.is_active && gamePlayers.length > 0 && (
                      <View style={styles.winnerCard}>
                          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom:15, justifyContent: 'center', width: '100%'}}><Trophy size={24} color="#ffd700" style={{marginRight: 8}} /><Text style={[styles.winnerText, {fontSize: 16, letterSpacing: 2}]}>ZMAGOVALEC</Text></View>
                          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, width: '100%'}}><Image source={{ uri: getAvatarUrl(gamePlayers[0].name) }} style={[styles.playerAvatar, {width: 70, height: 70, borderRadius: 35, marginRight: 10, borderWidth: 1.5}]} /><Text style={[styles.winnerName, {marginTop: 0, fontSize: 27}]}>{gamePlayers[0].name}</Text></View>
                          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}><Text style={[styles.winnerScore, {marginTop: 0}]}>{gamePlayers[0].total_score} točk</Text></View>
                          {renderRadelciDots(gamePlayers[0].id, true)}
                      </View>
                  )}
                  
                  {gamePlayers.map((player, index, array) => {
                    if (!selectedGame?.is_active && index === 0) return null;
                    const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                    return (
                      <View key={player.id} style={styles.playerRowContainer}>
                        <View style={styles.rankContainer}>{rank === 1 && <Trophy size={20} color="#ffd700" />}{rank === 2 && <Trophy size={20} color="#c0c0c0" />}{rank === 3 && <Trophy size={20} color="#cd7f32" />}{rank > 3 && (<Text style={styles.rankNumber}>{rank}</Text>)}</View>
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 8}]} />
                        <Text style={styles.playerName}>{player.name || `Igralec ${player.position + 1}`}</Text>
                        {renderRadelciDots(player.id, false)}
                        <Text style={[styles.playerScore, player.total_score > 0 ? styles.positiveScore : player.total_score < 0 ? styles.negativeScore : styles.neutralScore]}>{player.total_score}</Text>
                      </View>
                    );
                  })}

                  {!selectedGame?.is_active && gamePlayers.length > 0 && calculateGameAwards().length > 0 && (
                    <View style={{marginTop: 20}}><Text style={styles.sectionTitle}>Izstopajoči igralci</Text><View style={styles.awardsGrid}>{calculateGameAwards().map((award, i) => (<View key={i} style={styles.awardCard}><Text style={{fontSize: 24}}>{award.i}</Text><Text style={styles.awardTitle}>{award.t}</Text><Text style={styles.awardName} numberOfLines={1}>{award.n}</Text><Text style={styles.awardDesc}>{award.d}</Text></View>))}</View></View>
                  )}
                </View>
              </ViewShot>
            </ScrollView>

            <View style={styles.modalButtons}>
              {selectedGame?.is_active ? (<TouchableOpacity style={[styles.closeButton, styles.closeButtonFlex]} onPress={() => setShowGameModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>) : (
                <>
                  <TouchableOpacity style={[styles.closeButton, styles.closeButtonFlex, {backgroundColor: COLORS.success, flexDirection: 'row', justifyContent: 'center', gap: 8}]} onPress={shareResults}><Share2 size={20} color="#fff" /><Text style={styles.closeButtonText}>Deli</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.closeButton, styles.closeButtonFlex]} onPress={() => setShowGameModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPlayerHistoryModal} transparent animationType="slide" onRequestClose={() => setShowPlayerHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={styles.modalTitle}>{selectedPlayerName} - Zgodovina točk</Text>
            <ScrollView style={[styles.historyList, { marginTop: 20 }]} showsVerticalScrollIndicator={false}>
              {gamePlayers.sort((a, b) => b.total_score - a.total_score).map((player, playerIndex, array) => {
                  const playerEntries = playerHistory.filter((e) => e.player_id === player.id);
                  const playerName = player.name || `Igralec ${player.position + 1}`;
                  const playedCount = playerEntries.filter(e => e.played || e.is_beggar).length;

                  if (playerEntries.length === 0) return null;
                  const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={[styles.playerHistoryHeader, {backgroundColor: COLORS.slateBlue}]}>
                        <View style={styles.playerRankBadge}>{rank === 1 && <Trophy size={16} color="#ffd700" />}{rank === 2 && <Trophy size={16} color="#c0c0c0" />}{rank === 3 && <Trophy size={16} color="#cd7f32" />}{rank > 3 && (<Text style={styles.playerRankText}>{rank}</Text>)}</View>
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 8}]} />
                        <Text style={styles.playerHistorySectionTitle}>{playerName} <Text style={{fontWeight: '400', fontSize: 14, color: COLORS.winnerGrey}}>(igralec je igral: {playedCount})</Text></Text>
                        <Text style={[styles.playerTotalScore, player.total_score > 0 ? styles.positivePoints : player.total_score < 0 ? styles.negativePoints : styles.neutralScore]}>{player.total_score}</Text>
                      </View>

                      {playerEntries.map((entry, index) => {
                        let runningTotal = 0;
                        for (let i = 0; i <= index; i++) { runningTotal += playerEntries[i].points; }
                        
                        const isPenalty = penaltyEntryIds.has(entry.id);
                        const pointsColor = isPenalty ? COLORS.warning : (entry.is_valat ? COLORS.warning : (entry.points > 0 ? styles.positivePoints.color : styles.negativePoints.color));

                        return (
                          <View key={entry.id} style={styles.historyItem}>
                             <View style={styles.pointsWrapper}>
                                <View style={styles.fixedPointsBox}>
    <Text style={[styles.historyPoints, entry.is_valat ? {color: COLORS.warning} : (entry.points > 0 ? styles.positivePoints : styles.negativePoints)]}>
        {entry.points > 0 ? '+' : ''}{entry.points}
    </Text>
</View>
                                <View style={styles.dotBox}>{renderGameIcon(entry)}</View>
                             </View>
                            <Text style={styles.historyTotal}>= {runningTotal}</Text>
                            <Text style={styles.historyDate}>{new Date(entry.created_at).toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowPlayerHistoryModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showWinnerPopup} transparent animationType="fade" onRequestClose={() => setShowWinnerPopup(false)}>
        <View style={[styles.modalOverlay, {justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)'}]}>
            <View style={styles.winnerPopupCard}>
                <TouchableOpacity style={{position: 'absolute', top: 12, right: 12, padding: 8}} onPress={() => setShowWinnerPopup(false)}><X size={24} color={COLORS.textMuted} /></TouchableOpacity>
                <Trophy size={60} color="#ffd700" style={{marginBottom: 15}} />
                <Text style={{color: '#ffd700', fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 10}}>ZMAGOVALEC</Text>
                {winnerData?.names && (<Image source={{ uri: getAvatarUrl(winnerData.names.split(' & ')[0]) }} style={[styles.playerAvatar, {width: 80, height: 80, borderRadius: 40, marginVertical: 10, borderWidth: 2}]} />)}
                <Text style={{color: COLORS.text, fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 10}}>{winnerData?.names}</Text>
                <View style={{backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, marginTop: 5}}>
                    <Text style={{color: COLORS.success, fontSize: 26, fontWeight: '800'}}>{winnerData?.score} točk</Text>
                </View>
            </View>
            {showWinnerPopup && (<View pointerEvents="none" style={StyleSheet.absoluteFillObject}><ConfettiCannon count={200} origin={{x: -10, y: 0}} autoStart={true} fadeOut={true} fallSpeed={2500} /></View>)}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  mainHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  
  absoluteGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  relativeContent: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  relativeContentVertical: { position: 'relative', zIndex: 1, alignItems: 'center', width: '100%' },

  globalStatsButton: {
      paddingVertical: 12, paddingHorizontal: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden'
  },
  
  subTitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 15 },
  listContainer: { padding: 16, gap: 12 },
  cardWrapper: { }, 
  gameCard: { 
      backgroundColor: COLORS.card, borderRadius: 20, padding: 18,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  gameTitleCombined: { color: '#fff', fontSize: 16, fontWeight: '600' },
  activeBadge: { backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, marginBottom: 8, textAlign: 'center', paddingHorizontal: 20 },
  loadingText: { color: COLORS.text, fontSize: 18, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  
  modalContent: { 
      backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 12 },
  modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  headerInfoButton: { padding: 4 },
  playersListContainer: { marginBottom: 20 },
  
  playerRowContainer: { 
      flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16, gap: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rankContainer: { width: 32, alignItems: 'center' },
  rankNumber: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  
  playerAvatar: {
      width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', borderTopColor: 'rgba(255, 255, 255, 0.3)', 
  },
  
  playerName: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '500', marginLeft: 4 },
  playerScore: { fontSize: 20, fontWeight: '700' },
  positiveScore: { color: COLORS.success },
  negativeScore: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 12 },
  
  closeButton: { 
      backgroundColor: '#5863ea', padding: 16, borderRadius: 12, alignItems: 'center', 
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden' 
  },
  closeButtonFlex: { flex: 1 },
  closeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  radelciContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  radelc: { width: 10, height: 10, borderRadius: 5 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.radelcBorder },
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 },
  historyModal: { height: '85%', maxHeight: '85%' }, 
  historyList: { flex: 1, marginBottom: 16 },
  playerHistorySection: { marginBottom: 24 },
  
  playerHistoryHeader: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.20)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '600' },
  playerTotalScore: { fontSize: 22, fontWeight: '700' },
  
  historyItem: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 8, marginBottom: 8,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  fixedPointsBox: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotBox: { width: 20, alignItems: 'center', justifyContent: 'center' },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: COLORS.success },
  negativePoints: { color: COLORS.danger },
  historyTotal: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: COLORS.textMuted, fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.playedDot },
  
  tabContainer: { 
      flexDirection: 'row', marginBottom: 20, backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 4,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.15)', borderLeftColor: 'rgba(255, 255, 255, 0.10)', overflow: 'hidden'
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: { backgroundColor: COLORS.card },
  tabText: { color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  
  leaderboardItem: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 10, marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rankText: { color: COLORS.text, fontSize: 20, fontWeight: '700' }, 
  leaderboardName: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1 },
  medalBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  medalText: { color: '#fff', fontWeight: '800', marginLeft: 4, fontSize: 15 },
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailScroll: { flex: 1, marginBottom: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  
  formSection: { marginBottom: 24, alignItems: 'center' },
  formCard: { 
      backgroundColor: COLORS.inputBg, width: '100%', padding: 20, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  formText: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  formSubText: { color: COLORS.textMuted, marginTop: 4 },
  
  rivalsSection: { marginBottom: 24, marginTop: 10 }, 
  rivalCard: { 
      backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rivalTitle: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  rivalName: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  rivalDesc: { color: COLORS.textMuted, fontSize: 13 },
  
  recordsSection: { marginBottom: 24, marginTop: 10 },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recordBox: { 
      width: '48%', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  recordTitle: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  recordValue: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  recordSub: { color: '#64748b', fontSize: 11, textAlign: 'center' },
  
  chartSection: { 
      marginBottom: 24, backgroundColor: '#222', padding: 16, borderRadius: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  chartContainer: { height: 140, paddingBottom: 10, marginTop: 10 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { color: COLORS.textMuted, fontSize: 10 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#333', justifyContent: 'center' },
  gridLabel: { color: '#444', fontSize: 10, position: 'absolute', left: 0, top: -15 },
  lastGamesSection: { marginBottom: 20 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  rankRowDate: { color: COLORS.textMuted, fontSize: 14 },
  rankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  rankBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  
  awardCard: { 
      width: '48%', backgroundColor: COLORS.inputBg, padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  awardTitle: { color: COLORS.success, fontSize: 12, fontWeight: '800', marginTop: 4 }, 
  awardName: { color: COLORS.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginVertical: 2 },
  awardDesc: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
  
  winnerCard: { 
      alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 16, marginBottom: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  winnerText: { color: '#ffd700', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  winnerName: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  winnerScore: { color: COLORS.success, fontSize: 22, fontWeight: '800', marginTop: 4 },

  selectPlayerItem: {
      backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  gameModalInfoBtn: {
      paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.inputBg, borderRadius: 8, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  gameModalTrashBtn: {
      padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8,
      borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', borderTopColor: 'rgba(239, 68, 68, 0.4)', borderLeftColor: 'rgba(239, 68, 68, 0.3)', overflow: 'hidden'
  },
  winnerPopupCard: {
      backgroundColor: COLORS.card, padding: 30, borderRadius: 24, alignItems: 'center', width: '80%', zIndex: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  achievementBox: {
      backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  grandSlamBox: {
      marginTop: 10, padding: 20, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', borderTopColor: 'rgba(255, 255, 255, 0.3)', borderLeftColor: 'rgba(255, 255, 255, 0.2)', overflow: 'hidden'
  }
});