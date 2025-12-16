import { useState, useEffect, useMemo } from 'react';
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
  Dimensions
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Trophy, Trash2, CheckCircle, Info, TrendingUp, Calendar } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';

type Game = { id: string; name: string; created_at: string; is_active: boolean; radelci_active: number; radelci_used: number; };
type GamePlayer = { id: string; name: string; total_score: number; position: number; };
type Radelc = { id: string; player_id: string; is_used: boolean; position: number; };
type ScoreEntry = { id: string; points: number; created_at: string; played: boolean; player_id?: string; };

type PlayerStats = { 
    name: string; 
    wins: number; 
    second: number; 
    third: number; 
    total_games: number; 
    recent_ranks: { rank: number, date: string, gameName: string }[]; 
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

  // Globalna statistika
  const [showGlobalStatsModal, setShowGlobalStatsModal] = useState(false);
  const [globalStats, setGlobalStats] = useState<PlayerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Podrobnosti igralca
  const [selectedGlobalPlayer, setSelectedGlobalPlayer] = useState<PlayerStats | null>(null);
  const [showGlobalPlayerModal, setShowGlobalPlayerModal] = useState(false);

  // Za izris grafa
  const [chartWidth, setChartWidth] = useState(0);

  const isFocused = useIsFocused();
  useEffect(() => { if (isFocused) loadGames(); }, [isFocused]);

  const loadGames = async () => {
    try {
      const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setGames(data || []);
    } catch (error) { console.error('Error loading games:', error); } finally { setLoading(false); }
  };

  const loadGameDetails = async (game: Game) => {
    try {
      const [playersResult, radelciResult] = await Promise.all([
        supabase.from('players').select('*').eq('game_id', game.id).order('total_score', { ascending: false }),
        supabase.from('radelci').select('*').eq('game_id', game.id).order('position'),
      ]);
      if (playersResult.error) throw playersResult.error;
      if (radelciResult.error) throw radelciResult.error;
      setGamePlayers(playersResult.data || []);
      setRadelci(radelciResult.data || []);
      setSelectedGame(game);
      setShowGameModal(true);
    } catch (error) { console.error('Error loading game details:', error); }
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
          const { error } = await supabase.from('games').update({ is_active: false }).eq('id', gameId);
          if (error) throw error;
          setShowGameModal(false); setSelectedGame(null); await loadGames();
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
      const { data, error } = await supabase.from('score_entries').select('*').in('player_id', playerIds).order('created_at');
      if (error) throw error;
      setPlayerHistory(data || []); setSelectedPlayerName('Vsi igralci'); setShowPlayerHistoryModal(true);
    } catch (error) { console.error(error); }
  };

  const loadGlobalStats = async () => {
    setStatsLoading(true);
    setShowGlobalStatsModal(true);
    try {
        const { data: finishedGames } = await supabase
            .from('games')
            .select('id, name, created_at')
            .eq('is_active', false)
            .order('created_at', { ascending: false });
            
        const gameIds = finishedGames?.map(g => g.id) || [];
        const gameMap = new Map<string, {date: string, name: string}>();
        finishedGames?.forEach(g => gameMap.set(g.id, {date: g.created_at, name: g.name}));

        if (gameIds.length === 0) { setGlobalStats([]); setStatsLoading(false); return; }

        const { data: allPlayers } = await supabase.from('players').select('name, game_id, total_score').in('game_id', gameIds);
        if (!allPlayers) { setGlobalStats([]); return; }

        const statsMap = new Map<string, PlayerStats>();
        const playersByGame = allPlayers.reduce((acc, p) => {
            if (!acc[p.game_id]) acc[p.game_id] = [];
            acc[p.game_id].push(p);
            return acc;
        }, {} as Record<string, typeof allPlayers>);

        Object.keys(playersByGame).forEach(gameId => {
            const gameP = playersByGame[gameId];
            gameP.sort((a, b) => b.total_score - a.total_score);
            const gameInfo = gameMap.get(gameId) || {date: '', name: ''};

            gameP.forEach((p) => {
                const name = p.name; 
                if (!statsMap.has(name)) {
                    statsMap.set(name, { name, wins: 0, second: 0, third: 0, total_games: 0, recent_ranks: [] });
                }
                const stat = statsMap.get(name)!;
                stat.total_games += 1;
                
                const myScore = p.total_score;
                const betterPlayers = gameP.filter(gp => gp.total_score > myScore).length;
                const myRank = betterPlayers + 1;

                if (myRank === 1) stat.wins += 1;
                if (myRank === 2) stat.second += 1;
                if (myRank === 3) stat.third += 1;

                stat.recent_ranks.push({ rank: myRank, date: gameInfo.date, gameName: gameInfo.name });
            });
        });

        const processedStats = Array.from(statsMap.values()).map(stat => {
            stat.recent_ranks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return stat;
        });

        const sortedStats = processedStats.sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.second !== a.second) return b.second - a.second;
            return b.third - a.third;
        });

        setGlobalStats(sortedStats);

    } catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  };

  const openGlobalPlayerDetails = (player: PlayerStats) => {
      setSelectedGlobalPlayer(player);
      setShowGlobalPlayerModal(true);
  };

  const getFormStatus = (ranks: { rank: number }[]) => {
      if (ranks.length === 0) return { text: '-', color: '#666', icon: '➖' };
      const last5 = ranks.slice(0, 5);
      const wins = last5.filter(r => r.rank === 1).length;
      const sum = last5.reduce((acc, curr) => acc + curr.rank, 0);
      const avg = sum / last5.length;

      if (wins >= 3) return { text: 'Vroče', color: '#ff4500', icon: '🔥' };
      if (avg <= 3.0) return { text: 'Odlična', color: '#22c55e', icon: '🚀' };
      if (avg <= 5.0) return { text: 'Srednja', color: '#fbbf24', icon: '😐' };
      return { text: 'Hladna', color: '#94a3b8', icon: '❄️' };
  };

  const getPlayerRadelci = (playerId: string) => radelci.filter((r) => r.player_id === playerId);

  const renderGame = ({ item }: { item: Game }) => (
      <TouchableOpacity style={styles.gameCard} onPress={() => loadGameDetails(item)}>
        <View style={styles.gameHeader}>
          <Text style={styles.gameName}>{item.name}</Text>
          {item.is_active && (<View style={styles.activeBadge}><Text style={styles.activeBadgeText}>AKTIVNA</Text></View>)}
        </View>
        <View style={styles.gameFooter}>
          <Text style={styles.gameDate}>{new Date(item.created_at).toLocaleString('sl-SI')}</Text>
          <ChevronRight size={20} color="#4a9eff" />
        </View>
      </TouchableOpacity>
  );

  // --- KOMPONENTA ZA IZRIS ČRTE (Line Segment) ---
  const Line = ({ x1, y1, x2, y2, color }: { x1: number, y1: number, x2: number, y2: number, color: string }) => {
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      
      return (
          <View style={{
              position: 'absolute',
              left: (x1 + x2) / 2 - length / 2,
              top: (y1 + y2) / 2 - 1, // debelina črte / 2
              width: length,
              height: 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }]
          }} />
      );
  };

  if (loading) return (<View style={styles.container}><Text style={styles.loadingText}>Nalaganje...</Text></View>);

  return (
    <View style={styles.container}>
      <View style={styles.mainHeader}>
          <Text style={styles.headerTitle}>Zgodovina iger</Text>
          <TouchableOpacity style={styles.globalStatsButton} onPress={loadGlobalStats}>
              <Trophy size={22} color="#fff" />
          </TouchableOpacity>
      </View>

      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Ni še nobene igre</Text></View>}
      />

      {/* --- MODAL: VEČNA LESTVICA --- */}
      <Modal visible={showGlobalStatsModal} transparent animationType="slide" onRequestClose={() => setShowGlobalStatsModal(false)}>
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.historyModal]}>
                <Text style={styles.modalTitle}>Večna lestvica 🏆</Text>
                <Text style={styles.subTitle}>(Klikni na igralca za podrobnosti)</Text>
                
                {statsLoading ? (
                    <ActivityIndicator size="large" color="#4a9eff" style={{marginTop: 20}} />
                ) : (
                    <ScrollView style={styles.historyList}>
                        {globalStats.map((stat, index) => {
                            const rank = globalStats.findIndex(s => 
                                s.wins === stat.wins && 
                                s.second === stat.second && 
                                s.third === stat.third
                            ) + 1;

                            return (
                                <TouchableOpacity key={stat.name} style={styles.leaderboardItem} onPress={() => openGlobalPlayerDetails(stat)}>
                                    <View style={{width: 30, alignItems: 'center'}}>
                                        {rank === 1 ? <Trophy size={18} color="#ffd700" /> :
                                         rank === 2 ? <Trophy size={18} color="#c0c0c0" /> :
                                         rank === 3 ? <Trophy size={18} color="#cd7f32" /> :
                                         <Text style={styles.rankText}>{rank}.</Text>
                                        }
                                    </View>
                                    <View style={{flex: 1, paddingLeft: 8}}>
                                        <Text style={styles.leaderboardName}>{stat.name}</Text>
                                        <Text style={{color: '#666', fontSize: 12}}>{stat.total_games} iger</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', gap: 6}}>
                                        <View style={styles.medalBox}><Trophy size={14} color="#ffd700" /><Text style={styles.medalText}>{stat.wins}</Text></View>
                                        <View style={styles.medalBox}><Trophy size={14} color="#c0c0c0" /><Text style={styles.medalText}>{stat.second}</Text></View>
                                        <View style={styles.medalBox}><Trophy size={14} color="#cd7f32" /><Text style={styles.medalText}>{stat.third}</Text></View>
                                        <ChevronRight size={16} color="#666" style={{marginLeft: 4}} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowGlobalStatsModal(false)}>
                    <Text style={styles.closeButtonText}>Zapri</Text>
                </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* --- MODAL S PODROBNOSTMI IGRALCA (Graf + Forma) --- */}
      <Modal visible={showGlobalPlayerModal} transparent animationType="slide" onRequestClose={() => setShowGlobalPlayerModal(false)}>
         <View style={styles.modalOverlay}>
             <View style={[styles.modalContent, styles.historyModal]}>
                {selectedGlobalPlayer && (
                    <>
                        <View style={styles.detailHeader}>
                            <Text style={styles.modalTitle}>{selectedGlobalPlayer.name}</Text>
                        </View>

                        <ScrollView style={styles.detailScroll}>
                            {/* FORMA */}
                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>Trenutna forma</Text>
                                {(() => {
                                    const form = getFormStatus(selectedGlobalPlayer.recent_ranks);
                                    return (
                                        <View style={styles.formCard}>
                                            <Text style={{fontSize: 40}}>{form.icon}</Text>
                                            <Text style={[styles.formText, {color: form.color}]}>{form.text}</Text>
                                            <Text style={styles.formSubText}>
                                                {selectedGlobalPlayer.recent_ranks.slice(0, 5).length} iger v analizi
                                            </Text>
                                        </View>
                                    );
                                })()}
                            </View>

                            {/* ČRTNI GRAF (Line Chart) */}
                            <View style={styles.chartSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:20}}>
                                    <TrendingUp size={20} color="#4a9eff" style={{marginRight:8}} />
                                    <Text style={styles.sectionTitle}>Gibanje uvrstitev (Zadnjih 10)</Text>
                                </View>
                                
                                <View 
                                    style={styles.chartContainer}
                                    onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
                                >
                                    {/* Mreža ozadja (Grid Lines) */}
                                    <View style={[styles.gridLine, {top: 0}]}><Text style={styles.gridLabel}>1.</Text></View>
                                    <View style={[styles.gridLine, {top: '50%'}]}><Text style={styles.gridLabel}>5.</Text></View>
                                    <View style={[styles.gridLine, {top: '100%'}]}><Text style={styles.gridLabel}>10.</Text></View>

                                    {/* Izris točk in črt */}
                                    {(() => {
                                        if (chartWidth === 0) return null;
                                        
                                        const data = selectedGlobalPlayer.recent_ranks.slice(0, 10).reverse();
                                        const chartHeight = 150;
                                        const totalPoints = data.length;
                                        // Če je samo ena točka, jo prikažemo na sredini
                                        const stepX = totalPoints > 1 ? chartWidth / (totalPoints - 1) : chartWidth / 2;
                                        
                                        // Priprava koordinat
                                        const points = data.map((r, i) => {
                                            // Y: 1. mesto = 0 (zgoraj), 10. mesto = height (spodaj)
                                            // Omejimo na max 10. mesto za graf
                                            const cappedRank = Math.min(r.rank, 10);
                                            const y = ((cappedRank - 1) / 9) * chartHeight; 
                                            const x = totalPoints > 1 ? i * stepX : chartWidth / 2;
                                            return { x, y, rank: r.rank };
                                        });

                                        return (
                                            <View style={{ width: '100%', height: '100%' }}>
                                                {/* Črte */}
                                                {points.map((p, i) => {
                                                    if (i === points.length - 1) return null;
                                                    const nextP = points[i+1];
                                                    return (
                                                        <Line key={`line-${i}`} x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y} color="#4a9eff" />
                                                    );
                                                })}
                                                {/* Točke */}
                                                {points.map((p, i) => {
                                                    let dotColor = '#fff';
                                                    if (p.rank === 1) dotColor = '#ffd700';
                                                    else if (p.rank === 2) dotColor = '#c0c0c0';
                                                    else if (p.rank === 3) dotColor = '#cd7f32';

                                                    return (
                                                        <View key={`dot-${i}`} style={{
                                                            position: 'absolute',
                                                            left: p.x - 5,
                                                            top: p.y - 5,
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: 5,
                                                            backgroundColor: '#1a1a1a',
                                                            borderWidth: 2,
                                                            borderColor: dotColor,
                                                            zIndex: 10
                                                        }} />
                                                    );
                                                })}
                                            </View>
                                        );
                                    })()}
                                </View>
                                
                                <View style={styles.chartXAxis}>
                                    <Text style={styles.axisLabel}>Starejše</Text>
                                    <Text style={styles.axisLabel}>Novejše</Text>
                                </View>
                            </View>

                            {/* ZADNJIH 5 IGER - POPRAVEK TEXTA */}
                            <View style={styles.lastGamesSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                    <Calendar size={20} color="#4a9eff" style={{marginRight:8}} />
                                    <Text style={styles.sectionTitle}>Zadnjih 5 iger</Text>
                                </View>
                                {selectedGlobalPlayer.recent_ranks.slice(0, 5).map((r, i) => (
                                    <View key={i} style={styles.rankRow}>
                                        <Text style={styles.rankRowDate}>{new Date(r.date).toLocaleDateString('sl-SI')}</Text>
                                        
                                        {/* Popravek: Dodana logika za barvo roba/ozadja in BEL TEKST */}
                                        <View style={[
                                            styles.rankBadge, 
                                            r.rank === 1 && {borderColor: '#ffd700', borderWidth: 1},
                                            r.rank === 2 && {borderColor: '#c0c0c0', borderWidth: 1},
                                            r.rank === 3 && {borderColor: '#cd7f32', borderWidth: 1}
                                        ]}>
                                            <Text style={styles.rankBadgeText}>
                                                {r.rank}. mesto
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowGlobalPlayerModal(false)}>
                            <Text style={styles.closeButtonText}>Zapri</Text>
                        </TouchableOpacity>
                    </>
                )}
             </View>
         </View>
      </Modal>

      {/* --- OSTALI MODALI (Igra, Zgodovina igralca) --- */}
      <Modal visible={showGameModal} transparent animationType="slide" onRequestClose={() => setShowGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedGame?.name || 'Igra'}</Text>
              <TouchableOpacity style={styles.headerInfoButton} onPress={() => loadAllPlayersHistory()}>
                <Info size={24} color="#4a9eff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.playersListContainer}>
              {gamePlayers.map((player, index, array) => {
                const playerRadelci = getPlayerRadelci(player.id);
                const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                return (
                  <View key={player.id} style={styles.playerRowContainer}>
                    <View style={styles.rankContainer}>
                      {rank === 1 && <Trophy size={20} color="#ffd700" />}
                      {rank === 2 && <Trophy size={20} color="#c0c0c0" />}
                      {rank === 3 && <Trophy size={20} color="#cd7f32" />}
                      {rank > 3 && (<Text style={styles.rankNumber}>{rank}</Text>)}
                    </View>
                    <Text style={styles.playerName}>{player.name || `Igralec ${player.position + 1}`}</Text>
                    {playerRadelci.length > 0 && (<View style={styles.radelciContainer}>{playerRadelci.map((radelc) => (<View key={radelc.id} style={[styles.radelc, radelc.is_used ? styles.radelcUsed : styles.radelcUnused]} />))}</View>)}
                    <Text style={[styles.playerScore, player.total_score > 0 ? styles.positiveScore : player.total_score < 0 ? styles.negativeScore : styles.neutralScore]}>{player.total_score}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.modalButtons}>
              {selectedGame?.is_active ? (
                <>
                  <TouchableOpacity style={styles.endGameButton} onPress={() => endGame(selectedGame.id)}><CheckCircle size={18} color="#fff" /><Text style={styles.buttonText}>Zaključi</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.deleteButton, styles.deleteButtonFlex]} onPress={() => deleteGame(selectedGame.id)}><Trash2 size={18} color="#fff" /><Text style={styles.deleteButtonText}>Izbriši</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.closeButton, styles.closeButtonFlex]} onPress={() => setShowGameModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  {selectedGame && (<TouchableOpacity style={[styles.deleteButton, styles.deleteButtonFlex]} onPress={() => deleteGame(selectedGame.id)}><Trash2 size={18} color="#fff" /><Text style={styles.deleteButtonText}>Izbriši</Text></TouchableOpacity>)}
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
            <ScrollView style={styles.historyList}>
              {gamePlayers.sort((a, b) => b.total_score - a.total_score).map((player, playerIndex, array) => {
                  const playerEntries = playerHistory.filter((e) => e.player_id === player.id);
                  const playerName = player.name || `Igralec ${player.position + 1}`;
                  if (playerEntries.length === 0) return null;
                  const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={styles.playerHistoryHeader}>
                        <View style={styles.playerRankBadge}>
                          {rank === 1 && <Trophy size={16} color="#ffd700" />}
                          {rank === 2 && <Trophy size={16} color="#c0c0c0" />}
                          {rank === 3 && <Trophy size={16} color="#cd7f32" />}
                          {rank > 3 && (<Text style={styles.playerRankText}>{rank}</Text>)}
                        </View>
                        <Text style={styles.playerHistorySectionTitle}>{playerName}</Text>
                        <Text style={[styles.playerTotalScore, player.total_score > 0 ? styles.positivePoints : player.total_score < 0 ? styles.negativePoints : styles.neutralScore]}>{player.total_score}</Text>
                      </View>
                      {playerEntries.map((entry, index) => {
                        let runningTotal = 0;
                        for (let i = 0; i <= index; i++) { runningTotal += playerEntries[i].points; }
                        return (
                          <View key={entry.id} style={styles.historyItem}>
                             <View style={styles.pointsWrapper}>
                                <View style={styles.fixedPointsBox}>
                                    <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>{entry.points > 0 ? '+' : ''}{entry.points}</Text>
                                </View>
                                <View style={styles.dotBox}>
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
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowPlayerHistoryModal(false)}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  mainHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
  },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#fff' },
  globalStatsButton: {
      backgroundColor: '#333',
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#444'
  },
  subTitle: { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 15 },
  listContainer: { padding: 16, gap: 12 },
  gameCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  gameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  gameName: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },
  activeBadge: { backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  gameFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  gameDate: { color: '#666', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: '#666', fontSize: 18, marginBottom: 8 },
  loadingText: { color: '#fff', fontSize: 18, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 12 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  headerInfoButton: { padding: 4 },
  playersListContainer: { marginBottom: 20 },
  playerRowContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 12, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rankContainer: { width: 32, alignItems: 'center' },
  rankNumber: { color: '#666', fontSize: 16, fontWeight: '600' },
  playerName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500', marginLeft: 8 },
  playerScore: { fontSize: 20, fontWeight: '700' },
  positiveScore: { color: '#22c55e' },
  negativeScore: { color: '#ef4444' },
  neutralScore: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  endGameButton: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, flex: 1 },
  deleteButton: { backgroundColor: '#ef4444', padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, flex: 1 },
  deleteButtonFlex: { flex: 1 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { backgroundColor: '#4a9eff', padding: 16, borderRadius: 12, alignItems: 'center' },
  closeButtonFlex: { flex: 1 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  radelciContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  radelc: { width: 14, height: 14, borderRadius: 7 },
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#4a9eff' },
  radelcUsed: { backgroundColor: '#000', borderWidth: 0 },
  historyModal: { height: '85%', maxHeight: '85%' }, 
  historyList: { flex: 1, marginBottom: 16 },
  playerHistorySection: { marginBottom: 24 },
  playerHistoryHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: '#666', fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600' },
  playerTotalScore: { fontSize: 22, fontWeight: '700' },
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8 },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  fixedPointsBox: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotBox: { width: 20, alignItems: 'flex-start' },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: '#22c55e' },
  negativePoints: { color: '#ef4444' },
  historyTotal: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: '#666', fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffd700' },
  
  // LEADERBOARD & DETAIL STYLES
  leaderboardItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingVertical: 14, 
      paddingHorizontal: 16, 
      backgroundColor: '#2a2a2a', 
      borderRadius: 10, 
      marginBottom: 10, 
  },
  leaderboardName: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },
  medalBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  medalText: { color: '#fff', fontWeight: '700', marginLeft: 2, fontSize: 12 },
  
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailScroll: { flex: 1, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  
  formSection: { marginBottom: 24, alignItems: 'center' },
  formCard: { backgroundColor: '#2a2a2a', width: '100%', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  formText: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  formSubText: { color: '#666', marginTop: 4 },

  chartSection: { marginBottom: 24, backgroundColor: '#222', padding: 16, borderRadius: 16 },
  chartContainer: { height: 170, paddingBottom: 10, marginTop: 10 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { color: '#666', fontSize: 10 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#333', justifyContent: 'center' },
  gridLabel: { color: '#444', fontSize: 10, position: 'absolute', left: 0, top: -15 },

  lastGamesSection: { marginBottom: 20 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  rankRowDate: { color: '#888', fontSize: 14 },
  rankBadge: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  rankBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' }, // VEDNO BELA
});
