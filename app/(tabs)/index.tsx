import { useState, useCallback, useEffect, useRef } from 'react';
import { PulseDot } from '../../components/Pulse';
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
  Image,
  AppState
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import { g, loadGenders } from '@/lib/gender';
import GamePhotoButton from '@/components/GamePhotoButton';
import StartGameButton from '@/components/StartGameButton';
import { Plus, Minus, Info, Trash2, RotateCcw, Play, ChevronLeft, Trophy, Search, UserPlus, Check, Delete, Circle, Triangle, X } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient'; 
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
  closeBtn: '#0A84FF',
  confirmTeal: '#0A84FF',
  sheet: '#121A2B',
  chartBg: '#0C111D',
};

// Sporočilo, ki deluje tudi na spletu (Alert.alert na spletu ne prikaže ničesar)
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const GRADIENT_COLORS = ['#0A84FF', '#0A84FF']; 
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AVG', 'SEP', 'OKT', 'NOV', 'DEC'];
const CHART_COLORS = [
  '#0A84FF', '#FF9F0A', '#30D158', '#FF453A', '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F'
];

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

export default function ActiveGame() {
  const { openProfile } = usePlayerProfile();
  const [activeGamesList, setActiveGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false); 
  
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [finishedCount, setFinishedCount] = useState<number | null>(null); // število odigranih iger (za začetni zaslon)
  const [playedCounts, setPlayedCounts] = useState<Record<string, number>>({}); // kolikokrat je igralec igral (tudi berač)
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
  const [finishedGameId, setFinishedGameId] = useState<string | null>(null); // za sliko večera v oknu zmagovalca

  useFocusEffect(useCallback(() => {
    fetchActiveGamesList();
    // število odigranih (zaključenih) iger za začetni zaslon - enako kot v Zgodovini
    supabase.from('games').select('id', { count: 'exact', head: true }).eq('is_active', false).then(({ count }) => { if (typeof count === 'number') setFinishedCount(count); });
  }, []));
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

  const fetchProfiles = async (showDebug = false) => {
    try {
      const { data, error } = await supabase.from('player_profiles').select('id, name').order('name');
      if (error) { if (showDebug) showAlert("NAPAKA", error.message); return; }
      setAllProfiles(data || []);
    } catch (err: any) { if (showDebug) showAlert("NAPAKA", err.message); }
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
      openAddPlayerModal(); // nova igra: takoj odpri dodajanje igralcev
    } catch (error) { showAlert("Napaka", "Ni bilo mogoče ustvariti igre."); } finally { setLoading(false); }
  };

  const loadPlayers = async (gId: string) => {
    const { data } = await supabase.from('players').select('*').eq('game_id', gId).order('position');
    setPlayers(data || []);
  };

  const loadRadelci = async (gId: string) => {
    const { data } = await supabase.from('radelci').select('*').eq('game_id', gId).order('position');
    setRadelci(data || []);
  };

  // Kolikokrat je vsak igralec v tej igri igral (igral ali berač; klican ne šteje).
  // Osveži se ob vsaki spremembi igralcev (vnos, razveljavitev, sprememba z drugega telefona).
  useEffect(() => {
    if (!gameId) { setPlayedCounts({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('score_entries').select('player_id, played, is_beggar').eq('game_id', gameId);
      if (cancelled || !data) return;
      const counts: Record<string, number> = {};
      data.forEach((e: any) => { if (e.played || e.is_beggar) counts[e.player_id] = (counts[e.player_id] || 0) + 1; });
      setPlayedCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [gameId, players]);

  // REZULTATI V ŽIVO: ko je igra odprta, poslušamo spremembe igralcev in radelcev te igre
  // (točke, razveljavitve, radelci z drugih naprav) in ob spremembi ponovno naložimo stanje.
  useEffect(() => {
    if (!gameId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Več hkratnih sprememb (npr. radelc za vse igralce) združimo v eno osvežitev
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { loadPlayers(gameId); loadRadelci(gameId); }, 300);
    };
    const gameFilter = `game_id=eq.${gameId}`;
    const channel = supabase
      .channel(`igra-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: gameFilter }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: gameFilter }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'radelci', filter: gameFilter }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'radelci', filter: gameFilter }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'radelci' }, refresh)
      .subscribe();

    // Ko se telefon zbudi ali se vrneš v aplikacijo/brskalnik, naložimo sveže stanje
    const appStateSub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      appStateSub.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [gameId]);

  const openAddPlayerModal = () => {
    setSearchQuery(''); 
    setShowAddPlayerModal(true); 
    fetchProfiles(false); 
  };

  const toggleProfileSelection = (profile: PlayerProfile) => {
    if (players.some(p => p.profile_id === profile.id || p.name === profile.name)) {
        showAlert("Opozorilo", "Ta igralec je že v igri.");
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

  const createNewProfileAndSelect = async (gender: 'M' | 'Z') => {
    if (!searchQuery.trim()) return;
    const name = searchQuery.trim();
    try {
      const { data: newProfile, error } = await supabase.from('player_profiles').insert({ name, gender }).select().single();
      if (!error) loadGenders(true); // novi igralec: osveži spol za besedila
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
      } catch (e: any) { showAlert("Napaka", e.message); } finally { setLoading(false); }
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

  const submitScore = async () => {
    if (!selectedPlayerId || !scoreInput) return;
    if (scoreInput === '-') { setScoreInput(''); return; }
    const points = parseInt(scoreInput, 10);
    if (isNaN(points)) { showAlert("Napaka", "Neveljaven vnos."); return; }

    const valatValues = [250, 500, 1000, 2000, 4000, 8000, 16000, -250, -500, -1000, -2000, -4000, -8000, -16000];
    if (valatValues.includes(points)) {
      setShowScoreModal(false);
      setPendingValatPoints(points);
      setShowValatModal(true);
    } else {
      performSubmit(points, false);
    }
  };

  // Seštevek igralca vedno izračuna iz vseh njegovih vnosov v bazi (tudi tistih z drugih telefonov)
  const recalcPlayerTotal = async (playerId: string): Promise<number> => {
    const { data, error } = await supabase.from('score_entries').select('points').eq('player_id', playerId);
    if (error) throw error;
    const total = (data || []).reduce((sum, e) => sum + Number(e.points), 0);
    const { error: updateError } = await supabase.from('players').update({ total_score: total }).eq('id', playerId);
    if (updateError) throw updateError;
    return total;
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

      const newScore = await recalcPlayerTotal(selectedPlayerId!);
      setPlayers(prev => prev.map(p => p.id === selectedPlayerId ? { ...p, total_score: newScore } : p));
      if (newScore === 0) setShowKlopModal(true);
      setShowScoreModal(false); setScoreInput('');
    } catch (e: any) { showAlert("Napaka", e.message); } finally { setSubmitting(false); }
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
              showAlert("Obvestilo", "Ni vnosov za razveljavitev.");
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
              const { error: deleteError } = await supabase.from('score_entries').delete().eq('id', lastScore.id);
              if (deleteError) throw deleteError;
              const newScore = await recalcPlayerTotal(lastScore.player_id);
              setPlayers(prev => prev.map(p => p.id === lastScore.player_id ? { ...p, total_score: newScore } : p));
          } else {
              const posToDelete = lastRadelc.position;
              await supabase.from('radelci').delete().eq('game_id', gameId).eq('position', posToDelete);
              setRadelci(radelci.filter(r => r.position !== posToDelete));
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      } catch (err: any) {
          showAlert("Napaka", "Prišlo je do napake pri razveljavitvi: " + err.message);
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
                const { error: penaltyError } = await supabase.from('score_entries').insert({
                    game_id: gameId, player_id: p.id, points: penalty, played: false, is_penalty: true 
                });
                if (penaltyError) throw penaltyError;
                
                const radelcIds = unusedRadelci.map(r => r.id);
                await supabase.from('radelci').update({ is_used: true }).in('id', radelcIds);
            }
            // Končni seštevek vsakega igralca iz vseh vnosov v bazi
            const total = await recalcPlayerTotal(p.id);
            finalPlayers[i] = { ...p, total_score: total };
        });
        await Promise.all(updates);

        const maxScore = Math.max(...finalPlayers.map(p => p.total_score));
        const winners = finalPlayers.filter(p => p.total_score === maxScore);
        const names = winners.map(w => w.name).join(' & ');
        setWinnerData({ names, score: maxScore });
        setFinishedGameId(gameId);

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
    } catch (e) { showAlert("Napaka", "Prišlo je do napake pri zaključevanju."); } finally { setLoading(false); }
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

            <Text style={styles.playerNameText} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.playedCount}>({g(item.name, 'Igral', 'Igrala')}: {playedCounts[item.id] || 0})</Text>
            <TouchableOpacity onPress={() => loadPlayerHistory(item.id)} style={styles.infoButton} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Info size={19} color={COLORS.textMuted} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => promptDeletePlayer(item.id)} style={styles.deleteButton} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Trash2 size={19} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.scoreContainer} onPress={() => openScoreInput(item.id)} activeOpacity={0.7}>
          <Text style={[styles.scoreText, item.total_score < 0 && { color: COLORS.danger }]}>{item.total_score}</Text>
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

  // Glavni seznam: vodilni vedno na vrhu (pri enakih točkah ostane vrstni red dodajanja)
  const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score || a.position - b.position);

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
        {finishedCount !== null && <Text style={styles.welcomeCount}><Text style={{ color: COLORS.text, fontWeight: '600' }}>{finishedCount}</Text> {finishedCount % 100 === 1 ? 'igra' : finishedCount % 100 === 2 ? 'igri' : finishedCount % 100 === 3 || finishedCount % 100 === 4 ? 'igre' : 'iger'}</Text>}
        <View style={{ marginTop: 6 }}>
            <StartGameButton onPress={handleStartNewGame} />
        </View>
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
                    <TouchableOpacity style={styles.gameCard} onPress={() => enterGame(item)} activeOpacity={0.7}>
                        <View style={styles.calLeaf}>
                            <Text style={styles.calMonth}>{MONTHS_SHORT[new Date(item.created_at).getMonth()]}</Text>
                            <Text style={styles.calDay}>{new Date(item.created_at).getDate()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <PulseDot color={COLORS.primary} size={6} />
                                <Text style={styles.gameName}>{getFormattedTitle(item)}</Text>
                            </View>
                            {renderListWinner(item)}
                        </View>
                        <View style={styles.playCircle}><Play size={15} color={COLORS.primary} fill={COLORS.primary} /></View>
                    </TouchableOpacity>
                )} 
            />
            <View style={{ padding: 16, alignItems: 'center' }}>
                <TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame} activeOpacity={0.8}>
                    <View style={[styles.relativeContent, { gap: 10 }]}>
                        <Plus size={22} color="#fff" />
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

      <View style={styles.tileRow}>
        <TouchableOpacity style={styles.tile} onPress={openAddPlayerModal} activeOpacity={0.7}>
          <UserPlus size={21} color={COLORS.primary} />
          <Text style={styles.tileText}>Igralec</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile} onPress={addGlobalRadelc} activeOpacity={0.7}>
          <Plus size={21} color={COLORS.radelcBorder} />
          <Text style={styles.tileText}>Radelc</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile} onPress={handleUndo} disabled={isUndoing} activeOpacity={0.7}>
          {isUndoing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <RotateCcw size={21} color={COLORS.primary} />}
          <Text style={styles.tileText}>Razveljavi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile} onPress={openLeaderboard} activeOpacity={0.7}>
          <Trophy size={21} color={COLORS.primary} />
          <Text style={styles.tileText}>Lestvica</Text>
        </TouchableOpacity>
      </View>

      <FlatList data={sortedPlayers} keyExtractor={(item) => item.id} renderItem={renderPlayer} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.emptyText}>Dodaj igralce za začetek.</Text>} />

      <View style={styles.finishBar}>
        <TouchableOpacity style={styles.finishButton} onPress={() => setShowFinishGameModal(true)} activeOpacity={0.8}>
          <Text style={styles.finishGameText}>Zaključi igro</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showAddPlayerModal} animationType="slide" transparent onRequestClose={() => setShowAddPlayerModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContent, { height: '90%', maxHeight: '90%' }]}>
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
                            <View style={[styles.pickCircle, isSelected && styles.pickCircleOn]}>
                                {isSelected ? <Check size={28} color="#fff" strokeWidth={2.8} /> : <Plus size={32} color={COLORS.primary} strokeWidth={2.4} />}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    searchQuery.length > 0 ? (
                        <View style={[styles.createNewButton, { flexDirection: 'column', gap: 8 }]}>
                            <UserPlus size={26} color="#fff" />
                            <Text style={styles.createNewText}>Ustvari: "{searchQuery}"</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                <TouchableOpacity style={styles.genderButton} onPress={() => createNewProfileAndSelect('M')}><Text style={styles.genderText}>Moški</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.genderButton} onPress={() => createNewProfileAndSelect('Z')}><Text style={styles.genderText}>Ženska</Text></TouchableOpacity>
                            </View>
                        </View>
                    ) : (<Text style={styles.emptyText}>Začni pisati ime...</Text>)
                }
            />
            {selectedProfileIds.size > 0 && (
                <TouchableOpacity style={[styles.confirmButton, { marginBottom: 10 }]} onPress={confirmAddPlayers}>
                    <Text style={styles.modalButtonText}>Potrdi izbiro ({selectedProfileIds.size})</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.closeButton, styles.cancelButton]} onPress={() => setShowAddPlayerModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showScoreModal} transparent animationType="fade" onRequestClose={() => setShowScoreModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>

            {/* igralec in trenutne točke v eni vrstici */}
            <View style={styles.scoreHead}>
                {selectedPlayerId && (
                   <Image source={{ uri: getAvatarUrl(getSelectedPlayerName()) }} style={[styles.playerAvatar, {width: 40, height: 40, borderRadius: 20, marginRight: 0}]} />
                )}
                <Text style={styles.scoreHeadName} numberOfLines={1}>{getSelectedPlayerName()}</Text>
                <Text style={styles.scoreHeadCurrent}>Trenutno: {players.find(p => p.id === selectedPlayerId)?.total_score ?? 0} točk</Text>
            </View>
            
            <View style={styles.scoreDisplay}><Text style={styles.scoreDisplayText}>{scoreInput ? (scoreInput.startsWith('-') ? scoreInput : `+${scoreInput}`) : '0'}</Text></View>

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
            
            <View style={styles.numpadContainer}>
                <View style={styles.numpadRow}>{[1, 2, 3].map(n => (<TouchableOpacity key={n} style={styles.numpadButton} onPress={() => handleNumpadPress(n.toString())}><Text style={styles.numpadText}>{n}</Text></TouchableOpacity>))}</View>
                <View style={styles.numpadRow}>{[4, 5, 6].map(n => (<TouchableOpacity key={n} style={styles.numpadButton} onPress={() => handleNumpadPress(n.toString())}><Text style={styles.numpadText}>{n}</Text></TouchableOpacity>))}</View>
                <View style={styles.numpadRow}>{[7, 8, 9].map(n => (<TouchableOpacity key={n} style={styles.numpadButton} onPress={() => handleNumpadPress(n.toString())}><Text style={styles.numpadText}>{n}</Text></TouchableOpacity>))}</View>
                <View style={styles.numpadRow}>
                    <TouchableOpacity style={[styles.numpadButton, styles.numpadActionButton]} onPress={() => handleNumpadPress('-')}><Text style={[styles.numpadText, { fontSize: 20, letterSpacing: 3 }]}>+/−</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.numpadButton} onPress={() => handleNumpadPress('0')}><Text style={styles.numpadText}>0</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.numpadButton, styles.numpadActionButton]} onPress={() => handleNumpadPress('DEL')}><Delete size={24} color="#fff" /></TouchableOpacity>
                </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowScoreModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.primaryModalButton]} onPress={submitScore} disabled={submitting}>
                 {submitting ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.modalButtonText}>Potrdi</Text>)}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContent, styles.historyModal]}>
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
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContent, styles.historyModal]}>
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
                    <TouchableOpacity key={player.id} style={styles.leaderboardItem} onPress={() => openProfile(player.name)} activeOpacity={0.7}>
                        <Text style={styles.rankText}>{rank}.</Text>
                        
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 28, height: 28, borderRadius: 14, marginRight: 8}]} />
                        
                        <Text style={styles.leaderboardName} numberOfLines={1}>{player.name || 'Brez imena'}</Text>
                        <View style={styles.miniRadelciContainer}>
                            {pRadelci.map(r => (
                                <View key={r.id} style={[styles.miniRadelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />
                            ))}
                        </View>
                        <Text style={[styles.leaderboardScore, isValat ? {color: COLORS.warning} : (player.total_score >= 0 ? styles.positivePoints : styles.negativePoints)]}>{player.total_score}</Text>
                    </TouchableOpacity>
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
                                        backgroundColor: COLORS.chartBg,
                                        backgroundGradientFrom: COLORS.chartBg,
                                        backgroundGradientTo: COLORS.chartBg,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.6})`,
                                        labelColor: (opacity = 1) => `rgba(142, 142, 147, ${opacity})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: { r: "4", strokeWidth: "2", stroke: COLORS.chartBg },
                                        propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.07)', strokeDasharray: '' }
                                    }}
                                    bezier
                                    withShadow={false}
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
                                            <Text style={[styles.legendText, isActive && { color: '#fff', fontWeight: '600' }]}>{p.name}</Text>
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
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetContent, styles.historyModal]}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Potek igre</Text>
            <ScrollView style={[styles.historyList, { marginTop: 20 }]}>
              {[...players].sort((a, b) => b.total_score - a.total_score).map((player, playerIndex, array) => {
                  const playerEntries = allGameHistory.filter((e) => e.player_id === player.id);
                  if (playerEntries.length === 0) return null;

                  const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                  const playedCount = playerEntries.filter(e => e.played || e.is_beggar).length;

                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={[styles.playerHistoryHeader, {backgroundColor: COLORS.slateBlue}]}>
                        <View style={styles.playerRankBadge}>
                          {rank === 1 && <Trophy size={16} color="#FFD60A" />}
                          {rank === 2 && <Trophy size={16} color="#D1D1D6" />}
                          {rank === 3 && <Trophy size={16} color="#FF9F0A" />}
                          {rank > 3 && (<Text style={styles.playerRankText}>{rank}</Text>)}
                        </View>
                        
                        <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 32, height: 32, borderRadius: 16, marginRight: 8}]} />
                        
                        <Text style={styles.playerHistorySectionTitle}>
                            {player.name} <Text style={{fontWeight: '400', fontSize: 14, color: COLORS.winnerGrey}}>({g(player.name, 'Igral', 'Igrala')}: {playedCount})</Text>
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
                    style={{position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 2}}
                    onPress={() => {
                        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
                        setShowWinnerPopup(false); 
                        exitToLobby();
                    }}
                >
                    <X size={16} color="#AEAEB2" />
                </TouchableOpacity>

                <Trophy size={52} color="#FFD60A" strokeWidth={1.6} style={{marginBottom: 12}} />
                
                <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 2.5, marginBottom: 12}}>
                    {(winnerData?.names || '').includes(' & ') ? 'ZMAGOVALCI' : g(winnerData?.names, 'ZMAGOVALEC', 'ZMAGOVALKA')}
                </Text>
                
                {winnerData?.names && (
                    <View style={{ width: 84, height: 84, marginBottom: 12 }}>
                        <Image source={{ uri: getAvatarUrl(winnerData.names.split(' & ')[0]) }} style={[styles.playerAvatar, {width: 84, height: 84, borderRadius: 42}]} />
                    </View>
                )}

                <Text style={{color: COLORS.text, fontSize: 30, fontWeight: '600', textAlign: 'center', marginBottom: 8}}>
                    {winnerData?.names}
                </Text>
                
                <View style={{backgroundColor: 'rgba(48,209,88,0.16)', height: 38, paddingHorizontal: 18, borderRadius: 19, justifyContent: 'center'}}>
                    <Text style={{color: COLORS.success, fontSize: 20, fontWeight: '600'}}>
                        {winnerData?.score} točk
                    </Text>
                </View>

                {finishedGameId && (
                    <GamePhotoButton
                        gameId={finishedGameId}
                        style={{ marginTop: 22, alignSelf: 'stretch' }}
                        onPress={() => { if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current); }}
                    />
                )}
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
  container: { flex: 1, backgroundColor: 'transparent' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  absoluteGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  relativeContent: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },

  lobbyTitle: { fontSize: 32, fontWeight: '700', color: COLORS.text, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  
  gameCard: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', padding: 12, paddingRight: 14, borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  
  gameName: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  gameDate: { fontSize: 14, color: COLORS.textMuted },
  
  bigStartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, width: '100%', maxWidth: 400, backgroundColor: COLORS.primary },
  bigStartButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  
  welcomeTitle: { fontSize: 44, fontWeight: '600', color: COLORS.text, letterSpacing: -1 },
  welcomeSubtitle: { fontSize: 15, color: COLORS.textMuted },
  welcomeCount: { fontSize: 14, color: COLORS.textMuted, marginTop: 10 },
  
  gameHeaderBar: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
      paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'transparent' 
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '500' },
  headerGameTitle: { color: COLORS.textMuted, fontSize: 14, fontWeight: '400', textAlign: 'right', flex: 1, marginLeft: 16 },
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
  finishGameText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  
  listContainer: { padding: 16, paddingTop: 4, gap: 12 },

  playerCard: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingTop: 10, paddingBottom: 12, paddingHorizontal: 12 },
  playerHeader: { marginBottom: 10 },
  playerNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  
  playerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)' },
  
  playerNameText: { color: COLORS.text, fontSize: 17, fontWeight: '600', flexShrink: 1 },
  infoButton: { padding: 4, marginLeft: -4 },
  deleteButton: { padding: 8 },
  
  scoreContainer: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', height: 64, borderRadius: 14, marginBottom: 10 },

  scoreText: { color: COLORS.text, fontSize: 34, fontWeight: '600', letterSpacing: -0.5 },
  radelciContainer: { flexDirection: 'row', paddingVertical: 4, paddingLeft: 2 },
  radelcBase: { width: 14, height: 14, borderRadius: 7, marginRight: 8 }, // ZMANJŠANI RADELCI
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.radelcBorder },
  miniRadelc: { width: 8, height: 8, borderRadius: 4 },
  
  emptyText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' },
  
  modalContent: { backgroundColor: COLORS.sheet, borderRadius: 24, padding: 20, width: '90%', maxWidth: 400, maxHeight: '80%', borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', overflow: 'hidden' },
  
  leaderboardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statsButton: { position: 'absolute', right: 0, padding: 8 },
  
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  
  searchContainer: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginBottom: 8 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 17, borderWidth: 0, borderColor: 'transparent', backgroundColor: 'transparent' },
  
  profileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  profileName: { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  
  createNewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, gap: 12, marginTop: 10, backgroundColor: 'rgba(10,132,255,0.15)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  createNewText: { color: COLORS.text, fontSize: 17, fontWeight: '500' },
  genderButton: { paddingVertical: 12, paddingHorizontal: 26, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)' },
  genderText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  confirmButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 16, alignItems: 'center' },

  scoreDisplay: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  scoreDisplayText: { color: COLORS.text, fontSize: 52, fontWeight: '700', letterSpacing: -1 },
  numpadContainer: { width: '100%', gap: 9, marginBottom: 14 },
  numpadRow: { flexDirection: 'row', gap: 9, justifyContent: 'space-between' },
  
  numpadButton: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.14)' },
  numpadActionButton: { backgroundColor: 'rgba(255,255,255,0.17)' },
  numpadText: { color: COLORS.text, fontSize: 24, fontWeight: '500' },
  
  modeSelectorContainer: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', gap: 3, padding: 3, borderRadius: 12, marginBottom: 14 },
  
  modeButton: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: COLORS.primary },

  modeButtonText: { color: '#AEAEB2', fontSize: 14, fontWeight: '500' },
  modeButtonTextActive: { color: '#fff', fontWeight: '600' },
  
  modalButtons: { flexDirection: 'row', width: '100%', gap: 10 },
  modalButton: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  primaryModalButton: { backgroundColor: COLORS.primary, justifyContent: 'center' },
  dangerModalButton: { backgroundColor: COLORS.danger, justifyContent: 'center' },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  
  historyModal: { height: '70%' },
  historyList: { flex: 1, marginBottom: 16 },
  
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  fixedPointsWidth: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotContainer: { width: 20, alignItems: 'center', justifyContent: 'center' },
  historyPoints: { fontSize: 16, fontWeight: '600' },
  positivePoints: { color: COLORS.success },
  negativePoints: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  historyTotal: { color: '#AEAEB2', fontSize: 15, fontWeight: '400', flex: 1, textAlign: 'center' },
  historyDate: { color: '#636366', fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  
  tabContainer: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', marginBottom: 14, borderRadius: 12, padding: 3 },
  tabButton: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabButtonActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#AEAEB2', fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  
  chartContainer: { flex: 1, justifyContent: 'center' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 },
  legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: '#AEAEB2', fontSize: 12, fontWeight: '500' },
  
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  rankText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600', marginRight: 10, width: 24 },
  leaderboardName: { color: COLORS.text, fontSize: 16, fontWeight: '500', flex: 1 },
  leaderboardScore: { fontSize: 18, fontWeight: '600', width: 60, textAlign: 'right' },
  miniRadelciContainer: { flexDirection: 'row', gap: 4 },
  
  closeButton: { backgroundColor: COLORS.primary, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  
  emptyHistoryContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyHistoryText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center' },
  confirmText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  klopTitle: { color: COLORS.warning, fontSize: 26, fontWeight: '600', marginBottom: 24, textAlign: 'center' },
  klopButton: { backgroundColor: COLORS.primary, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  playerHistorySection: { marginBottom: 24 },
  
  playerHistoryHeader: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, marginBottom: 4, gap: 10 },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '600' },
  playerTotalScore: { fontSize: 18, fontWeight: '600' },
  
  winnerPopupCard: { backgroundColor: COLORS.sheet, padding: 28, borderRadius: 28, alignItems: 'center', width: '84%', maxWidth: 380, zIndex: 10, borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', overflow: 'hidden' },

  // --- nov dizajn (D2) ---
  calLeaf: { width: 46, height: 50, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  calMonth: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color: COLORS.primary },
  calDay: { fontSize: 20, lineHeight: 24, fontWeight: '600', color: COLORS.text },
  playCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(10,132,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  tileRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  tile: { flex: 1, height: 66, borderRadius: 16, backgroundColor: '#121A2B', borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tileText: { color: COLORS.text, fontSize: 12, fontWeight: '500' },
  finishBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  finishButton: { height: 54, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheetContent: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: COLORS.sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', overflow: 'hidden' },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  scoreHeadName: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '600' },
  scoreHeadCurrent: { color: COLORS.textMuted, fontSize: 13 },
  pickCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  playedCount: { color: COLORS.textMuted, fontSize: 13, fontWeight: '400', marginLeft: -4 },
  pickCircleOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});