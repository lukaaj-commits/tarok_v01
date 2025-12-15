import { useState, useEffect } from 'react';
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
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Trophy, Trash2, CheckCircle, Info } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';

type Game = {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  radelci_active: number;
  radelci_used: number;
};

type GamePlayer = {
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
  played: boolean; // Pomembno za rumeno piko
  player_id?: string;
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
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadGames();
    }
  }, [isFocused]);

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGameDetails = async (game: Game) => {
    try {
      const [playersResult, radelciResult] = await Promise.all([
        supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id)
          .order('total_score', { ascending: false }),
        supabase
          .from('radelci')
          .select('*')
          .eq('game_id', game.id)
          .order('position'),
      ]);

      if (playersResult.error) throw playersResult.error;
      if (radelciResult.error) throw radelciResult.error;

      setGamePlayers(playersResult.data || []);
      setRadelci(radelciResult.data || []);
      setSelectedGame(game);
      setShowGameModal(true);
    } catch (error) {
      console.error('Error loading game details:', error);
    }
  };

  const endGame = async (gameId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Ali želiš zaključiti to igro?');
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Zaključi igro',
        'Ali želiš zaključiti to igro?',
        [
          { text: 'Prekliči', style: 'cancel' },
          {
            text: 'Zaključi',
            onPress: async () => {
              await performEndGame(gameId);
            },
          },
        ]
      );
      return;
    }
    await performEndGame(gameId);
  };

  const performEndGame = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ is_active: false })
        .eq('id', gameId);

      if (error) throw error;

      setShowGameModal(false);
      setSelectedGame(null);
      await loadGames();
    } catch (error) {
      console.error('Error ending game:', error);
      if (Platform.OS === 'web') {
        window.alert('Napaka: Igre ni bilo mogoče zaključiti');
      } else {
        Alert.alert('Napaka', 'Igre ni bilo mogoče zaključiti');
      }
    }
  };

  const deleteGame = async (gameId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Ali si prepričan, da želiš izbrisati to igro? Tega dejanja ne moreš razveljaviti.'
      );
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Izbriši igro',
        'Ali si prepričan, da želiš izbrisati to igro? Tega dejanja ne moreš razveljaviti.',
        [
          { text: 'Prekliči', style: 'cancel' },
          {
            text: 'Izbriši',
            style: 'destructive',
            onPress: async () => {
              await performDeleteGame(gameId);
            },
          },
        ]
      );
      return;
    }
    await performDeleteGame(gameId);
  };

  const performDeleteGame = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      setShowGameModal(false);
      setSelectedGame(null);
      await loadGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      if (Platform.OS === 'web') {
        window.alert('Napaka: Igre ni bilo mogoče izbrisati');
      } else {
        Alert.alert('Napaka', 'Igre ni bilo mogoče izbrisati');
      }
    }
  };

  const loadAllPlayersHistory = async () => {
    if (!selectedGame) return;

    try {
      const playerIds = gamePlayers.map((p) => p.id);
      const { data, error } = await supabase
        .from('score_entries')
        .select('*')
        .in('player_id', playerIds)
        .order('created_at');

      if (error) throw error;
      setPlayerHistory(data || []);
      setSelectedPlayerName('Vsi igralci');
      setShowPlayerHistoryModal(true);
    } catch (error) {
      console.error('Error loading all players history:', error);
    }
  };

  const getPlayerRadelci = (playerId: string) => {
    return radelci.filter((r) => r.player_id === playerId);
  };

  const renderGame = ({ item }: { item: Game }) => {
    return (
      <TouchableOpacity
        style={styles.gameCard}
        onPress={() => loadGameDetails(item)}>
        <View style={styles.gameHeader}>
          <Text style={styles.gameName}>{item.name}</Text>
          {item.is_active && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>AKTIVNA</Text>
            </View>
          )}
        </View>
        <View style={styles.gameFooter}>
          <Text style={styles.gameDate}>
            {new Date(item.created_at).toLocaleString('sl-SI')}
          </Text>
          <ChevronRight size={20} color="#4a9eff" />
        </View>
      </TouchableOpacity>
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
      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Ni še nobene igre</Text>
            <Text style={styles.emptySubtext}>
              Začni novo igro v zavihku "Aktivna Igra"
            </Text>
          </View>
        }
      />

      {/* --- MODAL ZA PODROBNOSTI IGRE --- */}
      <Modal
        visible={showGameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedGame?.name || 'Igra'}
              </Text>
              <TouchableOpacity
                style={styles.headerInfoButton}
                onPress={() => loadAllPlayersHistory()}>
                <Info size={24} color="#4a9eff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.playersListContainer}>
              {gamePlayers.map((player, index, array) => {
                const playerRadelci = getPlayerRadelci(player.id);
                
                // --- LOGIKA ZA ŠPORTNO RAZVRŠČANJE (1, 2, 2, 4...) ---
                const rank = array.findIndex(p => p.total_score === player.total_score) + 1;

                return (
                  <View key={player.id} style={styles.playerRowContainer}>
                    <View style={styles.rankContainer}>
                      {rank === 1 && <Trophy size={20} color="#ffd700" />}
                      {rank === 2 && <Trophy size={20} color="#c0c0c0" />}
                      {rank === 3 && <Trophy size={20} color="#cd7f32" />}
                      {rank > 3 && (
                        <Text style={styles.rankNumber}>{rank}</Text>
                      )}
                    </View>
                    <Text style={styles.playerName}>
                      {player.name || `Igralec ${player.position + 1}`}
                    </Text>
                    {playerRadelci.length > 0 && (
                      <View style={styles.radelciContainer}>
                        {playerRadelci.map((radelc) => (
                          <View
                            key={radelc.id}
                            style={[
                              styles.radelc,
                              radelc.is_used
                                ? styles.radelcUsed
                                : styles.radelcUnused,
                            ]}
                          />
                        ))}
                      </View>
                    )}
                    <Text
                      style={[
                        styles.playerScore,
                        player.total_score > 0
                          ? styles.positiveScore
                          : player.total_score < 0
                            ? styles.negativeScore
                            : styles.neutralScore,
                      ]}>
                      {player.total_score}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalButtons}>
              {selectedGame?.is_active ? (
                <>
                  <TouchableOpacity
                    style={styles.endGameButton}
                    onPress={() => endGame(selectedGame.id)}>
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.buttonText}>Zaključi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteButton, styles.deleteButtonFlex]}
                    onPress={() => deleteGame(selectedGame.id)}>
                    <Trash2 size={18} color="#fff" />
                    <Text style={styles.deleteButtonText}>Izbriši</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.closeButton, styles.closeButtonFlex]}
                    onPress={() => setShowGameModal(false)}>
                    <Text style={styles.closeButtonText}>Zapri</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {selectedGame && (
                    <TouchableOpacity
                      style={[styles.deleteButton, styles.deleteButtonFlex]}
                      onPress={() => deleteGame(selectedGame.id)}>
                      <Trash2 size={18} color="#fff" />
                      <Text style={styles.deleteButtonText}>Izbriši</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.closeButton, styles.closeButtonFlex]}
                    onPress={() => setShowGameModal(false)}>
                    <Text style={styles.closeButtonText}>Zapri</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODAL ZA ZGODOVINO TOČK --- */}
      <Modal
        visible={showPlayerHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlayerHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.historyModal]}>
            <Text style={styles.modalTitle}>
              {selectedPlayerName} - Zgodovina točk
            </Text>
            <ScrollView style={styles.historyList}>
              {gamePlayers
                // Tudi tukaj potrebujemo razvrščanje
                .sort((a, b) => b.total_score - a.total_score)
                .map((player, playerIndex, array) => {
                  const playerEntries = playerHistory.filter(
                    (e) => e.player_id === player.id
                  );
                  const playerName = player.name || `Igralec ${player.position + 1}`;

                  if (playerEntries.length === 0) return null;

                  // --- LOGIKA ZA ŠPORTNO RAZVRŠČANJE ---
                  const rank = array.findIndex(p => p.total_score === player.total_score) + 1;

                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={styles.playerHistoryHeader}>
                        <View style={styles.playerRankBadge}>
                          {rank === 1 && <Trophy size={16} color="#ffd700" />}
                          {rank === 2 && <Trophy size={16} color="#c0c0c0" />}
                          {rank === 3 && <Trophy size={16} color="#cd7f32" />}
                          {rank > 3 && (
                            <Text style={styles.playerRankText}>{rank}</Text>
                          )}
                        </View>
                        <Text style={styles.playerHistorySectionTitle}>
                          {playerName}
                        </Text>
                        <Text
                          style={[
                            styles.playerTotalScore,
                            player.total_score > 0
                              ? styles.positivePoints
                              : player.total_score < 0
                                ? styles.negativePoints
                                : styles.neutralScore,
                          ]}>
                          {player.total_score}
                        </Text>
                      </View>

                      {playerEntries.map((entry, index) => {
                        let runningTotal = 0;
                        for (let i = 0; i <= index; i++) {
                          runningTotal += playerEntries[i].points;
                        }

                        return (
                          <View key={entry.id} style={styles.historyItem}>
                            {/* --- POPRAVLJENO: PORAVNAVA IN RUMENA PIKA --- */}
                            <View style={styles.pointsWrapper}>
                                <View style={styles.fixedPointsBox}>
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
                                </View>
                                <View style={styles.dotBox}>
                                    {entry.played && <View style={styles.playedDot} />}
                                </View>
                            </View>
                            {/* --------------------------------------------- */}

                            <Text style={styles.historyTotal}>= {runningTotal}</Text>
                            <Text style={styles.historyDate}>
                              {new Date(entry.created_at).toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPlayerHistoryModal(false)}>
              <Text style={styles.closeButtonText}>Zapri</Text>
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
  listContainer: {
    padding: 16,
    gap: 12,
  },
  gameCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gameName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  gameFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gameDate: {
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerInfoButton: {
    padding: 4,
  },
  playersListContainer: {
    marginBottom: 20,
  },
  playerRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  playerName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  playerScore: {
    fontSize: 20,
    fontWeight: '700',
  },
  positiveScore: {
    color: '#22c55e',
  },
  negativeScore: {
    color: '#ef4444',
  },
  neutralScore: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  endGameButton: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  deleteButtonFlex: {
    flex: 1,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#4a9eff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonFlex: {
    flex: 1,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  radelciContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radelc: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  radelcUnused: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4a9eff',
  },
  radelcUsed: {
    backgroundColor: '#000',
    borderWidth: 0,
  },
  infoButton: {
    padding: 8,
    marginLeft: 8,
  },
  historyModal: {
    height: '70%',
    maxHeight: '70%',
  },
  historyList: {
    flex: 1,
    marginBottom: 16,
  },
  playerHistorySection: {
    marginBottom: 24,
  },
  playerHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  playerRankBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerRankText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },
  playerHistorySectionTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  playerTotalScore: {
    fontSize: 22,
    fontWeight: '700',
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
  // --- POSODOBLJENI STILI ZA PORAVNAVO ---
  pointsWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    justifyContent: 'center' 
  },
  fixedPointsBox: {
    width: 60,        // Fiksna širina za točke
    alignItems: 'flex-end',
    paddingRight: 5
  },
  dotBox: {
    width: 20,        // Prostor za piko
    alignItems: 'flex-start'
  },
  // ---------------------------------------
  
  historyPoints: {
    fontSize: 20,
    fontWeight: '700',
  },
  positivePoints: {
    color: '#22c55e',
  },
  negativePoints: {
    color: '#ef4444',
  },
  neutralScore: {
    color: '#fff',
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
  // --- STIL RUMENE PIKE ---
  playedDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#ffd700' 
  },
});
