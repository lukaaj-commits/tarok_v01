import { useState, useEffect, useRef } from 'react';
import { PulseDot } from '../../components/Pulse';
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
import { ChevronRight, Trophy, Trash2, Info, TrendingUp, TrendingDown, Calendar, Clock, BarChart2, Swords, Triangle, Circle, Zap, Share2, Lock, Users, X , CalendarDays } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient'; 
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

// @ts-ignore
import ConfettiCannon from 'react-native-confetti-cannon';
import { fetchPlayerStats, PlayerStats } from '@/lib/playerStats';
import { removeGamePhoto } from '@/lib/photo';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import SeasonModal from '@/components/SeasonModal';
import TintBg from '@/components/TintBg';
import { g } from '@/lib/gender';
import { gameMoment as computeMoment } from '@/lib/gameMoment';
import { confirmDialog } from '@/lib/alert';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeTabs from '@/components/SwipeTabs';

// "Zmagovalec" / "Zmagovalka" / "Zmagovalci" glede na spol in število zmagovalcev
const winnerWord = (names: string, upper = false) => {
  const w = names.includes(' & ') ? 'Zmagovalci' : g(names, 'Zmagovalec', 'Zmagovalka');
  return upper ? w.toUpperCase() : w;
};
import HallOfFame from '@/components/HallOfFame';
import GamePhotoButton from '@/components/GamePhotoButton';
import { useMyPlayer } from '@/components/WhoAmI';
import { meRowStyle, meAvatarStyle } from '@/components/MyRow';

// skrbnik: samo on lahko briše igre v Zgodovini
const ADMIN_NAME = 'Luka Š';

type PlayerSummary = { name: string; total_score: number; };

type Game = { 
  id: string; 
  name: string; 
  created_at: string; 
  is_active: boolean; 
  radelci_active: number; 
  radelci_used: number;
  players?: PlayerSummary[]; 
  photo_url?: string | null;   // slika večera
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
  is_penalty?: boolean;
};

const COLORS = {
  bg: '#000000',
  card: 'rgba(255,255,255,0.09)',
  primary: '#0A84FF',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  border: 'rgba(255,255,255,0.10)',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  inputBg: 'rgba(255,255,255,0.08)',
  radelcBorder: '#64D2FF',
  radelcFill: '#3A3A3C',
  playedDot: '#FFFFFF',
  slateBlue: 'rgba(255,255,255,0.09)',
  winnerGrey: '#8E8E93',
  sheet: '#121A2B',
  awardLabel: 'rgba(100,210,255,0.6)',
};

const GRADIENT_COLORS = ['#0A84FF', '#0A84FF']; 
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AVG', 'SEP', 'OKT', 'NOV', 'DEC'];

// Seznam naših pravih igralcev in njihovih slik (USKLAJENO Z BAZO)
const PLAYER_IMAGES: Record<string, string> = {
  "Filip": "https://i.postimg.cc/jW6qppPX/filip01.png",
  "Luka M": "https://i.postimg.cc/FHDntBY5/luka-M02.png",
  "Luka Š": "https://i.postimg.cc/CZCM33kc/luka-S01.png",
  "Mark": "https://i.postimg.cc/t1dRKKWr/mark01.png",
  "Metka": "https://i.postimg.cc/67V6kknj/metka01.png",
  "Miha": "https://i.postimg.cc/8Fdk22M0/miha01.png",
  "Nejc": "https://i.postimg.cc/ph2VRsJQ/nejc01.png",
  "Sara": "https://i.postimg.cc/wy6xgwQQ/sara01.png",
  "Tiffany": "https://i.postimg.cc/7GxPwKnN/tiff01.png",
  "Tina": "https://i.postimg.cc/tZXRpBN5/tina01.png"
};

const getAvatarUrl = (name: string) => {
    const cleanName = name.trim();
    if (PLAYER_IMAGES[cleanName]) {
        return PLAYER_IMAGES[cleanName];
    }
    return `https://api.dicebear.com/8.x/lorelei/png?seed=${encodeURIComponent(cleanName)}&backgroundColor=transparent`;
};

