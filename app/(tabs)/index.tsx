import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Image
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, Info, Trash2, RotateCcw, Play, ChevronLeft, Trophy, Search, UserPlus, CheckCircle2, Delete, Circle, Triangle, X } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient'; 
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

// @ts-ignore
import ConfettiCannon from 'react-native-confetti-cannon';

type PlayerProfile = { id: string; name: string; };
type Player = { id: string; name: string; total_score: number; position: number; profile_id?: string; };
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

type Game = { 
  id: string; 
  name: string; 
  created_at: string; 
  is_active: boolean; 
  radelci_active: number; 
  radelci_used: number;
  players?: PlayerSummary[]; 
};

type PlayerSummary = { name: string; total_score: number; };

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
  winnerGrey: 'rgb(148, 163, 184)',
  closeBtn: 'rgb(88, 99, 234)',
  confirmTeal: '#20B2AA'
};

const GRADIENT_COLORS = ['#556eeb', '#6050ea']; 
const CHART_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#FF9F1C', '#C7F464', '#9D4EDD', '#F72585'
];

const getAvatarUrl = (name: string) => {
    const cleanName = name.trim();
    return `https://api.dicebear.com/8.x/lorelei/png?seed=${encodeURIComponent(cleanName)}&backgroundColor=transparent`;
};

