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
  ActivityIndicator
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Trophy, Trash2, CheckCircle, Info, TrendingUp, Calendar, Clock, BarChart3 } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient'; 

// --- TIPOVI (NESPREMENJENO) ---
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

  const [showGlobalStatsModal, setShowGlobalStatsModal] = useState(false);
  const [globalStats, setGlobalStats] = useState<PlayerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [selectedGlobalPlayer, setSelectedGlobalPlayer] = useState<PlayerStats | null>(null);
  const [showGlobalPlayerModal, setShowGlobalPlayerModal] = useState(false);
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
        const { data: finishedGames } = await supabase.from('games').select('id, name, created_at').eq('is_active', false).order('created_at', { ascending: false });
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
                if (!statsMap.has(name)) { statsMap.set(name, { name, wins: 0, second: 0, third: 0, total_games: 0, recent_ranks: [] }); }
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
    } catch (e) { console.error(e); } finally { setStatsLoading(false); }
  };

  const openGlobalPlayerDetails = (player: PlayerStats) => { setSelectedGlobalPlayer(player); setShowGlobalPlayerModal(true); };

  const getFormStatus = (ranks: { rank: number }[]) => {
      if (ranks.length === 0) return { text: '-', color: '#666', icon: '➖' };
      const last5 = ranks.slice(0, 5);
      const wins = last5.filter(r => r.rank === 1).length;
      let totalScore = 0;
      last5.forEach(r => { if (r.rank === 1) totalScore += 10; else if (r.rank === 2) totalScore += 5; else if (r.rank === 3) totalScore += 2; });
      const avgScore = totalScore / last5.length;

      if (wins >= 3) return { text: 'Vroče', color: '#ff4500', icon: '🔥' };
      if (avgScore >= 3.5) return { text: 'Odlična', color: '#22c55e', icon: '🚀' };
      if (avgScore >= 1.5) return { text: 'Srednja', color: '#fbbf24', icon: '😐' };
      return { text: 'Hladna', color: '#94a3b8', icon: '❄️' };
  };

  const getPlayerRadelci = (playerId: string) => radelci.filter((r) => r.player_id === playerId);

  const Line = ({ x1, y1, x2, y2, color }: { x1: number, y1: number, x2: number, y2: number, color: string }) => {
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      return <View style={{ position: 'absolute', left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - 1, width: length, height: 2, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />;
  };

  const renderGame = ({ item }: { item: Game }) => (
      <TouchableOpacity activeOpacity={0.7} onPress={() => loadGameDetails(item)} style={styles.cardWrapper}>
        <LinearGradient
            colors={item.is_active ? ['#172554', '#0f0f0f'] : ['#252525', '#171717']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.gameCard}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, item.is_active && {backgroundColor: 'rgba(59, 130, 246, 0.2)'}]}>
                    <Calendar size={18} color={item.is_active ? '#60a5fa' : '#888'} />
                </View>
                <View style={{flex: 1}}>
                    <Text style={[styles.gameName, item.is_active && {color: '#93c5fd'}]}>{item.name}</Text>
                    <Text style={styles.gameDate}>{new Date(item.created_at).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {item.is_active && (
                    <View style={styles.activeBadge}>
                        <Clock size={12} color="#fff" style={{marginRight: 4}}/>
                        <Text style={styles.activeBadgeText}>V TEKU</Text>
                    </View>
                )}
            </View>
        </LinearGradient>
      </TouchableOpacity>
  );

  if (loading) return (<View style={styles.container}><ActivityIndicator size="large" color="#4a9eff" /></View>);

  return (
    <View style={styles.container}>
      <View style={styles.mainHeader}>
          <View>
              <Text style={styles.headerTitle}>Zgodovina</Text>
              {/* POPRAVEK: Večji razmak in spremenjen tekst */}
              <Text style={styles.headerSubtitle}>Pregled vseh bitk</Text>
          </View>
          <TouchableOpacity style={styles.globalStatsButton} onPress={loadGlobalStats}>
              <BarChart3 size={24} color="#fff" />
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
      <Modal visible={showGlobalStatsModal} transparent animationType="fade" onRequestClose={() => setShowGlobalStatsModal(false)}>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeaderBar}>
                    <Text style={styles.modalTitle}>Večna lestvica 🏆</Text>
                    <TouchableOpacity onPress={() => setShowGlobalStatsModal(false)}><Text style={styles.closeText}>Zapri</Text></TouchableOpacity>
                </View>
                
                {statsLoading ? (
                    <ActivityIndicator size="large" color="#4a9eff" style={{marginTop: 40}} />
                ) : (
                    <ScrollView style={styles.historyList}>
                        {globalStats.map((stat, index) => {
                            const rank = globalStats.findIndex(s => s.wins === stat.wins && s.second === stat.second && s.third === stat.third) + 1;
                            return (
                                <TouchableOpacity key={stat.name} style={styles.leaderboardItem} onPress={() => openGlobalPlayerDetails(stat)}>
                                    <View style={styles.rankBox}>
                                        {/* POPRAVEK: Večji pokali (size 24) */}
                                        {rank === 1 ? <Trophy size={24} color="#ffd700" /> :
                                         rank === 2 ? <Trophy size={24} color="#c0c0c0" /> :
                                         rank === 3 ? <Trophy size={24} color="#cd7f32" /> :
                                         <Text style={styles.rankText}>{rank}</Text>
                                        }
                                    </View>
                                    <View style={styles.leaderboardInfo}>
                                        <Text style={styles.leaderboardName}>{stat.name}</Text>
                                        <Text style={styles.leaderboardSub}>{stat.total_games} iger</Text>
                                    </View>
                                    <View style={styles.medalRow}>
                                        <View style={[styles.medalTag, {borderColor: '#ffd70033'}]}><Text style={[styles.medalText, {color: '#ffd700'}]}>{stat.wins}</Text></View>
                                        <View style={[styles.medalTag, {borderColor: '#c0c0c033'}]}><Text style={[styles.medalText, {color: '#c0c0c0'}]}>{stat.second}</Text></View>
                                        <View style={[styles.medalTag, {borderColor: '#cd7f3233'}]}><Text style={[styles.medalText, {color: '#cd7f32'}]}>{stat.third}</Text></View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
         </View>
      </Modal>

      {/* --- MODAL: PODROBNOSTI IGRALCA --- */}
      <Modal visible={showGlobalPlayerModal} transparent animationType="slide" onRequestClose={() => setShowGlobalPlayerModal(false)}>
         <View style={styles.modalOverlay}>
             <View style={styles.modalContent}>
                {selectedGlobalPlayer && (
                    <>
                        <View style={styles.modalHeaderBar}>
                             <Text style={styles.modalTitle}>{selectedGlobalPlayer.name}</Text>
                             <TouchableOpacity onPress={() => setShowGlobalPlayerModal(false)}><Text style={styles.closeText}>Zapri</Text></TouchableOpacity>
                        </View>

                        <ScrollView style={styles.detailScroll}>
                            {/* FORMA */}
                            {(() => {
                                const form = getFormStatus(selectedGlobalPlayer.recent_ranks);
                                return (
                                    <LinearGradient colors={['#252525', '#151515']} style={styles.formCard}>
                                        <Text style={styles.sectionTitle}>Trenutna forma</Text>
                                        {/* POPRAVEK: Povečan razmak (marginTop: 18) */}
                                        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 18}}>
                                            <Text style={{fontSize: 48, marginRight: 15}}>{form.icon}</Text>
                                            <View>
                                                <Text style={[styles.formText, {color: form.color}]}>{form.text}</Text>
                                                <Text style={styles.formSubText}>{selectedGlobalPlayer.recent_ranks.slice(0, 5).length} iger analiziranih</Text>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                );
                            })()}

                            {/* GRAF */}
                            <View style={styles.chartSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:15}}>
                                    <TrendingUp size={18} color="#4a9eff" style={{marginRight:8}} />
                                    <Text style={styles.sectionTitle}>Trend uvrstitev (Zadnjih 10)</Text>
                                </View>
                                <View style={styles.chartContainer} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
                                    <View style={[styles.gridLine, {top: 0}]}><Text style={styles.gridLabel}>1.</Text></View>
                                    <View style={[styles.gridLine, {top: '50%'}]}><Text style={styles.gridLabel}>5.</Text></View>
                                    <View style={[styles.gridLine, {top: '100%'}]}><Text style={styles.gridLabel}>10.</Text></View>

                                    {chartWidth > 0 && (() => {
                                        const data = selectedGlobalPlayer.recent_ranks.slice(0, 10).reverse();
                                        const chartHeight = 120;
                                        const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;
                                        const points = data.map((r, i) => ({ x: data.length > 1 ? i * stepX : chartWidth/2, y: ((Math.min(r.rank, 10) - 1) / 9) * chartHeight, rank: r.rank }));
                                        return (
                                            <View style={{ width: '100%', height: '100%' }}>
                                                {points.map((p, i) => i < points.length - 1 && <Line key={`line-${i}`} x1={p.x} y1={p.y} x2={points[i+1].x} y2={points[i+1].y} color="#4a9eff" />)}
                                                {points.map((p, i) => (
                                                    <View key={`dot-${i}`} style={{position: 'absolute', left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: p.rank===1?'#ffd700':p.rank===2?'#c0c0c0':p.rank===3?'#cd7f32':'#fff', zIndex: 10}} />
                                                ))}
                                            </View>
                                        );
                                    })()}
                                </View>
                                <View style={styles.chartXAxis}>
                                    <Text style={styles.axisLabel}>Starejše</Text>
                                    <Text style={styles.axisLabel}>Novejše</Text>
                                </View>
                            </View>

                            <View style={styles.lastGamesSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                    <Calendar size={18} color="#666" style={{marginRight:8}} />
                                    <Text style={styles.sectionTitle}>Zadnjih 5 iger</Text>
                                </View>
                                {selectedGlobalPlayer.recent_ranks.slice(0, 5).map((r, i) => (
                                    <View key={i} style={styles.rankRow}>
                                        <Text style={styles.rankRowDate}>{new Date(r.date).toLocaleDateString('sl-SI')}</Text>
                                        <View style={styles.rankBadge}>
                                            <Text style={styles.rankBadgeText}>{r.rank}. mesto</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </>
                )}
             </View>
         </View>
      </Modal>

      {/* MODAL: IGRA - PODROBNOSTI */}
      <Modal visible={showGameModal} transparent animationType="slide" onRequestClose={() => setShowGameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderBar}>
                <Text style={styles.modalTitle}>{selectedGame?.name}</Text>
                <TouchableOpacity onPress={() => setShowGameModal(false)}><Text style={styles.closeText}>Zapri</Text></TouchableOpacity>
            </View>
            <View style={{alignItems: 'center', marginBottom: 15}}>
                 <TouchableOpacity style={styles.infoCapsule} onPress={() => loadAllPlayersHistory()}>
                    <Info size={16} color="#4a9eff" />
                    <Text style={{color: '#4a9eff', fontWeight: '600', marginLeft: 6}}>Zgodovina točk</Text>
                 </TouchableOpacity>
            </View>
            <ScrollView style={styles.playersListContainer}>
              {gamePlayers.map((player, index, array) => {
                const playerRadelci = getPlayerRadelci(player.id);
                const rank = array.findIndex(p => p.total_score === player.total_score) + 1;
                return (
                  <LinearGradient colors={['#252525', '#1e1e1e']} key={player.id} style={styles.playerRowContainer}>
                    <View style={styles.rankContainer}>
                      {rank === 1 && <Trophy size={20} color="#ffd700" />}
                      {rank === 2 && <Trophy size={20} color="#c0c0c0" />}
                      {rank === 3 && <Trophy size={20} color="#cd7f32" />}
                      {rank > 3 && (<Text style={styles.rankNumber}>{rank}</Text>)}
                    </View>
                    <Text style={styles.playerName}>{player.name || `Igralec ${player.position + 1}`}</Text>
                    {playerRadelci.length > 0 && (<View style={styles.radelciContainer}>{playerRadelci.map((radelc) => (<View key={radelc.id} style={[styles.radelc, radelc.is_used ? styles.radelcUsed : styles.radelcUnused]} />))}</View>)}
                    <Text style={[styles.playerScore, player.total_score > 0 ? styles.positiveScore : player.total_score < 0 ? styles.negativeScore : styles.neutralScore]}>{player.total_score}</Text>
                  </LinearGradient>
                );
              })}
            </ScrollView>
            <View style={styles.modalButtons}>
              {selectedGame?.is_active ? (
                <>
                  <TouchableOpacity style={styles.endGameButton} onPress={() => endGame(selectedGame.id)}><CheckCircle size={20} color="#fff" style={{marginRight:8}} /><Text style={styles.buttonText}>Zaključi igro</Text></TouchableOpacity>
                  {/* POPRAVEK: Gumb za brisanje povečan (minHeight) */}
                  <TouchableOpacity style={styles.deleteButton} onPress={() => deleteGame(selectedGame.id)}><Trash2 size={24} color="#fff" /></TouchableOpacity>
                </>
              ) : (
                // POPRAVEK: Gumb za brisanje v arhivu povečan (padding)
                selectedGame && <TouchableOpacity style={[styles.deleteButton, {flex: 1, backgroundColor: '#ef4444', minHeight: 56}]} onPress={() => deleteGame(selectedGame.id)}><Trash2 size={20} color="#fff" style={{marginRight:8}}/><Text style={styles.buttonText}>Izbriši igro</Text></TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: SCORE HISTORY (POT IGRALCA) */}
      <Modal visible={showPlayerHistoryModal} transparent animationType="slide" onRequestClose={() => setShowPlayerHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderBar}>
                 <Text style={styles.modalTitle}>Potek igre</Text>
                 <TouchableOpacity onPress={() => setShowPlayerHistoryModal(false)}><Text style={styles.closeText}>Zapri</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList}>
              {gamePlayers.sort((a, b) => b.total_score - a.total_score).map((player, playerIndex, array) => {
                  const playerEntries = playerHistory.filter((e) => e.player_id === player.id);
                  if (playerEntries.length === 0) return null;
                  return (
                    <View key={player.id} style={styles.playerHistorySection}>
                      <View style={styles.playerHistoryHeader}>
                         <Text style={styles.playerHistorySectionTitle}>{player.name}</Text>
                         <Text style={[styles.playerTotalScore, player.total_score >= 0 ? styles.positivePoints : styles.negativePoints]}>{player.total_score}</Text>
                      </View>
                      {playerEntries.map((entry, index) => {
                        let runningTotal = 0;
                        for (let i = 0; i <= index; i++) { runningTotal += playerEntries[i].points; }
                        return (
                          <View key={entry.id} style={styles.historyItem}>
                             {/* POPRAVEK: PIKA PRESTAVLJENA OB TOČKE */}
                             <View style={styles.historyPointsContainer}>
                                <Text style={[styles.historyPoints, entry.points > 0 ? styles.positivePoints : styles.negativePoints]}>
                                    {entry.points > 0 ? '+' : ''}{entry.points}
                                </Text>
                                {entry.played && <View style={styles.playedDotSmall} />}
                             </View>
                             
                             <View style={{flex: 1}} />
                             <Text style={styles.historyTotal}>{runningTotal}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  mainHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 70, paddingBottom: 20 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 8 }, // Povečan marginTop
  globalStatsButton: { backgroundColor: '#1f1f1f', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  
  listContainer: { padding: 20, paddingBottom: 100, gap: 16 },
  cardWrapper: { shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  gameCard: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#333' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  gameName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  gameDate: { color: '#666', fontSize: 13, fontWeight: '500' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1d4ed8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  activeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { color: '#444', fontSize: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, height: '90%', borderWidth: 1, borderColor: '#333' },
  modalHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '700' },
  closeText: { color: '#4a9eff', fontSize: 16, fontWeight: '600' },
  
  // LEADERBOARD STYLES
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1a1a1a', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#252525' },
  rankBox: { width: 40, alignItems: 'center', justifyContent: 'center' }, // Malo širši box za večje pokale
  rankText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  leaderboardInfo: { flex: 1, paddingLeft: 12 },
  leaderboardName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  leaderboardSub: { color: '#666', fontSize: 13 },
  medalRow: { flexDirection: 'row', gap: 6 },
  medalTag: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, backgroundColor: '#111' },
  medalText: { fontSize: 12, fontWeight: '700' },

  // DETAIL & CHART
  detailScroll: { flex: 1 },
  formCard: { padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', opacity: 0.9 },
  formText: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  formSubText: { color: '#888', fontSize: 13 },
  chartSection: { marginBottom: 25, backgroundColor: '#1a1a1a', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  chartContainer: { height: 120, marginVertical: 10 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  axisLabel: { color: '#444', fontSize: 10 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#333', justifyContent: 'center' },
  gridLabel: { color: '#444', fontSize: 10, position: 'absolute', left: 0, top: -14 },
  
  lastGamesSection: { marginBottom: 40 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  rankRowDate: { color: '#888', fontSize: 14 },
  rankBadge: { backgroundColor: '#252525', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rankBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // GAME PLAYERS
  infoCapsule: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 158, 255, 0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  playersListContainer: { marginBottom: 20 },
  playerRowContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, marginBottom: 10, padding: 16, borderWidth: 1, borderColor: '#333' },
  rankContainer: { width: 30, alignItems: 'center' },
  rankNumber: { color: '#666', fontSize: 16, fontWeight: '600' },
  playerName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  playerScore: { fontSize: 22, fontWeight: '700' },
  positiveScore: { color: '#4ade80' },
  negativeScore: { color: '#f87171' },
  neutralScore: { color: '#fff' },
  radelciContainer: { flexDirection: 'row', gap: 4, marginRight: 10 },
  radelc: { width: 12, height: 12, borderRadius: 6 },
  radelcUnused: { borderWidth: 2, borderColor: '#ef4444' },
  radelcUsed: { backgroundColor: '#ef4444' },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  endGameButton: { flex: 1, backgroundColor: '#4a9eff', padding: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', minHeight: 60 },
  deleteButton: { width: 70, backgroundColor: '#333', borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', minHeight: 60 }, // Povečan gumb
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // HISTORY LOG - NEW STYLES
  historyList: { flex: 1 },
  playerHistorySection: { marginBottom: 24, backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16 },
  playerHistoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8 },
  playerHistorySectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  playerTotalScore: { fontSize: 20, fontWeight: '700' },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  
  historyPointsContainer: { flexDirection: 'row', alignItems: 'center', width: 80, justifyContent: 'flex-end' },
  historyPoints: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  playedDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffd700', marginLeft: 8 }, // Pika takoj ob točkah
  
  historyTotal: { color: '#888', fontSize: 14, width: 40, textAlign: 'right' },
  positivePoints: { color: '#4ade80' },
  negativePoints: { color: '#f87171' },
});