export default function History() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [showGameModal, setShowGameModal] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false); // okno igre se odpre takoj, podatki pridejo za njim
  const detailsReq = useRef(0);
  const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [loading, setLoading] = useState(true);

  const [showGlobalStatsModal, setShowGlobalStatsModal] = useState(false);
  const [globalStats, setGlobalStats] = useState<PlayerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [globalStatsTab, setGlobalStatsTab] = useState<'classic' | 'index' | 'records'>('classic');
  // igralec tega telefona: njegova vrstica je na lestvici poudarjena
  const me = useMyPlayer();
  // skrbniški način: igre lahko briše samo telefon, na katerem je izbran Luka Š
  const isAdmin = me === ADMIN_NAME;
  
  
  const [showPlayerSelectModal, setShowPlayerSelectModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [winnerData, setWinnerData] = useState<{names: string, score: number} | null>(null);


  const viewShotRef = useRef<ViewShot>(null);

  const isFocused = useIsFocused();
  const { openProfile, showProfile } = usePlayerProfile();
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
    // Okno odpremo takoj (z nalaganjem), da je odziv na pritisk takojšen
    const req = ++detailsReq.current;
    setGamePlayers([]); setRadelci([]); setPlayerHistory([]);
    setSelectedGame(game);
    setDetailsLoading(true);
    setShowGameModal(true);
    try {
      const [playersResult, radelciResult, historyResult] = await Promise.all([
        supabase.from('players').select('*').eq('game_id', game.id).order('total_score', { ascending: false }),
        supabase.from('radelci').select('*').eq('game_id', game.id).order('position'),
        supabase.from('score_entries').select('*').eq('game_id', game.id).order('created_at', { ascending: true })
      ]);
      if (req !== detailsReq.current) return; // medtem je bila odprta druga igra
      if (playersResult.error) throw playersResult.error;
      if (radelciResult.error) throw radelciResult.error;
      setGamePlayers(playersResult.data || []);
      setRadelci(radelciResult.data || []);
      setPlayerHistory(historyResult.data || []);
    } catch (error) { console.error('Error loading game details:', error); }
    finally { if (req === detailsReq.current) setDetailsLoading(false); }
  };

  const penaltyEntryIds = new Set<string>();
  if (!selectedGame?.is_active && playerHistory.length > 0) {
      const timestamps = playerHistory.map(e => new Date(e.created_at).getTime()).filter(t => !isNaN(t));
      if (timestamps.length > 0) {
          const maxTime = Math.max(...timestamps);
          playerHistory.forEach(e => {
              const eTime = new Date(e.created_at).getTime();
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

      // TUKAJ JE VIZUALNA OMEJITEV NA MAX 5
      const MAX_DOTS = 5;
      const displayDots = dots.slice(0, MAX_DOTS);
      const overflowCount = dots.length - MAX_DOTS;

      return (
          <View style={[styles.radelciContainer, centered && { justifyContent: 'center', marginTop: 10, marginLeft: 0 }]}>
              {displayDots}
              {overflowCount > 0 && <Text style={{color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginLeft: 2}}>+{overflowCount}</Text>}
          </View>
      );
  };

  const endGame = async (gameId: string) => {
      const ok = await confirmDialog({ title: 'Zaključi igro?', message: 'Ali želiš zaključiti to igro?', confirmText: 'Zaključi' });
      if (ok) await performEndGame(gameId);
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
      const ok = await confirmDialog({ title: 'Izbriši igro?', message: 'Igra in vsi njeni vpisi bodo trajno izbrisani.', confirmText: 'Izbriši', destructive: true });
      if (ok) await performDeleteGame(gameId);
  };
  
  const performDeleteGame = async (gameId: string) => {
      try {
          const { error } = await supabase.from('games').delete().eq('id', gameId);
          if (error) throw error;
          await removeGamePhoto(gameId); // skupaj z igro izgine tudi slika večera
          setShowGameModal(false); await loadGames();
      } catch (e) { console.error(e); }
  };

  // Potek igre: vsi vpisi te igre so že naloženi ob odprtju podrobnosti, zato se okno odpre takoj
  const loadAllPlayersHistory = async () => {
    if (!selectedGame) return;
    setSelectedPlayerName('Vsi igralci'); setShowPlayerHistoryModal(true);
  };

// osvežitev statistike brez krogca čez celo okno (za "potegni za osvežitev")
  const [statsVersion, setStatsVersion] = useState(0);
  const refreshStats = async () => { try { setGlobalStats(await fetchPlayerStats()); setStatsVersion(v => v + 1); } catch (e) { console.error(e); } };

const loadGlobalStats = async (destination: 'leaderboard' | 'select' = 'leaderboard') => {
    setStatsLoading(true);
    if (destination === 'leaderboard') setShowGlobalStatsModal(true);
    else setShowPlayerSelectModal(true);
    try {
        // Izračun je v lib/playerStats.ts (skupen za vse zaslone)
        setGlobalStats(await fetchPlayerStats());
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
    if (pohlepnez && pohlepnez.playedCount > 0) { awards.push({ t: "Pohlepnež", n: pohlepnez.name, i: "💰", d: `${g(pohlepnez.name, 'Odigral', 'Odigrala')} ${pohlepnez.playedCount} iger.` }); assignedIds.add(pohlepnez.id); }

    const pijavka = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => b.partnerCount - a.partnerCount)[0];
    if (pijavka && pijavka.partnerCount > 0) { awards.push({ t: "Pijavka", n: pijavka.name, i: "🦟", d: `${g(pijavka.name, 'Klican', 'Klicana')} ${pijavka.partnerCount}-krat.` }); assignedIds.add(pijavka.id); }

    const beggarCandidate = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => b.beggarCount - a.beggarCount)[0];
    if (beggarCandidate && beggarCandidate.beggarCount >= 2) { awards.push({ t: "Socialni problem", n: beggarCandidate.name, i: "🙏", d: `Berač ${beggarCandidate.beggarCount}-krat.` }); assignedIds.add(beggarCandidate.id); } 
    else {
      const kamikaza = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => a.minus - b.minus)[0];
      if (kamikaza && kamikaza.minus < 0) { awards.push({ t: "Kamikaza", n: kamikaza.name, i: "🧨", d: `${kamikaza.minus} minus točk.` }); assignedIds.add(kamikaza.id); }
    }

    const turist = [...stats].filter(s => !assignedIds.has(s.id)).sort((a, b) => a.actions - b.actions)[0];
    if (turist) awards.push({ t: "Turist", n: turist.name, i: "📸", d: `Najmanj ${g(turist.name, 'sodeloval', 'sodelovala')}.` });

    return awards.slice(0, 4);
  };

  // Moment večera (logika v lib/gameMoment.ts)
  const gameMoment = () => computeMoment(gamePlayers, playerHistory);

  const renderGameIcon = (entry: ScoreEntry) => {
    const iconColor = entry.is_valat ? COLORS.warning : "#fff";
    if (entry.is_beggar) return <Triangle size={8} color={iconColor} fill={iconColor} style={{ opacity: 0.9 }} />;
    if (entry.is_partner) return <Circle size={8} color={iconColor} style={{ opacity: 0.8 }} />;
    if (entry.played) return <View style={[styles.playedDot, entry.is_valat && {backgroundColor: COLORS.warning}]} />;
    return null;
  };
  

  // Kazen za neporabljene radelce: en krogec za vsakih −50 (največ 3, nato +N)
  const renderPenaltyRings = (points: number) => {
    const count = Math.max(1, Math.round(Math.abs(points) / 50));
    const shown = Math.min(count, 3);
    return (
      <View style={styles.dotBox}>
        {/* krogci segajo desno čez okvir, da točke ostanejo poravnane z ostalimi vrsticami */}
        <View style={styles.penaltyRings}>
          {Array.from({ length: shown }, (_, i) => <View key={i} style={[styles.radelc, styles.radelcUnused]} />)}
          {count > 3 && <Text style={styles.penaltyMore}>+{count - 3}</Text>}
        </View>
      </View>
    );
  };


  const openGlobalPlayerDetails = (player: PlayerStats) => {
      showProfile(player);
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
        <Text style={{ color: COLORS.winnerGrey, fontSize: 13, marginTop: 3 }}>
            {game.is_active ? "Trenutno vodilni: " : `${winnerWord(names)}: `}<Text style={{ fontWeight: '600', color: '#EBEBF5' }}>{names} ({maxScore})</Text>
        </Text>
    );
  };

  const renderGame = ({ item, index }: { item: Game; index: number }) => {
    const d = new Date(item.created_at);
    const year = d.getFullYear();
    const prevYear = index > 0 ? new Date(games[index - 1].created_at).getFullYear() : null;
    // letnica pred prvo igro starejšega leta (pri tekočem letu nič)
    const showYear = year !== new Date().getFullYear() && year !== prevYear;
    const title = getFormattedTitle(item);
    const comma = title.indexOf(', ');
    return (
      <View>
        {showYear && <Text style={styles.yearLabel}>{year}</Text>}
        <TouchableOpacity style={styles.gameCard} onPress={() => loadGameDetails(item)} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.calLeaf}>
                    <Text style={[styles.calMonth, !item.is_active && { color: COLORS.danger }]}>{MONTHS_SHORT[d.getMonth()]}</Text>
                    <Text style={styles.calDay}>{d.getDate()}</Text>
                </View>
                <View style={{flex: 1, justifyContent: 'center'}}>
                    <Text style={styles.gameTitleCombined}>{comma > 0 ? title.slice(0, comma) : title}{comma > 0 && <Text style={styles.gameTitleDate}>{title.slice(comma)}</Text>}</Text>
                    {renderGameWinner(item)}
                </View>
                {item.is_active ? <View style={styles.activeBadge}><PulseDot color="#fff" size={6} /><Text style={styles.activeBadgeText}>V TEKU</Text></View> : <ChevronRight size={18} color="#636366" />}
            </View>
        </TouchableOpacity>
      </View>
    );
  };


  const classicSortedStats = [...globalStats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins; if (b.second !== a.second) return b.second - a.second; return b.third - a.third;
  });

  const indexSortedStats = [...globalStats].filter(s => s.total_games >= 5).sort((a, b) => b.avg_performance - a.avg_performance);

  // vrstice lestvice (enak izgled kot prej); tvoja vrstica je poudarjena
  const rankBadge = (rank: number) => rank === 1 ? <Trophy size={20} color="#FFD60A" /> : rank === 2 ? <Trophy size={20} color="#D1D1D6" /> : rank === 3 ? <Trophy size={20} color="#FF9F0A" /> : <Text style={[styles.rankText, {fontSize: 15, color: COLORS.textMuted}]}>{rank}.</Text>;
  // lineHidden: vrstica tik nad tvojo nima ločilne črte (da se ne dotika modre podlage)
  const classicRow = (stat: PlayerStats, lineHidden = false) => {
    const rank = classicSortedStats.findIndex(s => s.wins === stat.wins && s.second === stat.second && s.third === stat.third) + 1;
    const mine = stat.name === me;
    return (
      <TouchableOpacity key={stat.name} style={[styles.leaderboardItem, lineHidden && { borderBottomColor: 'transparent' }, mine && meRowStyle]} onPress={() => openGlobalPlayerDetails(stat)}>
        <View style={{width: 32, alignItems: 'center', justifyContent: 'center'}}>{rankBadge(rank)}</View>
        <Image source={{ uri: getAvatarUrl(stat.name) }} style={[styles.playerAvatar, {width: 34, height: 34, borderRadius: 17, marginLeft: 4, marginRight: 10}, mine && meAvatarStyle]} />
        <View style={{flex: 1, justifyContent: 'center'}}><Text style={[styles.leaderboardName, {fontSize: 16}, mine && { fontWeight: '600' }]}>{stat.name}</Text><Text style={{color: COLORS.textMuted, fontSize: 12}}>{stat.total_games} iger</Text></View>
        <View style={{flexDirection: 'row', gap: 14, alignItems: 'center'}}>
          <View style={styles.medalBox}><Trophy size={14} color="#FFD60A" /><Text style={styles.medalText}>{stat.wins}</Text></View>
          <View style={styles.medalBox}><Trophy size={14} color="#D1D1D6" /><Text style={styles.medalText}>{stat.second}</Text></View>
          <View style={styles.medalBox}><Trophy size={14} color="#FF9F0A" /><Text style={styles.medalText}>{stat.third}</Text></View>
          <ChevronRight size={16} color={COLORS.textMuted} style={{marginLeft: 2}} />
        </View>
      </TouchableOpacity>
    );
  };
  const indexRow = (stat: PlayerStats, lineHidden = false) => {
    const rank = indexSortedStats.findIndex(s => s.avg_performance === stat.avg_performance) + 1;
    const showUp = stat.avg_performance > stat.prev_performance;
    const showDown = stat.avg_performance < stat.prev_performance;
    const mine = stat.name === me;
    return (
      <TouchableOpacity key={stat.name} style={[styles.leaderboardItem, lineHidden && { borderBottomColor: 'transparent' }, mine && meRowStyle]} onPress={() => openGlobalPlayerDetails(stat)}>
        <View style={{width: 32, alignItems: 'center', justifyContent: 'center'}}>{rankBadge(rank)}</View>
        <Image source={{ uri: getAvatarUrl(stat.name) }} style={[styles.playerAvatar, {width: 34, height: 34, borderRadius: 17, marginLeft: 4, marginRight: 10}, mine && meAvatarStyle]} />
        <View style={{flex: 1, justifyContent: 'center'}}><Text style={[styles.leaderboardName, {fontSize: 16}, mine && { fontWeight: '600' }]}>{stat.name}</Text><Text style={{color: COLORS.textMuted, fontSize: 12}}>{stat.total_games} iger</Text></View>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4}}>
          {showUp && <TrendingUp size={14} color={COLORS.success} style={{marginRight: 8}} />}
          {showDown && <TrendingDown size={14} color={COLORS.danger} style={{marginRight: 8}} />}
          <Text style={{color: COLORS.text, fontSize: 18, fontWeight: '600'}}>{Math.round(stat.avg_performance)} %</Text>
        </View>
      </TouchableOpacity>
    );
  };


  if (loading) return (<View style={styles.container}><Text style={styles.loadingText}>Nalaganje...</Text></View>);

  return (
    <View style={styles.container}>
      <View style={styles.mainHeader}>
          <Text style={styles.headerSub}>{(() => { const n = games.filter(g => !g.is_active).length; return `${n} ${n % 100 === 1 ? 'odigrana igra' : n % 100 === 2 ? 'odigrani igri' : n % 100 === 3 || n % 100 === 4 ? 'odigrane igre' : 'odigranih iger'}`; })()}</Text>
          <View style={styles.tileRow}>
              <TouchableOpacity style={styles.tile} onPress={() => setShowSeasonModal(true)} activeOpacity={0.7}><CalendarDays size={21} color={COLORS.primary} /><Text style={styles.tileText}>Sezona</Text></TouchableOpacity>
              <TouchableOpacity style={styles.tile} onPress={() => loadGlobalStats('select')} activeOpacity={0.7}><Users size={21} color={COLORS.primary} /><Text style={styles.tileText}>Igralci</Text></TouchableOpacity>
              <TouchableOpacity style={styles.tile} onPress={() => loadGlobalStats('leaderboard')} activeOpacity={0.7}><Trophy size={21} color={COLORS.primary} /><Text style={styles.tileText}>Lestvica</Text></TouchableOpacity>
          </View>
      </View>

      <SeasonModal visible={showSeasonModal} onClose={() => setShowSeasonModal(false)} />

      <Modal visible={showPlayerSelectModal} transparent animationType="fade" onRequestClose={() => setShowPlayerSelectModal(false)}>
         <View style={styles.centerOverlay}>
            <View style={[styles.gameModalCard, {width: '88%', maxHeight: '75%'}]}>
                <Text style={[styles.modalTitle, {marginBottom: 20}]}>Izberi igralca</Text>
                {statsLoading ? (<ActivityIndicator size="large" color={COLORS.primary} style={{marginVertical: 40}} />) : (
                    <PullToRefresh style={{ flexShrink: 1, width: '100%' }} onRefresh={refreshStats}>{(scrollProps) => (
                    <ScrollView {...scrollProps} style={{width: '100%'}} showsVerticalScrollIndicator={false}>
                        {[...globalStats].sort((a, b) => a.name.localeCompare(b.name)).map(stat => (
                            <TouchableOpacity key={stat.name} style={styles.selectPlayerItem} onPress={() => { setShowPlayerSelectModal(false); openGlobalPlayerDetails(stat); }}>
                                <View style={{flexDirection: 'row', alignItems: 'center'}}><Image source={{ uri: getAvatarUrl(stat.name) }} style={[styles.playerAvatar, {width: 36, height: 36, borderRadius: 18, marginRight: 12}]} /><Text style={{color: '#fff', fontSize: 16, fontWeight: '500'}}>{stat.name}</Text></View>
                                <ChevronRight size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    )}</PullToRefresh>
                )}
                <TouchableOpacity style={[styles.closeButton, styles.glassButton, {marginTop: 12}]} onPress={() => setShowPlayerSelectModal(false)}><Text style={styles.closeButtonText}>Prekliči</Text></TouchableOpacity>
            </View>
         </View>
      </Modal>

      <PullToRefresh onRefresh={loadGames}>{(scrollProps) => (
      <FlatList {...scrollProps} data={games} keyExtractor={(item) => item.id} renderItem={renderGame} contentContainerStyle={styles.listContainer} ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Ni še nobene igre</Text></View>} />
      )}</PullToRefresh>

      <Modal visible={showGlobalStatsModal} transparent animationType="slide" onRequestClose={() => setShowGlobalStatsModal(false)}>
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.historyModal]}>
                <Text style={[styles.modalTitle, { marginBottom: 16 }]}>Lestvica</Text>
                <View style={styles.tabContainer}>
                    <TouchableOpacity style={[styles.tabButton, globalStatsTab === 'classic' && styles.tabButtonActive]} onPress={() => setGlobalStatsTab('classic')}><Text style={[styles.tabText, globalStatsTab === 'classic' && styles.tabTextActive]}>Po zmagah</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.tabButton, globalStatsTab === 'index' && styles.tabButtonActive]} onPress={() => setGlobalStatsTab('index')}><Text style={[styles.tabText, globalStatsTab === 'index' && styles.tabTextActive]}>Indeks %</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.tabButton, globalStatsTab === 'records' && styles.tabButtonActive]} onPress={() => setGlobalStatsTab('records')}><Text style={[styles.tabText, globalStatsTab === 'records' && styles.tabTextActive]}>Rekordi</Text></TouchableOpacity>
                </View>
                {statsLoading ? (<ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 20}} />) : (
                    <SwipeTabs fill style={{ flex: 1 }} index={['classic', 'index', 'records'].indexOf(globalStatsTab)} onChange={i => setGlobalStatsTab((['classic', 'index', 'records'] as const)[i])}>
                            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                                {classicSortedStats.map((stat, i, arr) => classicRow(stat, arr[i + 1]?.name === me))}
                            </ScrollView>
                            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                                {indexSortedStats.length === 0 ? (<View style={{alignItems: 'center', marginTop: 40}}><BarChart2 size={40} color={COLORS.textMuted} style={{marginBottom: 10}} /><Text style={{color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20}}>Še noben igralec ni odigral dovolj iger za izračun indeksa.</Text></View>) : (
                                    indexSortedStats.map((stat, i, arr) => indexRow(stat, arr[i + 1]?.name === me))
                                )}
                                <Text style={{color: '#636366', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 10, lineHeight: 15}}>* Prikazani so le igralci z vsaj 5 odigranimi igrami. Puščica označuje spremembo po zadnji igri.</Text>
                            </ScrollView>
                            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                                <HallOfFame key={statsVersion} />
                            </ScrollView>
                    </SwipeTabs>
                )}
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowGlobalStatsModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
            </View>
         </View>
      </Modal>

      <Modal visible={showGameModal} transparent animationType="fade" onRequestClose={() => setShowGameModal(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.gameModalCard}>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <TouchableOpacity style={styles.gameModalInfoBtn} onPress={() => { if (!detailsLoading) loadAllPlayersHistory(); }}><Info size={17} color="#fff" /><Text style={{color: '#fff', marginLeft: 7, fontWeight: '500', fontSize: 14}}>Potek igre</Text></TouchableOpacity>
              {isAdmin && !selectedGame?.is_active && selectedGame && (<TouchableOpacity style={styles.gameModalTrashBtn} onPress={() => deleteGame(selectedGame.id)}><Trash2 size={17} color={COLORS.danger} /></TouchableOpacity>)}
            </View>

            <ScrollView style={styles.playersListContainer} showsVerticalScrollIndicator={false}>
              <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1.0 }}>
                <View style={{ backgroundColor: COLORS.sheet, paddingTop: 8, paddingBottom: 6 }}>
                  <Text style={[styles.modalTitle, { fontSize: 19, marginBottom: 14 }]}>{selectedGame ? getFormattedTitle(selectedGame) : 'Igra'}</Text>
                  <Text style={styles.sectionLabel}>Končna lestvica</Text>
                  {detailsLoading && (<ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 60 }} />)}
                  
                  {!selectedGame?.is_active && gamePlayers.length > 0 && (
                      <TouchableOpacity onPress={() => openProfile(gamePlayers[0].name)} activeOpacity={0.8} style={styles.winnerCard}>
                          <TintBg />
                          <Trophy size={24} color="#FFD60A" />
                          <Image source={{ uri: getAvatarUrl(gamePlayers[0].name) }} style={[styles.playerAvatar, { width: 52, height: 52, borderRadius: 26 }]} />
                          <View style={{ flex: 1, gap: 3 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={styles.winnerText}>{winnerWord(gamePlayers[0].name, true)}</Text>
                                  {renderRadelciDots(gamePlayers[0].id, false)}
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                  <Text style={styles.winnerName} numberOfLines={1}>{gamePlayers[0].name}</Text>
                                  <View style={[styles.pointsPill, gamePlayers[0].total_score < 0 && styles.pillNeg]}><Text style={[styles.pointsPillText, gamePlayers[0].total_score < 0 && { color: COLORS.danger }]}>{gamePlayers[0].total_score} točk</Text></View>
                              </View>
                          </View>
                      </TouchableOpacity>
                  )}
                  
                  {gamePlayers.map((player, index, array) => {
                    if (!selectedGame?.is_active && index === 0) return null;
                    const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                    return (
                      <View key={player.id} style={styles.playerRowContainer}>
                      <View style={styles.rankContainer}>{rank === 1 && <Trophy size={19} color="#FFD60A" />}{rank === 2 && <Trophy size={19} color="#D1D1D6" />}{rank === 3 && <Trophy size={19} color="#FF9F0A" />}{rank > 3 && (<Text style={styles.rankNumber}>{rank}</Text>)}</View>
                      
                      <TouchableOpacity onPress={() => openProfile(player.name)} activeOpacity={0.7} style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                          <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 10}]} />
                          <Text style={[styles.playerName, {marginLeft: 0}]} numberOfLines={1}>{player.name || `Igralec ${player.position + 1}`}</Text>
                      </TouchableOpacity>

                      {renderRadelciDots(player.id, false)}
                      <Text style={[styles.playerScore, player.total_score > 0 ? styles.positiveScore : player.total_score < 0 ? styles.negativeScore : styles.neutralScore]}>{player.total_score}</Text>
                    </View>
                    );
                  })}

                  {!selectedGame?.is_active && gamePlayers.length > 0 && calculateGameAwards().length > 0 && (
                    <View style={{marginTop: 18}}>
                      <Text style={styles.sectionLabel}>Izstopajoči igralci</Text>
                      <View style={styles.awardsGrid}>
                        {calculateGameAwards().map((award, i) => (
                          <View key={i} style={styles.awardCard}>
                            <Text style={styles.awardTitle}>{award.t}</Text>
                            <Text style={styles.awardName} numberOfLines={1}>{award.n}</Text>
                            <Text style={styles.awardDesc}>{award.d}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Moment večera: en stavek o tem, kaj je zaznamovalo igro */}
                  {!selectedGame?.is_active && !detailsLoading && (() => {
                    const m = gameMoment();
                    if (!m) return null;
                    return (
                      <View style={{ marginTop: 18 }}>
                        <Text style={styles.sectionLabel}>Moment večera</Text>
                        <Text style={styles.momentText}>{m}</Text>
                      </View>
                    );
                  })()}
                </View>
              </ViewShot>
            </ScrollView>

            <View style={styles.modalButtons}>
              {selectedGame?.is_active ? (<TouchableOpacity style={[styles.closeButton, styles.closeButtonFlex]} onPress={() => setShowGameModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>) : (
                <>
                  {selectedGame && (
                    <GamePhotoButton
                      key={selectedGame.id}
                      gameId={selectedGame.id}
                      photoUrl={selectedGame.photo_url}
                      title={getFormattedTitle(selectedGame)}
                      style={{ flex: 1 }}
                      onChange={url => {
                        setSelectedGame(g => (g ? { ...g, photo_url: url } : g));
                        setGames(list => list.map(x => (x.id === selectedGame.id ? { ...x, photo_url: url } : x)));
                      }}
                    />
                  )}
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
            <Text style={styles.modalTitle}>Potek igre</Text>
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
                        <View style={styles.playerRankBadge}>{rank === 1 && <Trophy size={16} color="#FFD60A" />}{rank === 2 && <Trophy size={16} color="#D1D1D6" />}{rank === 3 && <Trophy size={16} color="#FF9F0A" />}{rank > 3 && (<Text style={styles.playerRankText}>{rank}</Text>)}</View>
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 8}]} />
                        <Text style={styles.playerHistorySectionTitle}>{playerName} <Text style={{fontWeight: '400', fontSize: 12, color: COLORS.winnerGrey}}>({g(playerName, 'Igral', 'Igrala')}: {playedCount})</Text></Text>
                        <Text style={[styles.playerTotalScore, player.total_score > 0 ? styles.positivePoints : player.total_score < 0 ? styles.negativePoints : styles.neutralScore]}>{player.total_score}</Text>
                      </View>

                      {playerEntries.map((entry, index) => {
                        let runningTotal = 0;
                        for (let i = 0; i <= index; i++) { runningTotal += playerEntries[i].points; }
                        
                        const isPenalty = penaltyEntryIds.has(entry.id) || !!entry.is_penalty;
                        const pointsColor = isPenalty ? COLORS.warning : (entry.is_valat ? COLORS.warning : (entry.points > 0 ? styles.positivePoints.color : styles.negativePoints.color));

                        return (
                          <View key={entry.id} style={styles.historyItem}>
                             <View style={styles.pointsWrapper}>
                                <View style={styles.fixedPointsBox}>
                                    <Text style={[styles.historyPoints, {color: pointsColor}]}>
                                        {entry.points > 0 ? '+' : ''}{entry.points}
                                    </Text>
                                </View>
                                {isPenalty ? renderPenaltyRings(entry.points) : <View style={styles.dotBox}>{renderGameIcon(entry)}</View>}
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
        <View style={[styles.centerOverlay, { backgroundColor: 'rgba(0,0,0,0.88)' }]}>
            <View style={styles.winnerPopupCard}>
                <TouchableOpacity style={styles.popupClose} onPress={() => setShowWinnerPopup(false)}><X size={16} color="#AEAEB2" /></TouchableOpacity>
                <Trophy size={52} color="#FFD60A" style={{marginBottom: 12}} strokeWidth={1.6} />
                <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 2.5, marginBottom: 12}}>{winnerWord(winnerData?.names || '', true)}</Text>
                {winnerData?.names && (<View style={{ width: 84, height: 84, marginBottom: 12 }}><Image source={{ uri: getAvatarUrl(winnerData.names.split(' & ')[0]) }} style={[styles.playerAvatar, {width: 84, height: 84, borderRadius: 42}]} /></View>)}
                <Text style={{color: COLORS.text, fontSize: 30, fontWeight: '600', textAlign: 'center', marginBottom: 8}}>{winnerData?.names}</Text>
                <View style={[styles.pointsPillBig, (winnerData?.score ?? 0) < 0 && styles.pillNeg]}>
                    <Text style={{color: (winnerData?.score ?? 0) < 0 ? COLORS.danger : COLORS.success, fontSize: 20, fontWeight: '600'}}>{winnerData?.score} točk</Text>
                </View>
            </View>
            {showWinnerPopup && (<View pointerEvents="none" style={StyleSheet.absoluteFillObject}><ConfettiCannon count={200} origin={{x: -10, y: 0}} autoStart={true} fadeOut={true} fallSpeed={2500} /></View>)}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  mainHeader: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 15, color: COLORS.textMuted, marginBottom: 14, paddingHorizontal: 4 },
  
  absoluteGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  relativeContent: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  relativeContentVertical: { position: 'relative', zIndex: 1, alignItems: 'center', width: '100%' },

  globalStatsButton: {
      paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden'
  },
  
  subTitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 15 },
  listContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 10 },
  cardWrapper: { }, 
  gameCard: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  gameTitleCombined: { color: '#fff', fontSize: 16, fontWeight: '600' },
  activeBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 9, height: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, marginBottom: 8, textAlign: 'center', paddingHorizontal: 20 },
  loadingText: { color: COLORS.text, fontSize: 18, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  
  modalContent: { backgroundColor: COLORS.sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, maxHeight: '88%', borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', borderBottomWidth: 0, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 12 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '600', textAlign: 'center' },
  headerInfoButton: { padding: 4 },
  playersListContainer: { marginBottom: 14 },
  
  playerRowContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, gap: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  rankContainer: { width: 26, alignItems: 'center' },
  rankNumber: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
  
  playerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)' },
  
  playerName: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '500', marginLeft: 4 },
  playerScore: { fontSize: 17, fontWeight: '600', minWidth: 48, textAlign: 'right' },
  positiveScore: { color: COLORS.success },
  negativeScore: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 10 },
  
  closeButton: { backgroundColor: COLORS.primary, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeButtonFlex: { flex: 1 },
  closeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  radelciContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  radelc: { width: 8, height: 8, borderRadius: 4 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.radelcBorder },
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 },
  historyModal: { height: '85%', maxHeight: '85%' }, 
  historyList: { flex: 1, marginBottom: 16 },
  playerHistorySection: { marginBottom: 24 },
  
  playerHistoryHeader: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, marginBottom: 4, gap: 10 },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '600' },
  playerTotalScore: { fontSize: 18, fontWeight: '600' },
  
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  fixedPointsBox: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotBox: { width: 20, alignItems: 'center', justifyContent: 'center' },
  penaltyRings: { position: 'absolute', left: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  penaltyMore: { color: COLORS.radelcBorder, fontSize: 11, fontWeight: '600', marginLeft: 1 },
  historyPoints: { fontSize: 16, fontWeight: '600' },
  positivePoints: { color: COLORS.success },
  negativePoints: { color: COLORS.danger },
  historyTotal: { color: '#AEAEB2', fontSize: 15, fontWeight: '400', flex: 1, textAlign: 'center' },
  historyDate: { color: '#636366', fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.playedDot },
  
  tabContainer: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', marginBottom: 8, borderRadius: 12, padding: 3 },
  tabButton: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabButtonActive: { backgroundColor: COLORS.primary, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.25)' },
  tabText: { color: '#AEAEB2', fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  rankText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' }, 
  leaderboardName: { color: COLORS.text, fontSize: 16, fontWeight: '500', flex: 1 },
  medalBox: { flexDirection: 'row', alignItems: 'center', minWidth: 34 },
  medalText: { color: '#fff', fontWeight: '400', marginLeft: 5, fontSize: 15 },
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailScroll: { flex: 1, marginBottom: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: '600', marginBottom: 10 },
  
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
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  
  awardCard: { width: '48.5%', backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
  awardTitle: { color: COLORS.awardLabel, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }, 
  awardName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginVertical: 1 },
  awardDesc: { color: COLORS.textMuted, fontSize: 12 },
  momentText: { color: COLORS.text, fontSize: 15, lineHeight: 21, fontStyle: 'italic' },
  
  winnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 96, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, marginBottom: 8, backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  winnerText: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', letterSpacing: 1.6 },
  winnerName: { color: COLORS.text, fontSize: 22, fontWeight: '600', flexShrink: 1 },
  winnerScore: { color: COLORS.success, fontSize: 22, fontWeight: '800', marginTop: 4 },

  selectPlayerItem: { paddingVertical: 10, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  gameModalInfoBtn: { height: 36, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', borderRadius: 18, flexDirection: 'row', alignItems: 'center' },
  gameModalTrashBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  winnerPopupCard: { backgroundColor: COLORS.sheet, paddingVertical: 30, paddingHorizontal: 22, borderRadius: 28, alignItems: 'center', width: '84%', maxWidth: 380, zIndex: 10, borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', overflow: 'hidden' },
  achievementBox: {
      backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  grandSlamBox: {
      marginTop: 10, padding: 20, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', borderTopColor: 'rgba(255, 255, 255, 0.3)', borderLeftColor: 'rgba(255, 255, 255, 0.2)', overflow: 'hidden'
  },
  // --- nov dizajn (D3) ---
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, height: 66, borderRadius: 16, backgroundColor: '#121A2B', borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tileText: { color: COLORS.text, fontSize: 12, fontWeight: '500' },
  yearLabel: { color: COLORS.text, fontSize: 20, fontWeight: '600', paddingHorizontal: 4, paddingTop: 10, paddingBottom: 8 },
  calLeaf: { width: 46, height: 50, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  calMonth: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color: COLORS.primary },
  calDay: { fontSize: 20, lineHeight: 24, fontWeight: '600', color: COLORS.text },
  gameTitleDate: { color: COLORS.textMuted, fontSize: 14, fontWeight: '400' },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  gameModalCard: { width: '92%', maxWidth: 440, maxHeight: '88%', backgroundColor: COLORS.sheet, borderRadius: 28, padding: 16, borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', overflow: 'hidden' },
  sectionLabel: { color: COLORS.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 },
  pointsPill: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(48,209,88,0.18)', justifyContent: 'center' },
  pointsPillText: { color: COLORS.success, fontSize: 14, fontWeight: '600' },
  pillNeg: { backgroundColor: 'rgba(255,69,58,0.16)' },
  pointsPillBig: { height: 38, paddingHorizontal: 18, borderRadius: 19, backgroundColor: 'rgba(48,209,88,0.16)', justifyContent: 'center' },
  popupClose: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  glassButton: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)' },
});