export default function ActiveGame() {
  const [activeGamesList, setActiveGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false); 
  
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [allProfiles, setAllProfiles] = useState<PlayerProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); 
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false); 
  const [showFinishGameModal, setShowFinishGameModal] = useState(false);
  const [showKlopModal, setShowKlopModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [scoreMode, setScoreMode] = useState<'none' | 'played' | 'partner' | 'beggar'>('none');
  
  // STANJA ZA VALAT MODAL
  const [showValatModal, setShowValatModal] = useState(false);
  const [pendingValatPoints, setPendingValatPoints] = useState<number | null>(null);

  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [allGameHistory, setAllGameHistory] = useState<ScoreEntry[]>([]); 
  
  const [leaderboardTab, setLeaderboardTab] = useState<'list' | 'chart'>('list');
  const [isInputActive, setIsInputActive] = useState(false);

  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [winnerData, setWinnerData] = useState<{names: string, score: number} | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chartWidth, setChartWidth] = useState(0);

  const viewShotRef = useRef<ViewShot>(null);

  useFocusEffect(useCallback(() => { fetchActiveGamesList(); }, []));
  useEffect(() => { fetchProfiles(false); }, []);

  useEffect(() => {
    if (showAddPlayerModal) {
      setIsInputActive(false); 
      setSearchQuery('');
      setSelectedProfileIds(new Set()); 
    }
  }, [showAddPlayerModal]);

  useEffect(() => {
      if (!showLeaderboardModal) {
          setFocusedPlayerId(null);
      }
  }, [showLeaderboardModal]);

  const fetchActiveGamesList = async () => {
    if (!gameId) setLoading(true);
    try {
      const { data } = await supabase
        .from('games')
        .select('*, players(name, total_score)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
      setActiveGamesList(data as any || []);
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

  const fetchProfiles = async (showDebug = false) => {
    try {
      const { data, error } = await supabase.from('player_profiles').select('id, name').order('name');
      if (error) { if (showDebug) Alert.alert("NAPAKA", error.message); return; }
      setAllProfiles(data || []);
    } catch (err: any) { if (showDebug) Alert.alert("NAPAKA", err.message); }
  };

  const enterGame = async (selectedGame: Game) => {
    setLoading(true);
    try {
      setGameId(selectedGame.id);
      setGameName(selectedGame.name);
      await loadPlayers(selectedGame.id);
      await loadRadelci(selectedGame.id);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const exitToLobby = () => {
    setGameId(null); setPlayers([]); setRadelci([]); fetchActiveGamesList();
  };

  const handleStartNewGame = async () => { createGameInDb(); };

  const createGameInDb = async () => {
    setLoading(true);
    try {
      const newName = `${new Date().toLocaleDateString('sl-SI')} Tarok ${new Date().toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}`;
      const { data: newGame, error } = await supabase.from('games').insert({ name: newName, is_active: true }).select().single();
      if (error) throw error;
      await fetchActiveGamesList(); await enterGame(newGame);
    } catch (error) { Alert.alert("Napaka", "Ni bilo mogoče ustvariti igre."); } finally { setLoading(false); }
  };

  const loadPlayers = async (gId: string) => {
    const { data } = await supabase.from('players').select('*').eq('game_id', gId).order('position');
    setPlayers(data || []);
  };

  const loadRadelci = async (gId: string) => {
    const { data } = await supabase.from('radelci').select('*').eq('game_id', gId).order('position');
    setRadelci(data || []);
  };

  const openAddPlayerModal = () => {
    setSearchQuery(''); 
    setShowAddPlayerModal(true); 
    fetchProfiles(false); 
  };

  const toggleProfileSelection = (profile: PlayerProfile) => {
    if (players.some(p => p.profile_id === profile.id || p.name === profile.name)) {
        Alert.alert("Opozorilo", "Ta igralec je že v igri.");
        return;
    }
    const newSelection = new Set(selectedProfileIds);
    if (newSelection.has(profile.id)) {
        newSelection.delete(profile.id);
    } else {
        newSelection.add(profile.id);
    }
    setSelectedProfileIds(newSelection);
  };

  const createNewProfileAndSelect = async () => {
    if (!searchQuery.trim()) return;
    const name = searchQuery.trim();
    try {
      const { data: newProfile, error } = await supabase.from('player_profiles').insert({ name }).select().single();
      let profileToSelect = newProfile;
      if (error) {
        const { data: existingProfile } = await supabase.from('player_profiles').select('*').eq('name', name).single();
        if (existingProfile) profileToSelect = existingProfile; else return;
      }
      if (profileToSelect) {
          toggleProfileSelection(profileToSelect);
          setSearchQuery(''); 
          fetchProfiles(false); 
      }
    } catch (e) { console.error(e); }
  };

  const confirmAddPlayers = async () => {
      if (!gameId || selectedProfileIds.size === 0) return;
      setLoading(true);
      try {
          const profilesToAdd = allProfiles.filter(p => selectedProfileIds.has(p.id));
          let startPosition = players.length;
          const newPlayers = profilesToAdd.map((profile, index) => ({
              game_id: gameId, name: profile.name, position: startPosition + index, profile_id: profile.id
          }));
          const { data, error } = await supabase.from('players').insert(newPlayers).select();
          if (error) throw error;
          if (data) {
              setPlayers([...players, ...data]);
              setShowAddPlayerModal(false);
          }
      } catch (e: any) { Alert.alert("Napaka", e.message); } finally { setLoading(false); }
  };

  const filteredProfiles = allProfiles.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const promptDeletePlayer = (id: string) => {
    setPlayerToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeletePlayer = async () => {
    if (!playerToDelete) return;
    await supabase.from('players').delete().eq('id', playerToDelete);
    setPlayers(players.filter(p => p.id !== playerToDelete));
    setRadelci(radelci.filter(r => r.player_id !== playerToDelete));
    setShowDeleteModal(false);
    setPlayerToDelete(null);
  };

  const addGlobalRadelc = async () => {
    if (!gameId) return;
    const maxPos = radelci.length > 0 ? Math.max(...radelci.map(r => r.position)) : -1;
    const newRads = players.map(p => ({ game_id: gameId, player_id: p.id, is_used: false, position: maxPos + 1 }));
    const { data } = await supabase.from('radelci').insert(newRads).select();
    if (data) setRadelci([...radelci, ...data]);
  };

  const toggleRadelc = async (radId: string, current: boolean) => {
    await supabase.from('radelci').update({ is_used: !current }).eq('id', radId);
    setRadelci(radelci.map(r => r.id === radId ? { ...r, is_used: !current } : r));
  };

  const openScoreInput = (playerId: string) => {
    setSelectedPlayerId(playerId); 
    setScoreInput(''); 
    setScoreMode('none'); 
    setShowScoreModal(true);
  };

  const handleNumpadPress = (value: string) => {
    if (value === 'DEL') { setScoreInput(prev => prev.slice(0, -1)); return; }
    if (value === '-') { setScoreInput(prev => { if (prev.startsWith('-')) return prev.substring(1); return '-' + prev; }); return; }
    if (scoreInput.length > 5) return;
    setScoreInput(prev => prev + value);
  };

  // TUKAJ JE PRAVILNO POPRAVLJENA FUNKCIJA
  const submitScore = async () => {
    if (!selectedPlayerId || !scoreInput) return;
    if (scoreInput === '-') { setScoreInput(''); return; }
    const points = parseInt(scoreInput, 10);
    if (isNaN(points)) { Alert.alert("Napaka", "Neveljaven vnos."); return; }

    const valatValues = [250, 500, 1000, -250, -500, -1000];
    if (valatValues.includes(points)) {
      // Skrijemo modal s številčnico in odpremo naš po meri narejen Valat Modal
      setShowScoreModal(false);
      setPendingValatPoints(points);
      setShowValatModal(true);
    } else {
      performSubmit(points, false);
    }
  };

  const performSubmit = async (points: number, isValat: boolean) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from('score_entries').insert({
        player_id: selectedPlayerId, 
        game_id: gameId, 
        points, 
        played: scoreMode === 'played' || scoreMode === 'beggar', 
        is_partner: scoreMode === 'partner',                     
        is_beggar: scoreMode === 'beggar',
        is_valat: isValat 
      });
      if (error) throw error;

      const player = players.find(p => p.id === selectedPlayerId);
      if (player) {
        const newScore = player.total_score + points;
        await supabase.from('players').update({ total_score: newScore }).eq('id', selectedPlayerId!);
        setPlayers(players.map(p => p.id === selectedPlayerId ? { ...p, total_score: newScore } : p));
        if (newScore === 0) setShowKlopModal(true);
      }
      setShowScoreModal(false); setScoreInput('');
    } catch (e: any) { Alert.alert("Napaka", e.message); } finally { setSubmitting(false); }
  };

  const handleUndo = async () => {
      if (!gameId) return;
      setIsUndoing(true);
      try {
          const { data: lastScores, error: scoreErr } = await supabase
              .from('score_entries')
              .select('*')
              .eq('game_id', gameId)
              .order('created_at', { ascending: false })
              .limit(1);

          const { data: lastRadelci, error: radErr } = await supabase
              .from('radelci')
              .select('*')
              .eq('game_id', gameId)
              .order('created_at', { ascending: false })
              .limit(1);

          if (scoreErr) throw scoreErr;
          if (radErr) throw radErr;

          const lastScore = lastScores && lastScores.length > 0 ? lastScores[0] : null;
          const lastRadelc = lastRadelci && lastRadelci.length > 0 ? lastRadelci[0] : null;

          if (!lastScore && !lastRadelc) {
              Alert.alert("Obvestilo", "Ni vnosov za razveljavitev.");
              setIsUndoing(false);
              return;
          }

          let undoType = '';
          
          if (lastScore && lastRadelc) {
              const scoreTime = new Date(lastScore.created_at).getTime();
              const radelcTime = new Date(lastRadelc.created_at).getTime();
              undoType = scoreTime > radelcTime ? 'score' : 'radelc';
          } else if (lastScore) {
              undoType = 'score';
          } else {
              undoType = 'radelc';
          }

          if (undoType === 'score') {
              const playerToUpdate = players.find(p => p.id === lastScore.player_id);
              if (playerToUpdate) {
                  const newScore = playerToUpdate.total_score - lastScore.points;
                  await supabase.from('players').update({ total_score: newScore }).eq('id', playerToUpdate.id);
                  setPlayers(players.map(p => p.id === playerToUpdate.id ? { ...p, total_score: newScore } : p));
              }
              await supabase.from('score_entries').delete().eq('id', lastScore.id);
          } else {
              const posToDelete = lastRadelc.position;
              await supabase.from('radelci').delete().eq('game_id', gameId).eq('position', posToDelete);
              setRadelci(radelci.filter(r => r.position !== posToDelete));
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      } catch (err: any) {
          Alert.alert("Napaka", "Prišlo je do napake pri razveljavitvi: " + err.message);
      } finally {
          setIsUndoing(false);
      }
  };

  const loadPlayerHistory = async (pid: string) => {
    const { data } = await supabase.from('score_entries').select('*').eq('player_id', pid).order('created_at');
    setPlayerHistory(data || []); setSelectedPlayerId(pid); setShowHistoryModal(true);
  };

  const openLeaderboard = async () => {
    setShowLeaderboardModal(true);
    setLeaderboardTab('list');
    if (!gameId) return;
    const { data } = await supabase.from('score_entries').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
    setAllGameHistory(data || []);
  };

  const prepareChartData = () => {
    if (!allGameHistory.length || !players.length) return { labels: [], datasets: [] };
    
    let playersToShow = players;
    if (focusedPlayerId) {
        playersToShow = players.filter(p => p.id === focusedPlayerId);
    }

    const allPlayerCalculations = players.map(p => ({
        id: p.id,
        name: p.name,
        score: 0,
        history: [0],
        colorIndex: players.indexOf(p) 
    }));

    allGameHistory.forEach(entry => {
        const player = allPlayerCalculations.find(p => p.id === entry.player_id);
        if (player) { player.score += entry.points; }
        allPlayerCalculations.forEach(p => p.history.push(p.score));
    });

    const finalDatasets = allPlayerCalculations
        .filter(p => focusedPlayerId ? p.id === focusedPlayerId : true)
        .map((p) => ({
            data: p.history,
            color: (opacity = 1) => CHART_COLORS[p.colorIndex % CHART_COLORS.length], 
            strokeWidth: focusedPlayerId ? 4 : 2, 
            legend: p.name
        }));

    return {
        labels: allPlayerCalculations[0].history.map((_, i) => i % 5 === 0 ? i.toString() : ''), 
        datasets: finalDatasets,
        legend: finalDatasets.map(d => d.legend)
    };
  };

  const toggleFocusPlayer = (playerId: string) => {
      if (focusedPlayerId === playerId) {
          setFocusedPlayerId(null); 
      } else {
          setFocusedPlayerId(playerId); 
      }
  };

  const finishGame = async () => {
    if (!gameId) return;
    setLoading(true);
    try {
        const finalPlayers = [...players];
        const updates = finalPlayers.map(async (p, i) => {
            const unusedRadelci = radelci.filter(r => r.player_id === p.id && !r.is_used);
            if (unusedRadelci.length > 0) {
                const penalty = unusedRadelci.length * -50;
                await supabase.from('score_entries').insert({
                    game_id: gameId, player_id: p.id, points: penalty, played: false 
                });
                await supabase.from('players').update({ total_score: p.total_score + penalty }).eq('id', p.id);
                
                finalPlayers[i].total_score += penalty; 
                
                const radelcIds = unusedRadelci.map(r => r.id);
                await supabase.from('radelci').update({ is_used: true }).in('id', radelcIds);
            }
        });
        await Promise.all(updates);

        const maxScore = Math.max(...finalPlayers.map(p => p.total_score));
        const winners = finalPlayers.filter(p => p.total_score === maxScore);
        const names = winners.map(w => w.name).join(' & ');
        setWinnerData({ names, score: maxScore });

        await supabase.from('games').update({ is_active: false }).eq('id', gameId);
        setShowFinishGameModal(false); 

        if (finalPlayers.length > 0) {
            setShowWinnerPopup(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            popupTimeoutRef.current = setTimeout(() => {
                setShowWinnerPopup(false);
                exitToLobby();
            }, 5000);
        } else {
            exitToLobby();
        }
    } catch (e) { Alert.alert("Napaka", "Prišlo je do napake pri zaključevanju."); } finally { setLoading(false); }
  };

  const getSelectedPlayerName = () => players.find(x => x.id === selectedPlayerId)?.name || '';

  const getFormattedTitle = (game: Game | null) => {
    if (!game) return '';
    const dateObj = new Date(game.created_at);
    const dateStr = dateObj.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
    let cleanName = game.name;
    cleanName = cleanName.replace(/\d{1,2}\.\s\d{1,2}\.\s\d{4}/g, '');
    cleanName = cleanName.replace(/\d{1,2}\.\s\d{1,2}\./g, '');
    cleanName = cleanName.replace(/\d{1,2}:\d{2}/g, '');
    cleanName = cleanName.replace(/\bob\b/gi, '');
    cleanName = cleanName.trim().replace(/[,.-]+$/, '').trim();
    if (!cleanName) cleanName = "Tarok";
    return `${cleanName}, ${dateStr} (${timeStr})`;
  };

  const renderListWinner = (game: Game) => {
    if (!game.players || game.players.length === 0) return null;
    const hasScore = game.players.some(p => p.total_score !== 0);
    if (!hasScore) return null;
    const maxScore = Math.max(...game.players.map(p => p.total_score));
    const leaders = game.players.filter(p => p.total_score === maxScore);
    const names = leaders.map(l => l.name).join(' & ');
    return (
        <Text style={{ color: COLORS.winnerGrey, fontSize: 13, marginTop: 4 }}>
            Trenutno vodilni: <Text style={{ fontWeight: '400', color: COLORS.winnerGrey }}>{names} ({maxScore})</Text>
        </Text>
    );
  };

  const getLeaderText = () => {
    if (!players || players.length === 0) return null;
    const hasScore = players.some(p => p.total_score !== 0);
    if (!hasScore) return null;
    const maxScore = Math.max(...players.map(p => p.total_score));
    const leaders = players.filter(p => p.total_score === maxScore);
    const names = leaders.map(l => l.name).join(' & ');
    return `Trenutno vodilni: ${names} (${maxScore} točk)`;
  };

  const renderGameIcon = (entry: ScoreEntry) => {
    const iconColor = entry.is_valat ? COLORS.warning : "#fff";
    if (entry.is_beggar) {
      return <Triangle size={8} color={iconColor} fill={iconColor} style={{ opacity: 0.9 }} />;
    }
    if (entry.is_partner) {
      return <Circle size={8} color={iconColor} style={{ opacity: 0.8 }} />;
    }
    if (entry.played) {
      return <View style={[styles.playedDot, entry.is_valat && { backgroundColor: COLORS.warning }]} />;
    }
    return null;
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const pRadelci = radelci.filter(r => r.player_id === item.id);
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameContainer}>
            
            <Image source={{ uri: getAvatarUrl(item.name) }} style={styles.playerAvatar} />

            <Text style={styles.playerNameText}>{item.name}</Text>
            <TouchableOpacity onPress={() => loadPlayerHistory(item.id)} style={styles.infoButton}>
              <Info size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => promptDeletePlayer(item.id)} style={styles.deleteButton}>
              <Trash2 size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.scoreContainer} onPress={() => openScoreInput(item.id)}>
          <Text style={styles.scoreText}>{item.total_score}</Text>
        </TouchableOpacity>
        <ScrollView horizontal style={styles.radelciContainer} showsHorizontalScrollIndicator={false}>
          {pRadelci.map(r => (
            <TouchableOpacity key={r.id} onPress={() => toggleRadelc(r.id, r.is_used)} hitSlop={{top: 15, bottom: 15, left: 10, right: 10}}>
              <View style={[styles.radelcBase, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const chartData = prepareChartData();

  if (loading && !gameId && activeGamesList.length === 0) {
      return (
        <View style={[styles.container, styles.centerContent]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{color: COLORS.textMuted, marginTop: 10}}>Nalaganje...</Text>
        </View>
      );
  }
  
  if (!gameId && activeGamesList.length === 0) return (
    <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.welcomeTitle}>Tarok</Text>
        <Text style={styles.welcomeSubtitle}>Ni aktivne igre</Text>
        <TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame} activeOpacity={0.8}>
            <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
            <View style={[styles.relativeContent, { gap: 12 }]}>
                <Play size={32} color="#fff" fill="#fff" />
                <Text style={styles.bigStartButtonText}>Začni novo igro</Text>
            </View>
        </TouchableOpacity>
    </View>
  );

  if (!gameId) return (
    <View style={styles.container}>
        <Text style={styles.lobbyTitle}>Aktivne igre</Text>
        <View style={{ flex: 1 }}>
            <FlatList 
                data={activeGamesList} 
                keyExtractor={(item) => item.id} 
                contentContainerStyle={styles.listContainer} 
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.gameCard} onPress={() => enterGame(item)}>
                        <View>
                            <Text style={styles.gameName}>{getFormattedTitle(item)}</Text>
                            {renderListWinner(item)}
                        </View>
                        <Play size={24} color={COLORS.primary} fill={COLORS.primary} />
                    </TouchableOpacity>
                )} 
            />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame} activeOpacity={0.8}>
                    <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
                    <View style={[styles.relativeContent, { gap: 12 }]}>
                        <Plus size={24} color="#fff" />
                        <Text style={styles.bigStartButtonText}>Začni še eno igro</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    </View>
  );

  return (
    <View style={styles.container}>

      <View style={styles.gameHeaderBar}>
        <TouchableOpacity onPress={exitToLobby} style={styles.backButton}>
            <ChevronLeft size={28} color={COLORS.textMuted} style={{ marginLeft: -8 }} />
            <Text style={styles.backButtonText}>Seznam</Text>
        </TouchableOpacity>
        
        <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 10 }}>
            <Text style={styles.headerGameTitle} numberOfLines={1}>{getFormattedTitle({ id: gameId || '', name: gameName, created_at: activeGamesList.find(g => g.id === gameId)?.created_at || new Date().toISOString(), is_active: true })}</Text>
        </View>
      </View>

      <View style={styles.headerContainer}>
          
          <View style={styles.headerRow}>
            <View style={styles.buttonWrapper}>
                <TouchableOpacity style={styles.gradientHeaderBtn} onPress={openAddPlayerModal} activeOpacity={0.8}>
                    <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
                    <View style={[styles.relativeContent, { gap: 4 }]}>
                        <Plus size={20} color="#fff" />
                        <Text style={styles.addButtonText}>Igralec</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.buttonWrapper}>
                <TouchableOpacity style={styles.gradientHeaderBtn} onPress={addGlobalRadelc} activeOpacity={0.8}>
                     <LinearGradient colors={['#20B2AA', '#20B2AA']} style={styles.absoluteGradient} />
                     <View style={[styles.relativeContent, { gap: 4 }]}>
                         <Plus size={20} color="#fff" />
                         <Text style={styles.addButtonText}>Radelc</Text>
                     </View>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.gradientIconBtn} onPress={openLeaderboard} activeOpacity={0.8}>
                 <LinearGradient colors={['#5863ea', '#5863ea']} style={styles.absoluteGradient} />
                 <View style={styles.relativeContent}>
                     <Trophy size={24} color="#fff" />
                 </View>
            </TouchableOpacity>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity 
                style={{ flex: 1, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden' }} 
                onPress={handleUndo} 
                disabled={isUndoing} 
                activeOpacity={0.8}
            >
                <View style={styles.relativeContent}>
                    {isUndoing ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : <RotateCcw size={20} color={COLORS.textMuted} />}
                    <Text style={styles.undoButtonText}>Razveljavi</Text>
                </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden' }} 
                onPress={() => setShowFinishGameModal(true)} 
                activeOpacity={0.8}
            >
                <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
                <View style={styles.relativeContent}>
                    <CheckCircle2 size={20} color="#fff" />
                    <Text style={styles.finishGameText}>Zaključi igro</Text>
                </View>
            </TouchableOpacity>
          </View>

      </View>

      <FlatList data={players} keyExtractor={(item) => item.id} renderItem={renderPlayer} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.emptyText}>Dodaj igralce za začetek.</Text>} />

      <Modal visible={showAddPlayerModal} animationType="slide" transparent onRequestClose={() => setShowAddPlayerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '90%', maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Dodaj igralce</Text>
            {isInputActive ? (
                <View style={styles.searchContainer}>
                    <Search size={24} color={COLORS.textMuted} style={{ marginRight: 12 }} />
                    <TextInput
                        autoFocus={true} 
                        style={[styles.searchInput, { outlineStyle: 'none', borderWidth: 0 } as any]}
                        placeholder="Išči ali ustvari novega..."
                        placeholderTextColor={COLORS.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        underlineColorAndroid="transparent"
                        selectionColor={COLORS.primary}
                        cursorColor={COLORS.primary}
                    />
                </View>
            ) : (
                <TouchableOpacity style={styles.searchContainer} activeOpacity={1} onPress={() => setIsInputActive(true)}>
                    <Search size={24} color={COLORS.textMuted} style={{ marginRight: 12 }} />
                    <Text style={{color: COLORS.textMuted, fontSize: 20}}>Išči ali ustvari novega...</Text>
                </TouchableOpacity>
            )}
            <FlatList
                data={filteredProfiles} keyExtractor={(item) => item.id} style={{ flex: 1, marginVertical: 12 }}
                renderItem={({ item }) => {
                    const isSelected = selectedProfileIds.has(item.id);
                    return (
                        <TouchableOpacity style={styles.profileItem} onPress={() => toggleProfileSelection(item)}>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <Image source={{ uri: getAvatarUrl(item.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 10}]} />
                                <Text style={styles.profileName}>{item.name}</Text>
                            </View>
                            <View style={{ backgroundColor: isSelected ? COLORS.danger : COLORS.primary, padding: 8, borderRadius: 20 }}>
                                {isSelected ? <Minus size={24} color="#fff" /> : <Plus size={24} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    searchQuery.length > 0 ? (
                        <TouchableOpacity style={styles.createNewButton} onPress={createNewProfileAndSelect}>
                            <UserPlus size={28} color="#fff" />
                            <Text style={styles.createNewText}>Ustvari: "{searchQuery}"</Text>
                        </TouchableOpacity>
                    ) : (<Text style={styles.emptyText}>Začni pisati ime...</Text>)
                }
            />
            {selectedProfileIds.size > 0 && (
                <TouchableOpacity style={[styles.confirmButton, { marginBottom: 10 }]} onPress={confirmAddPlayers}>
                    <Text style={styles.modalButtonText}>Potrdi izbiro ({selectedProfileIds.size})</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowAddPlayerModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showScoreModal} transparent animationType="fade" onRequestClose={() => setShowScoreModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* AVATAR V NASLOVU ZA VNOS TOČK */}
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16}}>
                {selectedPlayerId && (
                   <Image source={{ uri: getAvatarUrl(getSelectedPlayerName()) }} style={[styles.playerAvatar, {width: 28, height: 28, borderRadius: 14, marginRight: 8}]} />
                )}
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Vnesi točke ({getSelectedPlayerName()})</Text>
            </View>
            
            <View style={styles.scoreDisplay}><Text style={styles.scoreDisplayText}>{scoreInput || '0'}</Text></View>
            
            <View style={styles.numpadContainer}>
                <View style={styles.numpadRow}>{[1, 2, 3].map(n => (<TouchableOpacity key={n} style={styles.numpadButton} onPress={() => handleNumpadPress(n.toString())}><Text style={styles.numpadText}>{n}</Text></TouchableOpacity>))}</View>
                <View style={styles.numpadRow}>{[4, 5, 6].map(n => (<TouchableOpacity key={n} style={styles.numpadButton} onPress={() => handleNumpadPress(n.toString())}><Text style={styles.numpadText}>{n}</Text></TouchableOpacity>))}</View>
                <View style={styles.numpadRow}>{[7, 8, 9].map(n => (<TouchableOpacity key={n} style={styles.numpadButton} onPress={() => handleNumpadPress(n.toString())}><Text style={styles.numpadText}>{n}</Text></TouchableOpacity>))}</View>
                <View style={styles.numpadRow}>
                    <TouchableOpacity style={[styles.numpadButton, styles.numpadActionButton]} onPress={() => handleNumpadPress('-')}><Text style={styles.numpadText}>-</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.numpadButton} onPress={() => handleNumpadPress('0')}><Text style={styles.numpadText}>0</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.numpadButton, styles.numpadActionButton]} onPress={() => handleNumpadPress('DEL')}><Delete size={28} color="#fff" /></TouchableOpacity>
                </View>
            </View>

            <View style={styles.modeSelectorContainer}>
                <TouchableOpacity style={[styles.modeButton, scoreMode === 'played' && styles.modeButtonActive]} onPress={() => setScoreMode(scoreMode === 'played' ? 'none' : 'played')}>
                    <Text style={[styles.modeButtonText, scoreMode === 'played' && styles.modeButtonTextActive]}>Igral</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeButton, scoreMode === 'partner' && styles.modeButtonActive]} onPress={() => setScoreMode(scoreMode === 'partner' ? 'none' : 'partner')}>
                    <Text style={[styles.modeButtonText, scoreMode === 'partner' && styles.modeButtonTextActive]}>Klican</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeButton, scoreMode === 'beggar' && styles.modeButtonActive]} onPress={() => setScoreMode(scoreMode === 'beggar' ? 'none' : 'beggar')}>
                    <Text style={[styles.modeButtonText, scoreMode === 'beggar' && styles.modeButtonTextActive]}>Berač</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowScoreModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              
              <TouchableOpacity style={[styles.modalButton, styles.primaryModalButton]} onPress={submitScore} disabled={submitting}>
                 <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
                 <View style={styles.relativeContent}>
                     {submitting ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.modalButtonText}>Potrdi</Text>)}
                 </View>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={[styles.modalTitle, { marginBottom: 16 }]}>Zgodovina igralca</Text>
            <ScrollView style={styles.historyList}>
              {playerHistory.map((entry, index) => {
                let runningTotal = 0;
                for (let i = 0; i <= index; i++) runningTotal += playerHistory[i].points;
                return (
                  <View key={entry.id} style={styles.historyItem}>
                    <View style={styles.pointsWrapper}>
                      <View style={styles.fixedPointsWidth}>
                          <Text style={[styles.historyPoints, entry.is_valat ? {color: COLORS.warning} : (entry.points > 0 ? styles.positivePoints : styles.negativePoints)]}>{entry.points > 0 ? '+' : ''}{entry.points}</Text>
                      </View>
                      <View style={styles.dotContainer}>
                          {renderGameIcon(entry)}
                      </View>
                    </View>
                    <Text style={styles.historyTotal}>= {runningTotal}</Text>
                    <Text style={styles.historyDate}>{new Date(entry.created_at).toLocaleTimeString('sl-SI', {hour:'2-digit', minute:'2-digit'})}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowHistoryModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showLeaderboardModal} transparent animationType="slide" onRequestClose={() => setShowLeaderboardModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <View style={styles.leaderboardHeader}>
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Stanje igre</Text>
                <TouchableOpacity onPress={() => setShowAllHistoryModal(true)} style={styles.statsButton}>
                    <Info size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, leaderboardTab === 'list' && styles.tabButtonActive]} onPress={() => setLeaderboardTab('list')}>
                    <Text style={[styles.tabText, leaderboardTab === 'list' && styles.tabTextActive]}>Lestvica</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, leaderboardTab === 'chart' && styles.tabButtonActive]} onPress={() => setLeaderboardTab('chart')}>
                    <Text style={[styles.tabText, leaderboardTab === 'chart' && styles.tabTextActive]}>Graf poteka</Text>
                </TouchableOpacity>
            </View>

            {leaderboardTab === 'list' ? (
                <ScrollView style={styles.historyList}>
                {[...players].sort((a, b) => b.total_score - a.total_score).map((player, index, array) => {
                    const pRadelci = radelci.filter(r => r.player_id === player.id);
                    const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                    const playerEntries = allGameHistory.filter(e => e.player_id === player.id);
                    const lastEntry = playerEntries.length > 0 ? playerEntries[playerEntries.length - 1] : null;
                    const isValat = lastEntry?.is_valat;

                    return (
                    <View key={player.id} style={styles.leaderboardItem}>
                        <Text style={styles.rankText}>{rank}.</Text>
                        
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 28, height: 28, borderRadius: 14, marginRight: 8}]} />
                        
                        <Text style={styles.leaderboardName} numberOfLines={1}>{player.name || 'Brez imena'}</Text>
                        <View style={styles.miniRadelciContainer}>
                            {pRadelci.map(r => (
                                <View key={r.id} style={[styles.miniRadelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />
                            ))}
                        </View>
                        <Text style={[styles.leaderboardScore, isValat ? {color: COLORS.warning} : (player.total_score >= 0 ? styles.positivePoints : styles.negativePoints)]}>{player.total_score}</Text>
                    </View>
                    );
                })}
                </ScrollView>
            ) : (
                <View style={styles.chartContainer}>
                    {allGameHistory.length > 0 ? (
                        <>
                            <ScrollView horizontal contentContainerStyle={{paddingBottom: 20}}>
                                <LineChart
                                    data={chartData}
                                    width={Math.max(Dimensions.get("window").width - 60, chartData.labels.length * 40)}
                                    height={280}
                                    chartConfig={{
                                        backgroundColor: COLORS.card,
                                        backgroundGradientFrom: COLORS.card,
                                        backgroundGradientTo: COLORS.card,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: { r: "4", strokeWidth: "2", stroke: COLORS.card }
                                    }}
                                    bezier
                                    style={{ marginVertical: 8, borderRadius: 16 }}
                                    withLegend={false} 
                                />
                            </ScrollView>
                            
                            <View style={[styles.legendContainer, { marginTop: 10 }]}>
                                {players.map((p, index) => {
                                    const isActive = focusedPlayerId === p.id;
                                    const color = CHART_COLORS[index % CHART_COLORS.length];
                                    return (
                                        <TouchableOpacity 
                                            key={p.id} 
                                            style={[styles.legendChip, isActive && { backgroundColor: color, borderColor: color }]} 
                                            onPress={() => toggleFocusPlayer(p.id)}
                                        >
                                            <View style={[styles.legendDot, { backgroundColor: color }, isActive && { backgroundColor: '#fff' }]} />
                                            <Text style={[styles.legendText, isActive && { color: '#fff', fontWeight: '700' }]}>{p.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </>
                    ) : (
                        <Text style={styles.emptyText}>Za graf vnesi točke.</Text>
                    )}
                </View>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => setShowLeaderboardModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAllHistoryModal} transparent animationType="slide" onRequestClose={() => setShowAllHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Vsi igralci - Zgodovina</Text>
            <ScrollView style={[styles.historyList, { marginTop: 20 }]}>
              {players.sort((a, b) => b.total_score - a.total_score).map((player, playerIndex, array) => {
                  const playerEntries = allGameHistory.filter((e) => e.player_id === player.id);
                  if (playerEntries.length === 0) return null;

                  const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                  const playedCount = playerEntries.filter(e => e.played || e.is_beggar).length;

                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={[styles.playerHistoryHeader, {backgroundColor: COLORS.slateBlue}]}>
                        <View style={styles.playerRankBadge}>
                          {rank === 1 && <Trophy size={16} color="#ffd700" />}
                          {rank === 2 && <Trophy size={16} color="#c0c0c0" />}
                          {rank === 3 && <Trophy size={16} color="#cd7f32" />}
                          {rank > 3 && (<Text style={styles.playerRankText}>{rank}</Text>)}
                        </View>
                        
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 8}]} />
                        
                        <Text style={styles.playerHistorySectionTitle}>
                            {player.name} <Text style={{fontWeight: '400', fontSize: 14, color: COLORS.winnerGrey}}>(igral: {playedCount})</Text>
                        </Text>
                        <Text style={[styles.playerTotalScore, player.total_score > 0 ? styles.positivePoints : player.total_score < 0 ? styles.negativePoints : styles.neutralScore]}>{player.total_score}</Text>
                      </View>
                      {playerEntries.map((entry, index) => {
                        let runningTotal = 0;
                        for (let i = 0; i <= index; i++) { runningTotal += playerEntries[i].points; }
                        return (
                          <View key={entry.id} style={styles.historyItem}>
                             <View style={styles.pointsWrapper}>
                                <View style={styles.fixedPointsWidth}>
                                    <Text style={[styles.historyPoints, entry.is_valat ? {color: COLORS.warning} : (entry.points > 0 ? styles.positivePoints : styles.negativePoints)]}>{entry.points > 0 ? '+' : ''}{entry.points}</Text>
                                </View>
                                <View style={styles.dotContainer}>
                                    {renderGameIcon(entry)}
                                </View>
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
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowAllHistoryModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Izbriši igralca?</Text>
            <Text style={styles.confirmText}>Vsi podatki tega igralca za to igro bodo izgubljeni.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowDeleteModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.dangerModalButton]} onPress={confirmDeletePlayer}><Text style={styles.modalButtonText}>Izbriši</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinishGameModal} transparent animationType="fade" onRequestClose={() => setShowFinishGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Zaključi igro?</Text>
            <Text style={styles.confirmText}>Igra bo arhivirana.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowFinishGameModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              
              <TouchableOpacity style={[styles.modalButton, styles.primaryModalButton]} onPress={finishGame}>
                <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
                <View style={styles.relativeContent}>
                    <Text style={styles.modalButtonText}>Zaključi</Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showKlopModal} transparent animationType="fade" onRequestClose={() => setShowKlopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.klopTitle}>Obvezen klop!</Text>
            <TouchableOpacity style={styles.klopButton} onPress={() => setShowKlopModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NAŠ NOV IN LEP VALAT MODAL */}
      <Modal visible={showValatModal} transparent animationType="fade" onRequestClose={() => setShowValatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, {color: COLORS.warning, fontSize: 24}]}>Valat?</Text>
            <Text style={styles.confirmText}>Ali je bila ta igra dosežena z valatom?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => {
                setShowValatModal(false);
                if (pendingValatPoints !== null) performSubmit(pendingValatPoints, false);
              }}>
                <Text style={styles.modalButtonText}>Ne</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.modalButton, styles.primaryModalButton, {borderColor: COLORS.warning}]} onPress={() => {
                setShowValatModal(false);
                if (pendingValatPoints !== null) performSubmit(pendingValatPoints, true);
              }}>
                <LinearGradient colors={[COLORS.warning, '#d97706']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.absoluteGradient} />
                <View style={styles.relativeContent}>
                    <Text style={styles.modalButtonText}>Da</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWinnerPopup} transparent animationType="fade" onRequestClose={() => {
          if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
          setShowWinnerPopup(false); 
          exitToLobby();
      }}>
        <View style={[styles.modalOverlay, {justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)'}]}>
            <View style={styles.winnerPopupCard}>
                <TouchableOpacity 
                    style={{position: 'absolute', top: 12, right: 12, padding: 8}}
                    onPress={() => {
                        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
                        setShowWinnerPopup(false); 
                        exitToLobby();
                    }}
                >
                    <X size={24} color={COLORS.textMuted} />
                </TouchableOpacity>

                <Trophy size={60} color="#ffd700" style={{marginBottom: 15}} />
                
                <Text style={{color: '#ffd700', fontSize: 14, fontWeight: '800', letterSpacing: 3, marginBottom: 10}}>
                    ZMAGOVALEC
                </Text>
                
                {winnerData?.names && (
                    <Image source={{ uri: getAvatarUrl(winnerData.names.split(' & ')[0]) }} style={[styles.playerAvatar, {width: 80, height: 80, borderRadius: 40, marginVertical: 10, borderWidth: 2}]} />
                )}

                <Text style={{color: COLORS.text, fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 10}}>
                    {winnerData?.names}
                </Text>
                
                <View style={{backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, marginTop: 5}}>
                    <Text style={{color: COLORS.success, fontSize: 26, fontWeight: '800'}}>
                        {winnerData?.score} točk
                    </Text>
                </View>
            </View>

            {showWinnerPopup && (
                <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                    <ConfettiCannon
                        count={200}
                        origin={{x: -10, y: 0}}
                        autoStart={true}
                        fadeOut={true}
                        fallSpeed={2500}
                    />
                </View>
            )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  absoluteGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  relativeContent: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },

  lobbyTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  
  gameCard: { 
      backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.10)',
      borderTopColor: 'rgba(255, 255, 255, 0.22)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.14)',
      overflow: 'hidden'
  },
  
  gameName: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  gameDate: { fontSize: 14, color: COLORS.textMuted },
  
  bigStartButton: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 32, borderRadius: 16, gap: 12, width: '100%', maxWidth: 400,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.20)',
      borderTopColor: 'rgba(255, 255, 255, 0.55)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.35)',
      overflow: 'hidden'
  },
  bigStartButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  
  welcomeTitle: { fontSize: 48, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  welcomeSubtitle: { fontSize: 18, color: COLORS.textMuted, marginBottom: 40 },
  
  gameHeaderBar: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
      paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'transparent' 
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backButtonText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  headerGameTitle: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  headerLeaderText: { color: COLORS.winnerGrey, fontSize: 13, fontWeight: '400', marginTop: 2 },
  
  headerContainer: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  headerRow: { flexDirection: 'row', gap: 10 },

  buttonWrapper: { flex: 1 }, 

  gradientHeaderBtn: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden' 
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  gradientIconBtn: { 
      width: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden'
  },
  
  undoButton: { 
      backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  undoButtonText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600', marginLeft: 6 },
  
  finishGameBtn: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden'
  },
  finishGameText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 6 },
  
  listContainer: { padding: 16, paddingTop: 0, gap: 16 },

  playerCard: { 
      backgroundColor: '#1e293b', borderRadius: 20, padding: 14, marginBottom: 12,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.20)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  playerHeader: { marginBottom: 8 },
  playerNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  
  playerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderTopColor: 'rgba(255, 255, 255, 0.3)', 
      marginRight: 4, 
  },
  
  playerNameText: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '700' },
  infoButton: { padding: 8 },
  deleteButton: { padding: 8 },
  
  scoreContainer: { 
      alignItems: 'center', paddingVertical: 14, backgroundColor: '#2b3648', borderRadius: 16, marginBottom: 8,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.10)',
      borderTopColor: 'rgba(255, 255, 255, 0.22)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.14)',
      overflow: 'hidden'
  },

  scoreText: { color: COLORS.text, fontSize: 40, fontWeight: '700' },
  radelciContainer: { flexDirection: 'row', paddingVertical: 4 },
  radelcBase: { width: 16, height: 16, borderRadius: 8, marginHorizontal: 4 }, // ZMANJŠANI RADELCI
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.radelcBorder },
  miniRadelc: { width: 12, height: 12, borderRadius: 6 },
  
  emptyText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  
  modalContent: { 
      backgroundColor: COLORS.card, borderRadius: 16, padding: 16, width: '90%', maxWidth: 400, maxHeight: '80%',
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.10)',
      borderTopColor: 'rgba(255, 255, 255, 0.22)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  
  leaderboardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statsButton: { position: 'absolute', right: 0, padding: 8 },
  
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  
  searchContainer: { 
      flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 20,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 20, borderWidth: 0, borderColor: 'transparent', backgroundColor: 'transparent' },
  
  profileItem: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 16, marginBottom: 10,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  profileName: { color: COLORS.text, fontSize: 20, fontWeight: '600' },
  
  createNewButton: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: COLORS.inputBg, borderRadius: 16, gap: 12, marginTop: 10,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  createNewText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  confirmButton: { 
      backgroundColor: COLORS.confirmTeal, padding: 16, borderRadius: 12, alignItems: 'center', 
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.20)',
      borderTopColor: 'rgba(255, 255, 255, 0.55)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.35)',
      overflow: 'hidden'
  },

  scoreDisplay: { 
      backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.10)',
      borderTopColor: 'rgba(255, 255, 255, 0.22)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.14)',
      overflow: 'hidden'
  },
  scoreDisplayText: { color: COLORS.text, fontSize: 48, fontWeight: '700' },
  numpadContainer: { width: '100%', gap: 8, marginBottom: 15 },
  numpadRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  
  numpadButton: { 
      flex: 1, backgroundColor: COLORS.inputBg, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)', 
      borderTopColor: 'rgba(255, 255, 255, 0.18)',
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  numpadActionButton: { backgroundColor: '#2D3546' },
  numpadText: { color: COLORS.text, fontSize: 24, fontWeight: '600' },
  
  modeSelectorContainer: { flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'space-between' },
  
  modeButton: { 
      flex: 1, 
      backgroundColor: '#202a3a', 
      paddingVertical: 14, 
      borderRadius: 20, 
      alignItems: 'center', 
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderTopColor: 'rgba(255, 255, 255, 0.25)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.18)',
      overflow: 'hidden'
  },
  modeButtonActive: { 
      backgroundColor: COLORS.primary, 
      borderWidth: 1, 
      borderColor: COLORS.primary,
      borderTopColor: 'rgba(255, 255, 255, 0.40)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.25)',
      shadowColor: COLORS.primary, 
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 8,
      elevation: 5
  },

  modeButtonText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  modeButtonTextActive: { color: '#fff', fontWeight: '800' },
  
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', overflow: 'hidden' },
  primaryModalButton: {
      justifyContent: 'center',
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.20)',
      borderTopColor: 'rgba(255, 255, 255, 0.55)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.35)',
  },
  dangerModalButton: {
      backgroundColor: COLORS.danger,
      justifyContent: 'center',
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.20)',
      borderTopColor: 'rgba(255, 255, 255, 0.55)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.35)',
  },
  cancelButton: { 
      backgroundColor: COLORS.inputBg,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  historyModal: { height: '70%' },
  historyList: { flex: 1, marginBottom: 16 },
  
  historyItem: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 8, marginBottom: 12,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  fixedPointsWidth: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotContainer: { width: 20, alignItems: 'center', justifyContent: 'center' },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: COLORS.success },
  negativePoints: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  historyTotal: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: COLORS.textMuted, fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  
  tabContainer: { 
      flexDirection: 'row', marginBottom: 20, backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 4,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.15)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.10)',
      overflow: 'hidden'
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: { backgroundColor: COLORS.card },
  tabText: { color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  
  chartContainer: { flex: 1, justifyContent: 'center' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 },
  legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  
  leaderboardItem: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 8, marginBottom: 10,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden'
  },
  rankText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700', marginRight: 12 },
  leaderboardName: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1 },
  leaderboardScore: { fontSize: 22, fontWeight: '800', width: 60, textAlign: 'right' },
  miniRadelciContainer: { flexDirection: 'row', gap: 2 },
  
  closeButton: { 
      backgroundColor: COLORS.closeBtn, padding: 16, borderRadius: 12, alignItems: 'center', 
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.20)',
      borderTopColor: 'rgba(255, 255, 255, 0.55)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.35)',
      overflow: 'hidden' 
  },
  
  emptyHistoryContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyHistoryText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center' },
  confirmText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  klopTitle: { color: COLORS.warning, fontSize: 28, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
  klopButton: { 
      backgroundColor: COLORS.closeBtn, padding: 16, borderRadius: 12, alignItems: 'center',
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.20)',
      borderTopColor: 'rgba(255, 255, 255, 0.55)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.35)',
      overflow: 'hidden'
  },

  playerHistorySection: { marginBottom: 24 },
  
  playerHistoryHeader: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12,
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.10)',
      borderTopColor: 'rgba(255, 255, 255, 0.20)', 
      borderLeftColor: 'rgba(255, 255, 255, 0.14)',
      overflow: 'hidden'
  },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '600' },
  playerTotalScore: { fontSize: 22, fontWeight: '700' },
  
  winnerPopupCard: {
      backgroundColor: COLORS.card, padding: 30, borderRadius: 24, alignItems: 'center', width: '80%', zIndex: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
});