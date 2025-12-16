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
  Keyboard, 
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Plus, Info, Trash2, RotateCcw, Play, ChevronLeft, Trophy, Search, UserPlus, CheckCircle2 } from 'lucide-react-native';

type PlayerProfile = { id: string; name: string; };
type Player = { id: string; name: string; total_score: number; position: number; profile_id?: string; };
type Radelc = { id: string; player_id: string; is_used: boolean; position: number; };
type ScoreEntry = { id: string; points: number; created_at: string; player_id?: string; played?: boolean; };
type Game = { id: string; name: string; created_at: string; is_active: boolean; };

export default function ActiveGame() {
  const [activeGamesList, setActiveGamesList] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [allProfiles, setAllProfiles] = useState<PlayerProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [scorePlayed, setScorePlayed] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); 
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showFinishGameModal, setShowFinishGameModal] = useState(false);
  const [showKlopModal, setShowKlopModal] = useState(false);
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  
  // --- JEDRSKA OPCIJA: STANJE ZA "FISHING" INPUT ---
  // Ko je false, kažemo samo gumb (tipkovnica nemogoča).
  // Ko je true, pokažemo pravi input.
  const [isInputActive, setIsInputActive] = useState(false);

  const scoreInputRef = useRef<TextInput>(null);

  useFocusEffect(useCallback(() => { fetchActiveGamesList(); }, []));
  useEffect(() => { fetchProfiles(false); }, []);

  // Resetiramo stanje inputa vsakič, ko odpremo modal
  useEffect(() => {
    if (showAddPlayerModal) {
      setIsInputActive(false); // Začnemo z "lažnim" inputom
      setSearchQuery('');
    }
  }, [showAddPlayerModal]);

  const fetchActiveGamesList = async () => {
    if (!gameId) setLoading(true);
    try {
      const { data } = await supabase.from('games').select('*').eq('is_active', true).order('created_at', { ascending: false });
      setActiveGamesList(data || []);
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

  const addExistingProfileToGame = async (profile: PlayerProfile) => {
    if (!gameId) return;
    if (players.some(p => p.profile_id === profile.id || p.name === profile.name)) { Alert.alert("Opozorilo", "Igralec je že v igri."); return; }
    try {
      const { data } = await supabase.from('players').insert({ game_id: gameId, name: profile.name, position: players.length, profile_id: profile.id }).select().single();
      if (data) { setPlayers([...players, data]); setShowAddPlayerModal(false); }
    } catch (e) { console.error(e); }
  };

  const createNewProfileAndAdd = async () => {
    if (!gameId || !searchQuery.trim()) return;
    const name = searchQuery.trim();
    try {
      const { data: newProfile, error } = await supabase.from('player_profiles').insert({ name }).select().single();
      if (error) {
        const { data: existingProfile } = await supabase.from('player_profiles').select('*').eq('name', name).single();
        if (existingProfile) { addExistingProfileToGame(existingProfile); return; }
        return;
      }
      await addExistingProfileToGame(newProfile); fetchProfiles(false);
    } catch (e) { console.error(e); }
  };

  const filteredProfiles = allProfiles.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const openScoreInput = (playerId: string) => {
    setSelectedPlayerId(playerId); setScoreInput(''); setScorePlayed(false); setShowScoreModal(true);
  };

  useEffect(() => {
    if (showScoreModal) { setTimeout(() => scoreInputRef.current?.focus(), 100); }
  }, [showScoreModal]);

  const toggleSign = () => {
    setScoreInput((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-')) return prev.substring(1);
      return '-' + prev;
    });
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

  // --- ZAKLJUČEK IGRE (MODRA PIKA LOGIKA) ---
  const finishGame = async () => {
    if (!gameId) return;
    setLoading(true);
    
    try {
        const updates = players.map(async (p) => {
            const unusedRadelci = radelci.filter(r => r.player_id === p.id && !r.is_used);
            
            if (unusedRadelci.length > 0) {
                const penalty = unusedRadelci.length * -50;
                
                await supabase.from('score_entries').insert({
                    game_id: gameId,
                    player_id: p.id,
                    points: penalty,
                    played: false 
                });

                await supabase.from('players').update({ 
                    total_score: p.total_score + penalty 
                }).eq('id', p.id);

                const radelcIds = unusedRadelci.map(r => r.id);
                await supabase.from('radelci').update({ is_used: true }).in('id', radelcIds);
            }
        });

        await Promise.all(updates);
        await supabase.from('games').update({ is_active: false }).eq('id', gameId);
        
        setShowFinishGameModal(false);
        exitToLobby();

    } catch (e) {
        Alert.alert("Napaka", "Prišlo je do napake pri zaključevanju.");
    } finally {
        setLoading(false);
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const pRadelci = radelci.filter(r => r.player_id === item.id);
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameContainer}>
            <Text style={styles.playerNameText}>{item.name}</Text>
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
            <TouchableOpacity 
                key={r.id} 
                onPress={() => toggleRadelc(r.id, r.is_used)}
                hitSlop={{top: 15, bottom: 15, left: 10, right: 10}}
            >
              <View style={[styles.radelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading && !gameId && activeGamesList.length === 0) return (<View style={[styles.container, styles.centerContent]}><ActivityIndicator size="large" color="#4a9eff" /></View>);
  if (!gameId && activeGamesList.length === 0) return (<View style={[styles.container, styles.centerContent]}><Text style={styles.welcomeTitle}>Tarok</Text><Text style={styles.welcomeSubtitle}>Ni aktivne igre</Text><TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame}><Play size={32} color="#fff" fill="#fff" /><Text style={styles.bigStartButtonText}>Začni novo igro</Text></TouchableOpacity></View>);
  if (!gameId) return (<View style={styles.container}><Text style={styles.lobbyTitle}>Aktivne igre</Text><View style={{ flex: 1 }}><FlatList data={activeGamesList} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContainer} renderItem={({ item }) => (<TouchableOpacity style={styles.gameCard} onPress={() => enterGame(item)}><View><Text style={styles.gameName}>{item.name}</Text><Text style={styles.gameDate}>{new Date(item.created_at).toLocaleDateString('sl-SI')} • {new Date(item.created_at).toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}</Text></View><Play size={24} color="#4a9eff" fill="#4a9eff" /></TouchableOpacity>)} /><View style={{ padding: 16 }}><TouchableOpacity style={styles.bigStartButton} onPress={handleStartNewGame}><Plus size={24} color="#fff" /><Text style={styles.bigStartButtonText}>Začni še eno igro</Text></TouchableOpacity></View></View></View>);

  return (
    <View style={styles.container}>
      <View style={styles.gameHeaderBar}>
        <TouchableOpacity onPress={exitToLobby} style={styles.backButton}><ChevronLeft size={28} color="#4a9eff" /><Text style={styles.backButtonText}>Seznam</Text></TouchableOpacity>
        <Text style={styles.headerGameTitle} numberOfLines={1}>{gameName || 'Tarok'}</Text>
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.addButton} onPress={openAddPlayerModal}><Plus size={20} color="#fff" /><Text style={styles.addButtonText}>Igralec</Text></TouchableOpacity>
        <TouchableOpacity style={styles.addRadelcButton} onPress={addGlobalRadelc}><Plus size={20} color="#fff" /><Text style={styles.addButtonText}>Radelc</Text></TouchableOpacity>
        <TouchableOpacity style={styles.infoGameButton} onPress={() => setShowLeaderboardModal(true)}><Trophy size={24} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={styles.finishGameButtonOrange} onPress={() => setShowFinishGameModal(true)}><RotateCcw size={24} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList data={players} keyExtractor={(item) => item.id} renderItem={renderPlayer} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.emptyText}>Dodaj igralce za začetek.</Text>} />

      <Modal visible={showAddPlayerModal} animationType="slide" transparent onRequestClose={() => setShowAddPlayerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '90%', maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Dodaj igralca</Text>
            
            {/* --- JEDRSKA REŠITEV ZA TIPKOVNICO --- */}
            {isInputActive ? (
                // PRAVI INPUT (Ko uporabnik klikne)
                <View style={styles.searchContainer}>
                    <Search size={24} color="#666" style={{ marginRight: 12 }} />
                    <TextInput
                        autoFocus={true} // Ko se to prikaže, naj se TAKOJ odpre tipkovnica
                        style={[styles.searchInput, { outlineStyle: 'none', borderWidth: 0 } as any]}
                        placeholder="Išči ali ustvari novega..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        underlineColorAndroid="transparent"
                        selectionColor="#4a9eff"
                        cursorColor="#4a9eff"
                    />
                </View>
            ) : (
                // LAŽNI INPUT (Samo gumb - tipkovnica se NE more odpreti)
                <TouchableOpacity 
                    style={styles.searchContainer} 
                    activeOpacity={1} 
                    onPress={() => setIsInputActive(true)} // Ob kliku zamenjaj s pravim
                >
                    <Search size={24} color="#666" style={{ marginRight: 12 }} />
                    <Text style={{color: '#666', fontSize: 20}}>Išči ali ustvari novega...</Text>
                </TouchableOpacity>
            )}
            {/* ----------------------------------- */}

            {allProfiles.length === 0 && searchQuery.length === 0 && (<Text style={{color: '#666', textAlign: 'center', marginBottom: 10}}>Nalagam imenik...</Text>)}
            <FlatList
                data={filteredProfiles} keyExtractor={(item) => item.id} style={{ flex: 1, marginVertical: 12 }}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.profileItem} onPress={() => addExistingProfileToGame(item)}>
                        <Text style={styles.profileName}>{item.name}</Text>
                        <View style={{ backgroundColor: '#222', padding: 8, borderRadius: 20 }}><Plus size={24} color="#4a9eff" /></View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    searchQuery.length > 0 ? (
                        <TouchableOpacity style={styles.createNewButton} onPress={createNewProfileAndAdd}>
                            <UserPlus size={28} color="#fff" />
                            <Text style={styles.createNewText}>Ustvari: "{searchQuery}"</Text>
                        </TouchableOpacity>
                    ) : (<Text style={styles.emptyText}>Začni pisati ime...</Text>)
                }
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowAddPlayerModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showScoreModal} transparent animationType="fade" onRequestClose={() => setShowScoreModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vnesi točke</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.signButton} onPress={toggleSign} activeOpacity={0.7}><Text style={styles.signButtonText}>+/-</Text></TouchableOpacity>
              <View style={styles.scoreInputWrapper}>
                <TextInput ref={scoreInputRef} style={styles.scoreInputField} value={scoreInput} onChangeText={setScoreInput} keyboardType="numeric" returnKeyType="done" placeholder="20" placeholderTextColor="#666" />
              </View>
            </View>
            <TouchableOpacity style={styles.playedToggleContainer} onPress={() => setScorePlayed(!scorePlayed)} activeOpacity={0.8}>
                <View style={[styles.checkboxBase, scorePlayed && styles.checkboxChecked]}>{scorePlayed && <CheckCircle2 size={20} color="#000" />}</View>
                <Text style={styles.playedLabel}>Igralec je igral?</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowScoreModal(false)}><Text style={styles.modalButtonText}>Prekliči</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={submitScore} disabled={submitting}>{submitting ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.modalButtonText}>Potrdi</Text>)}</TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                    <View style={styles.pointsWrapper}>
                      <View style={styles.fixedPointsWidth}>
                          <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>{entry.points > 0 ? '+' : ''}{entry.points}</Text>
                      </View>
                      <View style={styles.dotContainer}>
                          {/* RUMENA PIKA (igral) */}
                          {entry.played && <View style={styles.playedDot} />}
                          {/* MODRA PIKA (kazen: ni igral in negativne točke) */}
                          {!entry.played && entry.points < 0 && <View style={styles.radelcDot} />}
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

      {/* Ostali modali... */}
      <Modal visible={showLeaderboardModal} transparent animationType="slide" onRequestClose={() => setShowLeaderboardModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={styles.modalTitle}>Trenutna lestvica 🏆</Text>
            <ScrollView style={styles.historyList}>
              {[...players].sort((a, b) => b.total_score - a.total_score).map((player, index, array) => {
                 const pRadelci = radelci.filter(r => r.player_id === player.id);
                 const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                 return (
                  <View key={player.id} style={styles.leaderboardItem}>
                    <Text style={styles.rankText}>{rank}.</Text>
                    <Text style={styles.leaderboardName} numberOfLines={1}>{player.name || 'Brez imena'}</Text>
                    <View style={styles.miniRadelciContainer}>{pRadelci.map(r => (<View key={r.id} style={[styles.miniRadelc, r.is_used ? styles.radelcUsed : styles.radelcUnused]} />))}</View>
                    <Text style={[styles.leaderboardScore, player.total_score >= 0 ? styles.positivePoints : styles.negativePoints]}>{player.total_score}</Text>
                  </View>
                 );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowLeaderboardModal(false)}><Text style={styles.modalButtonText}>Zapri</Text></TouchableOpacity>
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
              <TouchableOpacity style={[styles.modalButton, styles.finishGameButtonOrange]} onPress={finishGame}><Text style={styles.modalButtonText}>Zaključi</Text></TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  lobbyTitle: { fontSize: 32, fontWeight: '800', color: '#fff', padding: 20, paddingTop: 60 },
  gameCard: { backgroundColor: '#1a1a1a', padding: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gameName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  gameDate: { fontSize: 14, color: '#888' },
  bigStartButton: { backgroundColor: '#4a9eff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 32, borderRadius: 16, gap: 12, width: '100%', maxWidth: 400 },
  bigStartButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  welcomeTitle: { fontSize: 48, fontWeight: '800', color: '#fff', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 18, color: '#888', marginBottom: 40 },
  gameHeaderBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#0f0f0f' },
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
  playerNameText: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },
  infoButton: { padding: 8 },
  deleteButton: { padding: 8 },
  scoreContainer: { alignItems: 'center', paddingVertical: 20, backgroundColor: '#2a2a2a', borderRadius: 12, marginBottom: 12 },
  scoreText: { color: '#fff', fontSize: 48, fontWeight: '700' },
  radelciContainer: { flexDirection: 'row', paddingVertical: 8 },
  radelc: { width: 24, height: 24, borderRadius: 12, marginHorizontal: 4 },
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#4a9eff' },
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
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#444' },
  submitButton: { backgroundColor: '#4a9eff' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  historyModal: { height: '70%' },
  historyList: { flex: 1, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8 },
  historyPlayerName: { color: '#fff', fontSize: 16, fontWeight: '600', width: 80, marginRight: 8 },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  fixedPointsWidth: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotContainer: { width: 20, alignItems: 'flex-start' },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: '#22c55e' },
  negativePoints: { color: '#ef4444' },
  historyTotal: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: '#666', fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffd700', marginLeft: 6 },
  radelcDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4a9eff', marginLeft: 6 },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8, gap: 10 },
  rankText: { color: '#888', fontSize: 18, fontWeight: '700' },
  leaderboardName: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },
  leaderboardScore: { fontSize: 22, fontWeight: '800', width: 60, textAlign: 'right' },
  miniRadelciContainer: { flexDirection: 'row', gap: 2 },
  miniRadelc: { width: 12, height: 12, borderRadius: 6 },
  closeButton: { backgroundColor: '#4a9eff', padding: 14, borderRadius: 12, alignItems: 'center' },
  emptyHistoryContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyHistoryText: { color: '#666', fontSize: 16, textAlign: 'center' },
  confirmText: { color: '#ccc', fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  klopTitle: { color: '#ffd700', fontSize: 28, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
  klopButton: { backgroundColor: '#4a9eff', padding: 16, borderRadius: 12, alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 20 },
  searchInput: { flex: 1, color: '#fff', fontSize: 20, borderWidth: 0, borderColor: 'transparent', backgroundColor: 'transparent' },
  profileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 16, marginBottom: 10 },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '600' },
  createNewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: '#333', borderRadius: 16, gap: 12, marginTop: 10 },
  createNewText: { color: '#4a9eff', fontSize: 18, fontWeight: '700' },
  playedToggleContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', padding: 12, borderRadius: 12, marginBottom: 20, gap: 12 },
  checkboxBase: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#4a9eff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  checkboxChecked: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  playedLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
