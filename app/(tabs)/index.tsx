import { useState, useCallback, useEffect } from 'react';
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
  Dimensions
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, Info, Trash2, RotateCcw, Play, ChevronLeft, Trophy, Search, UserPlus, CheckCircle2, Delete } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';

type PlayerProfile = { id: string; name: string; };
type Player = { id: string; name: string; total_score: number; position: number; profile_id?: string; };
type Radelc = { id: string; player_id: string; is_used: boolean; position: number; };
type ScoreEntry = { id: string; points: number; created_at: string; player_id?: string; played?: boolean; };
type Game = { 
  id: string; 
  name: string; 
  created_at: string; 
  is_active: boolean; 
  players?: { name: string; total_score: number }[]; 
};

// --- BARVE ---
const COLORS = {
  bg: '#0f172a',
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

// --- NOVA BARVNA PALETA (Visok kontrast) ---
const CHART_COLORS = [
  '#FF6B6B', // Rdeča
  '#4ECDC4', // Turkizna
  '#FFE66D', // Rumena
  '#1A535C', // Temno modra/zelena
  '#FF9F1C', // Oranžna
  '#C7F464', // Limeta
  '#9D4EDD', // Vijolična
  '#F72585'  // Roza
];

// --- GRADIENTI ---
const GRADIENT_COLORS = ['#556eeb', '#6050ea']; 

export default function ActiveGame() {
  const [activeGamesList, setActiveGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [allProfiles, setAllProfiles] = useState<PlayerProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // SEZNAM IZBRANIH IGRALCEV ZA DODAJANJE
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());

  // NOVO STANJE ZA FILTRIRANJE GRAFA
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
  const [scorePlayed, setScorePlayed] = useState(false);
  
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [allGameHistory, setAllGameHistory] = useState<ScoreEntry[]>([]); 
  
  const [leaderboardTab, setLeaderboardTab] = useState<'list' | 'chart'>('list');
  const [isInputActive, setIsInputActive] = useState(false);

  useFocusEffect(useCallback(() => { fetchActiveGamesList(); }, []));
  useEffect(() => { fetchProfiles(false); }, []);

  useEffect(() => {
    if (showAddPlayerModal) {
      setIsInputActive(false); 
      setSearchQuery('');
      setSelectedProfileIds(new Set()); 
    }
  }, [showAddPlayerModal]);

  // RESET FILTRA KO SE ZAPRE MODAL
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
    } catch (error) { console.error(error); } finally { setLoading(false); }
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
    setScorePlayed(false); 
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
    if (isNaN(points)) { Alert.alert("Napaka", "Neveljaven vnos."); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('score_entries').insert({
        player_id: selectedPlayerId, game_id: gameId, points, played: scorePlayed
      });
      if (error) throw error;

      const player = players.find(p => p.id === selectedPlayerId);
      if (player) {
        const newScore = player.total_score + points;
        await supabase.from('players').update({ total_score: newScore }).eq('id', selectedPlayerId);
        setPlayers(players.map(p => p.id === selectedPlayerId ? { ...p, total_score: newScore } : p));
        if (newScore === 0) setShowKlopModal(true);
      }
      setShowScoreModal(false); setScoreInput('');
    } catch (e: any) { Alert.alert("Napaka", e.message); } finally { setSubmitting(false); }
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

  // --- POSODOBLJENA FUNKCIJA ZA PRIPRAVO PODATKOV ZA GRAF ---
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
        const updates = players.map(async (p) => {
            const unusedRadelci = radelci.filter(r => r.player_id === p.id && !r.is_used);
            if (unusedRadelci.length > 0) {
                const penalty = unusedRadelci.length * -50;
                await supabase.from('score_entries').insert({
                    game_id: gameId, player_id: p.id, points: penalty, played: false 
                });
                await supabase.from('players').update({ total_score: p.total_score + penalty }).eq('id', p.id);
                const radelcIds = unusedRadelci.map(r => r.id);
                await supabase.from('radelci').update({ is_used: true }).in('id', radelcIds);
            }
        });
        await Promise.all(updates);
        await supabase.from('games').update({ is_active: false }).eq('id', gameId);
        setShowFinishGameModal(false); exitToLobby();
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

  const renderPlayer = ({ item }: { item: Player }) => {
    const pRadelci = radelci.filter(r => r.player_id === item.id);
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameContainer}>
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

  if (loading && !gameId && activeGamesList.length === 0) return (<View style={[styles.container, styles.centerContent]}><ActivityIndicator size="large" color={COLORS.primary} /></View>);
  
  if (!gameId && activeGamesList.length === 0) return (
    <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.welcomeTitle}>Tarok</Text>
        <Text style={styles.welcomeSubtitle}>Ni aktivne igre</Text>
        <TouchableOpacity onPress={handleStartNewGame} activeOpacity={0.8}>
            <LinearGradient 
              colors={GRADIENT_COLORS} 
              start={{x: 0, y: 0}} 
              end={{x: 1, y: 0}}
              style={styles.bigStartButton}
            >
                <Play size={32} color="#fff" fill="#fff" />
                <Text style={styles.bigStartButtonText}>Začni novo igro</Text>
            </LinearGradient>
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
                <TouchableOpacity onPress={handleStartNewGame} activeOpacity={0.8}>
                    <LinearGradient 
                      colors={GRADIENT_COLORS} 
                      start={{x: 0, y: 0}} 
                      end={{x: 1, y: 0}}
                      style={styles.bigStartButton}
                    >
                        <Plus size={24} color="#fff" />
                        <Text style={styles.bigStartButtonText}>Začni še eno igro</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.gameHeaderBar}>
        <TouchableOpacity onPress={exitToLobby} style={styles.backButton}>
            <ChevronLeft size={28} color={COLORS.textMuted} />
            <Text style={styles.backButtonText}>Seznam</Text>
        </TouchableOpacity>
        
        <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={styles.headerGameTitle} numberOfLines={1}>{gameName || 'Tarok'}</Text>
            {players.length > 0 && (
                <Text style={styles.headerLeaderText}>{getLeaderText()}</Text>
            )}
        </View>
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={{flex:2}} onPress={openAddPlayerModal} activeOpacity={0.8}>
            <LinearGradient 
              colors={GRADIENT_COLORS} 
              start={{x: 0, y: 0}} 
              end={{x: 1, y: 0}}
              style={styles.gradientHeaderBtn}
            >
                <Plus size={20} color="#fff" />
                <Text style={styles.addButtonText}>Igralec</Text>
            </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={{flex:2}} onPress={addGlobalRadelc} activeOpacity={0.8}>
             <LinearGradient 
                colors={['#20B2AA', '#20B2AA']} 
                style={styles.gradientHeaderBtn}
             >
                <Plus size={20} color="#fff" />
                <Text style={styles.addButtonText}>Radelc</Text>
             </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={{flex: 1}} onPress={openLeaderboard} activeOpacity={0.8}>
             <LinearGradient 
              colors={['#5863ea', '#5863ea']} 
              style={styles.gradientIconBtn}
             >
                <Trophy size={24} color="#fff" />
             </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.infoGameButton} onPress={() => setShowFinishGameModal(true)}>
            <RotateCcw size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList data={players} keyExtractor={(item) => item.id} renderItem={renderPlayer} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.emptyText}>Dodaj igralce za začetek.</Text>} />

      {/* MODAL: DODAJ IGRALCA */}
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
            {allProfiles.length === 0 && searchQuery.length === 0 && (<Text style={{color: COLORS.textMuted, textAlign: 'center', marginBottom: 10}}>Nalagam imenik...</Text>)}
            <FlatList
                data={filteredProfiles} keyExtractor={(item) => item.id} style={{ flex: 1, marginVertical: 12 }}
                renderItem={({ item }) => {
                    const isSelected = selectedProfileIds.has(item.id);
                    return (
                        <TouchableOpacity style={styles.profileItem} onPress={() => toggleProfileSelection(item)}>
                            <Text style={styles.profileName}>{item.name}</Text>
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

      {/* MODAL: VNOS TOČK */}
      <Modal visible={showScoreModal} transparent animationType="fade" onRequestClose={() => setShowScoreModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { marginBottom: 16 }]}>Vnesi točke ({getSelectedPlayerName()})</Text>
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
            <TouchableOpacity style={styles.playedToggleContainer} onPress={() => setScorePlayed(!scorePlayed)} activeOpacity={0.8}>
                <View style={[styles.checkboxBase, scorePlayed && styles.checkboxChecked]}>{scorePlayed && <CheckCircle2 size={20} color="#fff" />}</View>
                <Text style={styles.playedLabel}>Igralec je igral?</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowScoreModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              <TouchableOpacity style={{flex:1}} onPress={submitScore} disabled={submitting}>
                 <LinearGradient 
                  colors={GRADIENT_COLORS} 
                  start={{x: 0, y: 0}} 
                  end={{x: 1, y: 0}}
                  style={[styles.modalButton, {width:'100%', borderWidth:0}]}
                 >
                    {submitting ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.modalButtonText}>Potrdi</Text>)}
                 </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: ZGODOVINA POSAMEZNIKA */}
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
                          <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>{entry.points > 0 ? '+' : ''}{entry.points}</Text>
                      </View>
                      <View style={styles.dotContainer}>
                          {entry.played && <View style={styles.playedDot} />}
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

      {/* MODAL: STANJE IGRE (LEADERBOARD + CHART) */}
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
                    return (
                    <View key={player.id} style={styles.leaderboardItem}>
                        <Text style={styles.rankText}>{rank}.</Text>
                        <Text style={styles.leaderboardName} numberOfLines={1}>{player.name || 'Brez imena'}</Text>
                        <View style={styles.miniRadelciContainer}>
                            {pRadelci.map(r => (
                                <View key={r.id} style={[styles.miniRadelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />
                            ))}
                        </View>
                        <Text style={[styles.leaderboardScore, player.total_score >= 0 ? styles.positivePoints : styles.negativePoints]}>{player.total_score}</Text>
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
                            
                            {/* CUSTOM LEGENDA (FILTRI) - PREMAKNJENO POD GRAF */}
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

      {/* MODAL: STATISTIKA VSEH (INFO) */}
      <Modal visible={showAllHistoryModal} transparent animationType="slide" onRequestClose={() => setShowAllHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Vsi igralci - Zgodovina</Text>
            <ScrollView style={[styles.historyList, { marginTop: 20 }]}>
              {players.sort((a, b) => b.total_score - a.total_score).map((player, playerIndex, array) => {
                  const playerEntries = allGameHistory.filter((e) => e.player_id === player.id);
                  if (playerEntries.length === 0) return null;

                  const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                  const playedCount = playerEntries.filter(e => e.played).length;

                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={[styles.playerHistoryHeader, {backgroundColor: COLORS.slateBlue}]}>
                        <View style={styles.playerRankBadge}>
                          {rank === 1 && <Trophy size={16} color="#ffd700" />}
                          {rank === 2 && <Trophy size={16} color="#c0c0c0" />}
                          {rank === 3 && <Trophy size={16} color="#cd7f32" />}
                          {rank > 3 && (<Text style={styles.playerRankText}>{rank}</Text>)}
                        </View>
                        <Text style={styles.playerHistorySectionTitle}>
                            {player.name} <Text style={{fontWeight: '400', fontSize: 14, color: COLORS.winnerGrey}}>(igralec je igral: {playedCount})</Text>
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
                                    <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>{entry.points > 0 ? '+' : ''}{entry.points}</Text>
                                </View>
                                <View style={styles.dotContainer}>
                                    {entry.played && <View style={styles.playedDot} />}
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

      {/* OSTALI MODALI SO NESPREMENJENI (Brisanje, Zaključek, Klop) */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Izbriši igralca?</Text>
            <Text style={styles.confirmText}>Vsi podatki tega igralca za to igro bodo izgubljeni.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowDeleteModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, {backgroundColor: COLORS.danger}]} onPress={confirmDeletePlayer}><Text style={styles.modalButtonText}>Izbriši</Text></TouchableOpacity>
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
              <TouchableOpacity style={{flex:1}} onPress={finishGame}>
                <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.modalButton, {width:'100%', borderWidth:0}]}><Text style={styles.modalButtonText}>Zaključi</Text></LinearGradient>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  lobbyTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  gameCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gameName: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  gameDate: { fontSize: 14, color: COLORS.textMuted },
  
  bigStartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 32, borderRadius: 16, gap: 12, width: '100%', maxWidth: 400 },
  bigStartButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  
  welcomeTitle: { fontSize: 48, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  welcomeSubtitle: { fontSize: 18, color: COLORS.textMuted, marginBottom: 40 },
  gameHeaderBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: COLORS.bg },
  backButton: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  backButtonText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  headerGameTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  headerLeaderText: { color: COLORS.winnerGrey, fontSize: 13, fontWeight: '400', marginTop: 2 },
  
  header: { padding: 16, gap: 8, flexDirection: 'row' },
  gradientHeaderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 4, flex: 1, width: '100%' },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  gradientIconBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  infoGameButton: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },

  listContainer: { padding: 16, gap: 16 },
  playerCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  playerHeader: { marginBottom: 12 },
  playerNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerNameText: { flex: 1, color: COLORS.text, fontSize: 20, fontWeight: '700' },
  infoButton: { padding: 8 },
  deleteButton: { padding: 8 },
  scoreContainer: { alignItems: 'center', paddingVertical: 20, backgroundColor: COLORS.inputBg, borderRadius: 12, marginBottom: 12 },
  scoreText: { color: COLORS.text, fontSize: 48, fontWeight: '700' },
  radelciContainer: { flexDirection: 'row', paddingVertical: 8 },
  radelcBase: { width: 24, height: 24, borderRadius: 12, marginHorizontal: 4 },
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.radelcBorder },
  miniRadelc: { width: 12, height: 12, borderRadius: 6 },
  
  emptyText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  
  leaderboardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statsButton: { position: 'absolute', right: 0, padding: 8 },
  
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 20 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 20, borderWidth: 0, borderColor: 'transparent', backgroundColor: 'transparent' },
  profileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 16, marginBottom: 10 },
  profileName: { color: COLORS.text, fontSize: 20, fontWeight: '600' },
  createNewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: COLORS.inputBg, borderRadius: 16, gap: 12, marginTop: 10 },
  createNewText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  confirmButton: { backgroundColor: COLORS.confirmTeal, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 0 },

  scoreDisplay: { backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  scoreDisplayText: { color: COLORS.text, fontSize: 48, fontWeight: '700' },
  numpadContainer: { width: '100%', gap: 8, marginBottom: 20 },
  numpadRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  numpadButton: { flex: 1, backgroundColor: COLORS.inputBg, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  numpadActionButton: { backgroundColor: '#2D3546' },
  numpadText: { color: COLORS.text, fontSize: 24, fontWeight: '600' },
  playedToggleContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 12, borderRadius: 12, marginBottom: 20, gap: 12 },
  checkboxBase: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  playedLabel: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: COLORS.inputBg },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  historyModal: { height: '70%' },
  historyList: { flex: 1, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 8, marginBottom: 12 },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  fixedPointsWidth: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotContainer: { width: 20, alignItems: 'flex-start' },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: COLORS.success },
  negativePoints: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  historyTotal: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: COLORS.textMuted, fontSize: 12, flex: 1, textAlign: 'right' },
  
  tabContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: { backgroundColor: COLORS.card },
  tabText: { color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  chartContainer: { flex: 1, justifyContent: 'center' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 },
  legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 8, marginBottom: 10 },
  rankText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700', marginRight: 12 },
  leaderboardName: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1 },
  leaderboardScore: { fontSize: 22, fontWeight: '800', width: 60, textAlign: 'right' },
  miniRadelciContainer: { flexDirection: 'row', gap: 2 },
  
  closeButton: { backgroundColor: COLORS.closeBtn, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 0 },
  
  emptyHistoryContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyHistoryText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center' },
  confirmText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  klopTitle: { color: COLORS.warning, fontSize: 28, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
  klopButton: { backgroundColor: COLORS.closeBtn, padding: 16, borderRadius: 12, alignItems: 'center' },

  playerHistorySection: { marginBottom: 24 },
  playerHistoryHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '600' },
  playerTotalScore: { fontSize: 22, fontWeight: '700' },
});