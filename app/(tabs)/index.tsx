import { useState, useCallback, useRef } from 'react';
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
  ActivityIndicator, // Dodano za lepši loading
} from 'react-native';
import { useFocusEffect } from 'expo-router'; // KLJUČNO: Za osveževanje ko prideš nazaj na stran
import { supabase } from '@/lib/supabase';
import { Plus, Info, Trash2, RotateCcw, Play } from 'lucide-react-native'; // Dodal ikono Play

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
  played: boolean;
  player_id?: string;
};

export default function ActiveGame() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [radelci, setRadelci] = useState<Radelc[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showKlopModal, setShowKlopModal] = useState(false);
  const [playerHistory, setPlayerHistory] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scoreInputRef = useRef<TextInput>(null);

  // --- KLJUČNA SPREMEMBA: Uporaba useFocusEffect ---
  // To se zgodi vsakič, ko uporabnik pride na ta zaslon (tudi iz History)
  useFocusEffect(
    useCallback(() => {
      checkForActiveGame();
    }, [])
  );

  const checkForActiveGame = async () => {
    setLoading(true);
    try {
      // 1. Preveri v bazi, če obstaja aktivna igra
      const { data: activeGame } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (activeGame) {
        // ČE OBSTAJA: Naloži podatke in nastavi gameId
        setGameId(activeGame.id);
        await loadPlayers(activeGame.id);
        await loadRadelci(activeGame.id);
      } else {
        // ČE NE OBSTAJA: Nastavi gameId na null (prikazal se bo gumb "Začni")
        setGameId(null);
        setPlayers([]);
        setRadelci([]);
      }
    } catch (error) {
      console.error('Error checking active game:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ta funkcija se pokliče SAMO, ko uporabnik klikne "Začni novo igro"
  const handleStartNewGame = async () => {
    setLoading(true);
    try {
      const gameName = `${new Date().toLocaleDateString('sl-SI')} Tarok`;
      const { data: newGame, error } = await supabase
        .from('games')
        .insert({ name: gameName, is_active: true })
        .select()
        .single();

      if (error) throw error;
      
      // Takoj nastavimo ID, da se UI spremeni
      setGameId(newGame.id);
      // Pobrišemo prejšnje podatke (za vsak slučaj)
      setPlayers([]);
      setRadelci([]);
    } catch (error) {
      console.error('Error creating game:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (gId: string) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gId)
        .order('position');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const loadRadelci = async (gId: string) => {
    try {
      const { data, error } = await supabase
        .from('radelci')
        .select('*')
        .eq('game_id', gId)
        .order('position');

      if (error) throw error;
      setRadelci(data || []);
    } catch (error) {
      console.error('Error loading radelci:', error);
    }
  };

  const addPlayer = async () => {
    if (!gameId || players.length >= 7) return;

    try {
      const newPosition = players.length;
      const { data, error } = await supabase
        .from('players')
        .insert({
          game_id: gameId,
          name: '',
          position: newPosition,
        })
        .select()
        .single();

      if (error) throw error;
      setPlayers([...players, data]);
    } catch (error) {
      console.error('Error adding player:', error);
    }
  };

  const updatePlayerNameLocal = (playerId: string, newName: string) => {
    setPlayers(
      players.map((p) =>
        p.id === playerId ? { ...p, name: newName } : p
      )
    );
  };

  const updatePlayerNameDB = async (playerId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ name: newName.trim() })
        .eq('id', playerId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating player name:', error);
    }
  };

  const deletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      setPlayers(players.filter((p) => p.id !== playerId));
      setRadelci(radelci.filter((r) => r.player_id !== playerId));
    } catch (error) {
      console.error('Error deleting player:', error);
    }
  };

  const openScoreInput = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setScoreInput('');
    setShowScoreModal(true);
  };

  const toggleSign = () => {
    setScoreInput((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-')) {
        return prev.substring(1);
      }
      return '-' + prev;
    });
  };

  const submitScore = async () => {
    if (!selectedPlayerId || !gameId || !scoreInput) return;

    const points = parseInt(scoreInput, 10);
    if (isNaN(points)) return;

    try {
      const { error: insertError } = await supabase.from('score_entries').insert({
        player_id: selectedPlayerId,
        game_id: gameId,
        points: points,
      });

      if (insertError) throw insertError;

      const player = players.find((p) => p.id === selectedPlayerId);
      if (player) {
        const newScore = player.total_score + points;
        const { error: updateError } = await supabase
          .from('players')
          .update({ total_score: newScore })
          .eq('id', selectedPlayerId);

        if (updateError) throw updateError;

        setPlayers(
          players.map((p) =>
            p.id === selectedPlayerId ? { ...p, total_score: newScore } : p
          )
        );

        if (newScore === 0) {
          setShowKlopModal(true);
        }
      }

      setShowScoreModal(false);
      setScoreInput('');
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  const addGlobalRadelc = async () => {
    if (!gameId) return;

    try {
      const maxPosition =
        radelci.length > 0
          ? Math.max(...radelci.map((r) => r.position))
          : -1;

      const newRadelci = players.map((player, index) => ({
        game_id: gameId,
        player_id: player.id,
        is_used: false,
        position: maxPosition + 1,
      }));

      const { data, error } = await supabase
        .from('radelci')
        .insert(newRadelci)
        .select();

      if (error) throw error;
      setRadelci([...radelci, ...(data || [])]);
    } catch (error) {
      console.error('Error adding global radelc:', error);
    }
  };

  const toggleRadelc = async (radelcId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('radelci')
        .update({ is_used: !currentState })
        .eq('id', radelcId);

      if (error) throw error;
      setRadelci(
        radelci.map((r) =>
          r.id === radelcId ? { ...r, is_used: !currentState } : r
        )
      );
    } catch (error) {
      console.error('Error toggling radelc:', error);
    }
  };

  const loadPlayerHistory = async (playerId: string) => {
    try {
      const { data, error } = await supabase
        .from('score_entries')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at');

      if (error) throw error;

      setPlayerHistory(data || []);
      setSelectedPlayerId(playerId);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading player history:', error);
    }
  };

  const finishGame = async () => {
    try {
      if (gameId) {
        // Označi igro kot neaktivno v bazi
        await supabase
          .from('games')
          .update({ is_active: false })
          .eq('id', gameId);
      }

      // Resetiraj lokalno stanje na "ni igre"
      setGameId(null);
      setPlayers([]);
      setRadelci([]);
      setShowNewGameModal(false);
      // checkForActiveGame se bo avtomatsko sprožil, a ker smo is_active dali na false, bo ostal na "Začni novo igro"
    } catch (error) {
      console.error('Error finishing game:', error);
    }
  };

  const getPlayerRadelci = (playerId: string) => {
    return radelci.filter((r) => r.player_id === playerId);
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const playerRadelci = getPlayerRadelci(item.id);

    return (
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameContainer}>
            <TextInput
              style={styles.playerNameInput}
              value={item.name}
              onChangeText={(text) => updatePlayerNameLocal(item.id, text)}
              onBlur={() => updatePlayerNameDB(item.id, item.name)}
              placeholder="Vnesi ime"
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              onPress={() => loadPlayerHistory(item.id)}
              style={styles.infoButton}>
              <Info size={20} color="#4a9eff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deletePlayer(item.id)}
              style={styles.deleteButton}>
              <Trash2 size={20} color="#ff4a4a" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.scoreContainer}
          onPress={() => openScoreInput(item.id)}>
          <Text style={styles.scoreText}>{item.total_score}</Text>
          <Text style={styles.scoreTapHint}>Klikni za vnos</Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          style={styles.radelciContainer}
          showsHorizontalScrollIndicator={false}>
          {playerRadelci.map((radelc) => (
            <TouchableOpacity
              key={radelc.id}
              onPress={() => toggleRadelc(radelc.id, radelc.is_used)}>
              <View
                style={[
                  styles.radelc,
                  radelc.is_used ? styles.radelcUsed : styles.radelcUnused,
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // 1. Prikaz med nalaganjem (Checking for active game...)
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4a9eff" />
        <Text style={styles.loadingText}>Preverjam igre...</Text>
      </View>
    );
  }

  // 2. Prikaz ČE NI aktivne igre (Samo gumb Start)
  if (!gameId) {
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

  // 3. Prikaz ČE JE aktivna igra (Tvoj obstoječi UI)
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
          <Plus size={24} color="#fff" />
          <Text style={styles.addButtonText}>Dodaj igralca</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addRadelcButton}
          onPress={addGlobalRadelc}>
          <Plus size={24} color="#fff" />
          <Text style={styles.addButtonText}>Dodaj radelc vsem</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.finishGameButton}
          onPress={() => setShowNewGameModal(true)}>
          <RotateCcw size={24} color="#fff" />
          <Text style={styles.addButtonText}>Zaključi igro</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayer}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Dodaj igralce za začetek igre
          </Text>
        }
      />

      <Modal
        visible={showScoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScoreModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vnesi točke</Text>
            
            <View style={styles.inputRow}>
              <TouchableOpacity 
                style={styles.signButton} 
                onPress={toggleSign}
                activeOpacity={0.7}
              >
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

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowScoreModal(false)}>
                <Text style={styles.modalButtonText}>Prekliči</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitScore}>
                <Text style={styles.modalButtonText}>Potrdi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={styles.modalTitle}>Zgodovina točk</Text>
            <ScrollView style={styles.historyList}>
              {playerHistory.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Text style={styles.emptyHistoryText}>
                    Ni še nobenih vnosov točk
                  </Text>
                </View>
              ) : (
                playerHistory.map((entry, index) => {
                  let runningTotal = 0;
                  for (let i = 0; i <= index; i++) {
                    runningTotal += playerHistory[i].points;
                  }

                  return (
                    <View key={entry.id} style={styles.historyItem}>
                      <Text
                        style={[
                          styles.historyPoints,
                          entry.points > 0
                            ? styles.positivePoints
                            : styles.negativePoints,
                        ]}>
                        {entry.points > 0 ? '+' : ''}
                        {entry.points}
                      </Text>
                      <Text style={styles.historyTotal}>= {runningTotal}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(entry.created_at).toLocaleTimeString('sl-SI')}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHistoryModal(false)}>
              <Text style={styles.modalButtonText}>Zapri</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNewGameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Zaključi igro</Text>
            <Text style={styles.confirmText}>
              Ali želiš zaključiti trenutno igro? Igra bo shranjena v
              zgodovino in lahko začneš novo igro.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNewGameModal(false)}>
                <Text style={styles.modalButtonText}>Prekliči</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={finishGame}>
                <Text style={styles.modalButtonText}>Zaključi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showKlopModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKlopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.klopTitle}>Obvezen klop!</Text>
            <TouchableOpacity
              style={styles.klopButton}
              onPress={() => setShowKlopModal(false)}>
              <Text style={styles.modalButtonText}>Zapri</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  // Nov stil za centriranje vsebine (ko ni igre)
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#888',
    marginBottom: 40,
  },
  // Stil za VELIK gumb "Začni novo igro"
  bigStartButton: {
    backgroundColor: '#4a9eff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
    elevation: 5,
    shadowColor: '#4a9eff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bigStartButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  // --- Obstoječi stili ---
  header: {
    padding: 16,
    gap: 12,
  },
  addButton: {
    backgroundColor: '#4a9eff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addRadelcButton: {
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  finishGameButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmText: {
    color: '#ccc',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  playerCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  playerHeader: {
    marginBottom: 12,
  },
  playerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerNameInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  infoButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
  },
  scoreText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
  },
  scoreTapHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  radelciContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  radelc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  radelcUnused: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#4a9eff',
  },
  radelcUsed: {
    backgroundColor: '#000',
    borderWidth: 0,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  signButton: {
    backgroundColor: '#333',
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signButtonText: {
    color: '#4a9eff',
    fontSize: 20,
    fontWeight: '700',
  },
  scoreInputWrapper: {
    flex: 1,
    height: 60,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    justifyContent: 'center',
  },
  scoreInputField: {
    width: '100%',
    height: '100%',
    color: '#fff',
    fontSize: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  submitButton: {
    backgroundColor: '#4a9eff',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyModal: {
    height: '70%',
  },
  historyList: {
    flex: 1,
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  historyPoints: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  positivePoints: {
    color: '#22c55e',
  },
  negativePoints: {
    color: '#ef4444',
  },
  historyTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  historyDate: {
    color: '#666',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  closeButton: {
    backgroundColor: '#4a9eff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyHistoryContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  klopTitle: {
    color: '#ffd700',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
  },
  klopButton: {
    backgroundColor: '#4a9eff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
});
