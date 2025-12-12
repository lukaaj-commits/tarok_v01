import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Plus, Info, Trash2, RotateCcw } from 'lucide-react-native';

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

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (showScoreModal) {
      setTimeout(() => {
        scoreInputRef.current?.focus();
      }, 100);
    }
  }, [showScoreModal]);

  const initializeGame = async () => {
    try {
      const { data: activeGame } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (activeGame) {
        setGameId(activeGame.id);
        await loadPlayers(activeGame.id);
        await loadRadelci(activeGame.id);
      } else {
        await createNewGame();
      }
    } catch (error) {
      console.error('Error initializing game:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewGame = async () => {
    try {
      const gameName = `${new Date().toLocaleDateString('sl-SI')} Tarok`;
      const { data: newGame, error } = await supabase
        .from('games')
        .insert({ name: gameName, is_active: true })
        .select()
        .single();

      if (error) throw error;
      setGameId(newGame.id);
      return newGame.id;
    } catch (error) {
      console.error('Error creating game:', error);
      return null;
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
    if (players.length >= 7) return;

    try {
      let currentGameId = gameId;

      if (!currentGameId) {
        currentGameId = await createNewGame();
        if (!currentGameId) return;
      }

      const newPosition = players.length;
      const { data, error } = await supabase
        .from('players')
        .insert({
          game_id: currentGameId,
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

  // --- FUNKCIJA ZA PREKLOP MINUSA ---
  const toggleSign = () => {
    setScoreInput((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-')) {
        return prev.substring(1);
      }
      return '-' + prev;
    });
  };
  // ----------------------------------

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
        await supabase
          .from('games')
          .update({ is_active: false })
          .eq('id', gameId);
      }

      setGameId(null);
      setPlayers([]);
      setRadelci([]);
      setShowNewGameModal(false);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Nalaganje...</Text>
      </View>
    );
  }

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

        {players.length > 0 && (
          <TouchableOpacity
            style={styles.finishGameButton}
            onPress={() => setShowNewGameModal(true)}>
            <RotateCcw size={24} color="#fff" />
            <Text style={styles.addButtonText}>Zaključi igro</Text>
          </TouchableOpacity>
        )}
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
            
            {/* ZGORNJA VRSTICA (Input + Gumb) */}
            <View style={styles.inputRow}>
              <TouchableOpacity 
                style={styles.signButton} 
                onPress={toggleSign}
                activeOpacity={0.7}
              >
                <Text style={styles.signButtonText}>+/-</Text>
              </TouchableOpacity>
              
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

            {/* SPODNJA VRSTICA (Prekliči + Potrdi) */}
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
    marginTop: 40,
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
  // --- PORAVNANI STILI ---
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Razmak enak kot pri gumbih spodaj (12)
    marginBottom: 20,
    width: '100%', // Zagotovi polno širino
  },
  signButton: {
    backgroundColor: '#4a9eff',
    paddingHorizontal: 0, // Odstranil padding za fiksno širino
    borderRadius: 12,
    width: 60, // Fiksna širina
    height: 60, // Fiksna višina (enaka inputu)
    alignItems: 'center',
    justifyContent: 'center',
  },
  signButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  scoreInputField: {
    flex: 1, // Raztegni se do konca
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 24,
    padding: 0, // Reset padding
    height: 60, // Fiksna višina
    borderRadius: 12,
    textAlign: 'center',
    textAlignVertical: 'center', // Za Android poravnavo
  },
  // -----------------------
  modalButtons: {
    flexDirection: 'row',
    gap: 12, // Razmak enak zgornjemu
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
