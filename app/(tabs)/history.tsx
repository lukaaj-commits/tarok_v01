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
import { fetchPlayerStats, PlayerStats } from '@/lib/playerStats';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';

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
  const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [loading, setLoading] = useState(true);

  const [showGlobalStatsModal, setShowGlobalStatsModal] = useState(false);
  const [globalStats, setGlobalStats] = useState<PlayerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [globalStatsTab, setGlobalStatsTab] = useState<'classic' | 'index'>('classic');
  
  
  const [showPlayerSelectModal, setShowPlayerSelectModal] = useState(false);
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
  
  // POPRAVEK 1: PAMETNO DELJENJE (Tekst na webu, slika na telefonu)
  const shareResults = async () => {
    try {
      if (Platform.OS === 'web') {
          // 1. NA SPLETU: Knjižnica za slikanje ne deluje, zato delimo tekstovno lestvico!
          let text = `🏆 REZULTATI TAROKA 🏆\n\n`;
          if (winnerData?.names) text += `Zmagovalec: ${winnerData.names} (${winnerData.score} točk)\n\n`;
          
          const sortedPlayers = [...gamePlayers].sort((a,b) => b.total_score - a.total_score);
          sortedPlayers.forEach((p, i) => {
              text += `${i+1}. ${p.name}: ${p.total_score} točk\n`;
          });
          
          // Poskusimo odpreti moderno okno za deljenje (deluje na večini mobilnih brskalnikov)
          if (navigator && navigator.share) {
              await navigator.share({
                  title: 'Rezultati Taroka',
                  text: text,
              });
          } 
          // Če deljenje ni podprto, tekst avtomatsko kopiramo
          else if (navigator && navigator.clipboard) {
              await navigator.clipboard.writeText(text);
              window.alert("Rezultati so skopirani! Zdaj jih lahko prilepiš v katerokoli aplikacijo (SMS, Viber, Messenger).");
          } 
          // Stari brskalniki
          else {
              window.alert(text);
          }
          return; // OBVEZNO: Tukaj zaključimo, da se koda spodaj ne izvede!
      }

      // 2. V PRAVI APLIKACIJI: Tu pa slikanje normalno deluje
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        await Sharing.shareAsync(uri);
      }
    } catch (error) {
      console.log("Napaka pri deljenju:", error);
    }
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
                          <TouchableOpacity onPress={() => openProfile(gamePlayers[0].name)} activeOpacity={0.7} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, width: '100%'}}><Image source={{ uri: getAvatarUrl(gamePlayers[0].name) }} style={[styles.playerAvatar, {width: 70, height: 70, borderRadius: 35, marginRight: 10, borderWidth: 1.5}]} /><Text style={[styles.winnerName, {marginTop: 0, fontSize: 27}]}>{gamePlayers[0].name}</Text></TouchableOpacity>
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
                      
                      <TouchableOpacity onPress={() => openProfile(player.name)} activeOpacity={0.7} style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                          <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 8}]} />
                          <Text style={[styles.playerName, {marginLeft: 0}]} numberOfLines={1}>{player.name || `Igralec ${player.position + 1}`}</Text>
                      </TouchableOpacity>

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
                                    <Text style={[styles.historyPoints, {color: pointsColor}]}>
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