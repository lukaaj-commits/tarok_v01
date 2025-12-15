import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Plus, Info, Trash2, RotateCcw, Play, ChevronLeft, Check } from 'lucide-react-native'; // Dodana Check ikona

// --- TIPI ---
type Player = {
  id: string;
  name: string;
  total_score: number;
  position: number;
};

type Radelc = {
  id: string;
  player_id: string;
  is_used: boolean;
  position: number;
};

type ScoreEntry = {
  id: string;
  points: number;
  created_at: string;
  played: boolean; // To polje zdaj nujno rabimo
  player_id?: string;
};

type Game = {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
};

export default function ActiveGame() {
  // --- STANJA ZA LOBBY ---
  const [activeGamesList, setActiveGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STANJA ZA TRENUTNO IGRO ---
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('');
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  
  // --- STANJA ZA VNOSE IN MODALE ---
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [isPlayed, setIsPlayed] = useState(false); // NOVO: Checkbox stanje
  
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); 
  const [showGameHistoryModal, setShowGameHistoryModal] = useState(false);
  const [showFinishGameModal, setShowFinishGameModal] = useState(false);
  const [showKlopModal, setShowKlopModal] = useState(false);
  
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [gameHistory, setGameHistory] = useState<ScoreEntry[]>([]);
  
  const scoreInputRef = useRef<TextInput>(null);

  // --- 1. LOBBY LOGIKA ---
  useFocusEffect(
    useCallback(() => {
      fetchActiveGamesList();
    }, [])
  );

  const fetchActiveGamesList = async () => {
    if (!gameId) setLoading(true);
    try {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setActiveGamesList(data || []);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. VSTOP V IGRO ---
  const enterGame = async (selectedGame: Game) => {
    setLoading(true);
    try {
      setGameId(selectedGame.id);
      setGameName(selectedGame.name);
      await loadPlayers(selectedGame.id);
      await loadRadelci(selectedGame.id);
    } catch (error) {
      console.error('Error entering game:', error);
    } finally {
      setLoading(false);
    }
  };

  const exitToLobby = () => {
    setGameId(null);
    setPlayers([]);
    setRadelci([]);
    fetchActiveGamesList();
  };

  // --- 3. NOVA IGRA ---
  const handleStartNewGame = async () => {
    createGameInDb();
  };

  const createGameInDb = async () => {
    setLoading(true);
    try {
      const newName = `${new Date().toLocaleDateString('sl-SI')} Tarok ${new Date().toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}`;
      const { data: newGame, error } = await supabase
        .from('games')
        .insert({ name: newName, is_active: true })
        .select()
        .single();

      if (error) throw error;
      
      await fetchActiveGamesList();
      await enterGame(newGame);
    } catch (error) {
      console.error('Error creating game:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIKA IGRE ---

  const loadPlayers = async (gId: string) => {
    const { data } = await supabase.from('players').select('*').eq('game_id', gId).order('position');
    setPlayers(data || []);
  };

  const loadRadelci = async (gId: string) => {
    const { data } = await supabase.from('radelci').select('*').eq('game_id', gId).order('position');
    setRadelci(data || []);
  };

  const addPlayer = async () => {
    if (!gameId || players.length >= 7) return;
    try {
      const { data } = await supabase
        .from('players')
        .insert({ game_id: gameId, name: '', position: players.length })
        .select().single();
      if (data) setPlayers([...players, data]);
    } catch (e) { console.error(e); }
  };

  const updatePlayerNameLocal = (id: string, name: string) => {
    setPlayers(players.map(p => p.id === id ? { ...p, name } : p));
  };

  const updatePlayerNameDB = async (id: string, name: string) => {
    await supabase.from('players').update({ name: name.trim() }).eq('id', id);
  };

  const deletePlayer = async (id: string) => {
    await supabase.from('players').delete().eq('id', id);
    setPlayers(players.filter(p => p.id !== id));
    setRadelci(radelci.filter(r => r.player_id !== id));
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

  // --- VNOS TOČK ---
  const openScoreInput = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setScoreInput('');
    setIsPlayed(false); // Resetiraj checkbox na false ob odprtju
    setShowScoreModal(true);
  };

  useEffect(() => {
    if (showScoreModal) {
      setTimeout(() => scoreInputRef.current?.focus(), 100);
    }
  }, [showScoreModal]);

  const toggleSign = () => {
    setScoreInput((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-')) return prev.substring(1);
      return '-' + prev;
    });
  };

  const submitScore = async () => {
    if (!selectedPlayerId || !gameId || !scoreInput) return;
    const points = parseInt(scoreInput, 10);
    if (isNaN(points)) return;

    try {
      // --- SPREMEMBA: Dodan 'played: isPlayed' ---
      const { error } = await supabase.from('score_entries').insert({
        player_id: selectedPlayerId, 
        game_id: gameId, 
        points,
        played: isPlayed 
      });
      if (error) throw error;

      const player = players.find(p => p.id === selectedPlayerId);
      if (player) {
        const newScore = player.total_score + points;
        await supabase.from('players').update({ total_score: newScore }).eq('id', selectedPlayerId);
        setPlayers(players.map(p => p.id === selectedPlayerId ? { ...p, total_score: newScore } : p));
        
        if (newScore === 0) setShowKlopModal(true);
      }
      setShowScoreModal(false);
      setScoreInput('');
      setIsPlayed(false);
    } catch (e) { console.error(e); }
  };

  // --- ZGODOVINA (POSAMEZNIK) ---
  const loadPlayerHistory = async (pid: string) => {
    const { data } = await supabase.from('score_entries').select('*').eq('player_id', pid).order('created_at');
    setPlayerHistory(data || []);
    setSelectedPlayerId(pid);
    setShowHistoryModal(true);
  };

  // --- ZGODOVINA (CELA IGRA) ---
  const loadGameHistory = async () => {
    if (!gameId) return;
    try {
      const { data } = await supabase
        .from('score_entries')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false });

      setGameHistory(data || []);
      setShowGameHistoryModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const finishGame = async () => {
    if (gameId) {
      await supabase.from('games').update({ is_active: false }).eq('id', gameId);
    }
    setShowFinishGameModal(false);
    exitToLobby();
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const pRadelci = radelci.filter(r => r.player_id === item.id);
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameContainer}>
            <TextInput
              style={styles.playerNameInput}
              value={item.name}
              onChangeText={(t) => updatePlayerNameLocal(item.id, t)}
              onBlur={() => updatePlayerNameDB(item.id, item.name)}
              placeholder="Ime"
              placeholderTextColor="#666"
            />
            <TouchableOpacity onPress={() => loadPlayerHistory(item.id)} style={styles.infoButton}>
              <Info size={20} color="#4a9eff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deletePlayer(item.id)} style={styles.deleteButton}>
              <Trash2 size={20} color="#ff4a4a" />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.scoreContainer} onPress={() => openScoreInput(item.id)}>
          <Text style={styles.scoreText}>{item.total_score}</Text>
        </TouchableOpacity>
        <ScrollView horizontal style={styles.radelciContainer} showsHorizontalScrollIndicator={false}>
          {pRadelci.map(r => (
            <TouchableOpacity key={r.id} onPress={() => toggleRadelc(r.id, r.is_used)}>
              <View style={[styles.radelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ==========================================
  // RENDER
  // ==========================================

  // 1. Loading
  if (loading && !gameId && activeGamesList.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4a9eff" />
      </View>
    );
  }

  // 2. LOBBY
  if (!gameId && activeGamesList.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.welcomeTitle}>Tarok</Text>
        <Text style={styles.welcomeSubtitle}>Ni aktivne igre</Text>
        <TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame}>
          <Play size={32} color="#fff" fill="#fff" />
          <Text style={styles.bigStartButtonText}>Začni novo igro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. SEZNAM IGER
  if (!gameId) {
    return (
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
                  <Text style={styles.gameName}>{item.name}</Text>
                  <Text style={styles.gameDate}>
                    {new Date(item.created_at).toLocaleDateString('sl-SI')} • {new Date(item.created_at).toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                </View>
                <Play size={24} color="#4a9eff" fill="#4a9eff" />
              </TouchableOpacity>
            )}
          />
          <View style={{ padding: 16 }}>
            <TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame}>
              <Plus size={24} color="#fff" />
              <Text style={styles.bigStartButtonText}>Začni še eno igro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 4. IGRA
  return (
    <View style={styles.container}>
      <View style={styles.gameHeaderBar}>
        <TouchableOpacity onPress={exitToLobby} style={styles.backButton}>
          <ChevronLeft size={28} color="#4a9eff" />
          <Text style={styles.backButtonText}>Seznam</Text>
        </TouchableOpacity>
        <Text style={styles.headerGameTitle} numberOfLines={1}>
          {gameName || 'Tarok'}
        </Text>
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Igralec</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addRadelcButton} onPress={addGlobalRadelc}>
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Radelc</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.infoGameButton} onPress={loadGameHistory}>
          <Info size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishGameButtonOrange} onPress={() => setShowFinishGameModal(true)}>
          <RotateCcw size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayer}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Dodaj igralce za začetek.</Text>
        }
      />

      {/* MODAL: VNOS TOČK */}
      <Modal visible={showScoreModal} transparent animationType="fade" onRequestClose={() => setShowScoreModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vnesi točke</Text>
            
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.signButton} onPress={toggleSign} activeOpacity={0.7}>
                <Text style={styles.signButtonText}>+/-</Text>
              </TouchableOpacity>
              <View style={styles.scoreInputWrapper}>
                <TextInput
                  ref={scoreInputRef}
                  style={styles.scoreInputField}
                  value={scoreInput}
                  onChangeText={setScoreInput}
                  keyboardType="numeric"
                  returnKeyType="done"
                  placeholder="20"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* --- NOVO: CHECKBOX "IGRAL JE" --- */}
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setIsPlayed(!isPlayed)}>
              <View style={[styles.checkbox, isPlayed && styles.checkboxChecked]}>
                {isPlayed && <Check size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>Igral je (Rufer)</Text>
            </TouchableOpacity>
            {/* ---------------------------------- */}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowScoreModal(false)}>
                <Text style={styles.modalButtonText}>Prekliči</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={submitScore}>
                <Text style={styles.modalButtonText}>Potrdi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: ZGODOVINA (POSAMEZNIK) */}
      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={styles.modalTitle}>Zgodovina igralca</Text>
            <ScrollView style={styles.historyList}>
              {playerHistory.map((entry, index) => {
                let runningTotal = 0;
                for (let i = 0; i <= index; i++) runningTotal += playerHistory[i].points;
                return (
                  <View key={entry.id} style={styles.historyItem}>
                    {/* TOČKE + RUMENA PIKICA */}
                    <View style={styles.pointsWrapper}>
                      <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>
                        {entry.points > 0 ? '+' : ''}{entry.points}
                      </Text>
                      {entry.played && <View style={styles.yellowDot} />} 
                    </View>

                    <Text style={styles.historyTotal}>= {runningTotal}</Text>
                    <Text style={styles.historyDate}>{new Date(entry.created_at).toLocaleTimeString('sl-SI', {hour:'2-digit', minute:'2-digit'})}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowHistoryModal(false)}>
              <Text style={styles.modalButtonText}>Zapri</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: POTEK IGRE (CELA IGRA) */}
      <Modal visible={showGameHistoryModal} transparent animationType="slide" onRequestClose={() => setShowGameHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={styles.modalTitle}>Potek igre</Text>
            <ScrollView style={styles.historyList}>
              {gameHistory.length === 0 ? (
                 <Text style={styles.emptyText}>Ni vnosov.</Text>
              ) : (
                gameHistory.map((entry) => {
                  const playerName = players.find(p => p.id === entry.player_id)?.name || 'Neznan';
                  return (
                    <View key={entry.id} style={styles.historyItem}>
                      <Text style={styles.historyPlayerName} numberOfLines={1}>{playerName}</Text>
                      
                      {/* TOČKE + RUMENA PIKICA */}
                      <View style={styles.pointsWrapper}>
                         <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>
                          {entry.points > 0 ? '+' : ''}{entry.points}
                        </Text>
                        {entry.played && <View style={styles.yellowDot} />}
                      </View>
                      
                      <Text style={styles.historyDate}>
                        {new Date(entry.created_at).toLocaleTimeString('sl-SI', {hour:'2-digit', minute:'2-digit'})}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowGameHistoryModal(false)}>
              <Text style={styles.modalButtonText}>Zapri</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinishGameModal} transparent animationType="fade" onRequestClose={() => setShowFinishGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Zaključi igro?</Text>
            <Text style={styles.confirmText}>Igra bo arhivirana.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowFinishGameModal(false)}>
                <Text style={styles.modalButtonText}>Prekliči</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.finishGameButtonOrange]} onPress={finishGame}>
                <Text style={styles.modalButtonText}>Zaključi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showKlopModal} transparent animationType="fade" onRequestClose={() => setShowKlopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.klopTitle}>Obvezen klop!</Text>
            <TouchableOpacity style={styles.klopButton} onPress={() => setShowKlopModal(false)}>
              <Text style={styles.modalButtonText}>Zapri</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  lobbyTitle: { fontSize: 32, fontWeight: '800', color: '#fff', padding: 20, paddingTop: 60 },
  gameCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  gameDate: { fontSize: 14, color: '#888' },
  
  bigStartButton: {
    backgroundColor: '#4a9eff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  bigStartButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  welcomeTitle: { fontSize: 48, fontWeight: '800', color: '#fff', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 18, color: '#888', marginBottom: 40 },

  gameHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#0f0f0f',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  backButtonText: { color: '#4a9eff', fontSize: 16, fontWeight: '600' },
  headerGameTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },

  header: { padding: 16, gap: 8, flexDirection: 'row' },
  addButton: { flex: 2, backgroundColor: '#4a9eff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 4 },
  addRadelcButton: { flex: 2, backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 4 },
  infoGameButton: { flex: 1, backgroundColor: '#4a9eff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  finishGameButtonOrange: { flex: 1, backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  listContainer: { padding: 16, gap: 16 },
  playerCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#333' },
  playerHeader: { marginBottom: 12 },
  playerNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerNameInput: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600', padding: 8, backgroundColor: '#2a2a2a', borderRadius: 8 },
  infoButton: { padding: 8 },
  deleteButton: { padding: 8 },
  scoreContainer: { alignItems: 'center', paddingVertical: 20, backgroundColor: '#2a2a2a', borderRadius: 12, marginBottom: 12 },
  scoreText: { color: '#fff', fontSize: 48, fontWeight: '700' },
  radelciContainer: { flexDirection: 'row', paddingVertical: 8 },
  radelc: { width: 32, height: 32, borderRadius: 16, marginHorizontal: 4 },
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 3, borderColor: '#4a9eff' },
  radelcUsed: { backgroundColor: '#000', borderWidth: 0 },
  emptyText: { color: '#666', fontSize: 16, textAlign: 'center', marginTop: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, width: '80%', maxWidth: 400 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  
  inputRow: { flexDirection: 'row', width: '100%', gap: 12, marginBottom: 20 },
  signButton: { backgroundColor: '#333', width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  signButtonText: { color: '#4a9eff', fontSize: 20, fontWeight: '700' },
  scoreInputWrapper: { flex: 1, height: 60, backgroundColor: '#2a2a2a', borderRadius: 12, justifyContent: 'center' },
  scoreInputField: { width: '100%', height: '100%', color: '#fff', fontSize: 24, textAlign: 'center' },
  
  // CHECKBOX STYLES
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 10 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#666', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#4a9eff', borderColor: '#4a9eff' },
  checkboxLabel: { color: '#fff', fontSize: 16 },

  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#444' },
  submitButton: { backgroundColor: '#4a9eff' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  historyModal: { height: '70%' },
  historyList: { flex: 1, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8 },
  historyPlayerName: { color: '#fff', fontSize: 16, fontWeight: '600', width: 80, marginRight: 8 },
  
  // WRAPPER ZA PIKICO IN TOČKE
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  yellowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },

  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: '#22c55e' },
  negativePoints: { color: '#ef4444' },
  historyTotal: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: '#666', fontSize: 12, flex: 1, textAlign: 'right' },
  
  closeButton: { backgroundColor: '#4a9eff', padding: 14, borderRadius: 12, alignItems: 'center' },
  emptyHistoryContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyHistoryText: { color: '#666', fontSize: 16, textAlign: 'center' },
  
  confirmText: { color: '#ccc', fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  
  klopTitle: { color: '#ffd700', fontSize: 28, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
  klopButton: { backgroundColor: '#4a9eff', padding: 16, borderRadius: 12, alignItems: 'center' },
});
