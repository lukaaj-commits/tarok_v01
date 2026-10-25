// Profil igralca (prestavljeno iz zaslona Zgodovina - izgled in vsebina NESPREMENJENA)
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { TrendingUp, Calendar, Swords, Trophy, Zap, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayerStats, getFormStatus, getRivals } from '@/lib/playerStats';
import { getAvatarUrl } from '@/lib/avatars';

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
  winnerGrey: 'rgb(148, 163, 184)'
};

const GRADIENT_COLORS = ['#556eeb', '#6050ea']; 

type Props = { player: PlayerStats | null; visible: boolean; onClose: () => void };

export default function PlayerProfileModal({ player, visible, onClose }: Props) {
  const [showAllGames, setShowAllGames] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const detailScrollRef = useRef<ScrollView>(null);

  // ob odprtju novega igralca: začni na vrhu in pokaži zadnjih 5 iger
  useEffect(() => {
    if (!visible) return;
    setShowAllGames(false);
    const t = setTimeout(() => detailScrollRef.current?.scrollTo({ y: 0, animated: false }), 100);
    return () => clearTimeout(t);
  }, [player, visible]);

  const Line = ({ x1, y1, x2, y2, color }: { x1: number, y1: number, x2: number, y2: number, color: string }) => {
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      return (<View style={{ position: 'absolute', left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - 1, width: length, height: 2, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />);
  };

  return (
      <Modal 
          visible={visible} 
          transparent 
          animationType="slide" 
          onRequestClose={() => onClose()}
      >
         <View style={styles.modalOverlay}>
             <View style={[styles.modalContent, styles.historyModal]}>
                {player && (
                    <>
                        <ScrollView ref={detailScrollRef} style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                            <View style={styles.detailHeader}>
                                <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.playerAvatar, {width: 80, height: 80, borderRadius: 40, marginRight: 0, marginBottom: 12, borderWidth: 2}]} />
                                <Text style={styles.modalTitle}>{player.name}   <Text style={{ color: 'rgb(148, 163, 184)' }}>{Math.round(player.avg_performance)}%</Text></Text>
                            </View>

                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>Trenutna forma</Text>
                                {(() => {
                                    const form = getFormStatus(player.recent_ranks);
                                    return (
                                        <View style={styles.formCard}><Text style={{fontSize: 40}}>{form.icon}</Text><Text style={styles.formSubText}>{player.recent_ranks.slice(0, 5).length} iger v analizi</Text></View>
                                    );
                                })()}
                            </View>

                            <View style={styles.chartSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:20}}><TrendingUp size={20} color={COLORS.primary} style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Gibanje uvrstitev (Zadnjih 10)</Text></View>
                                <View style={styles.chartContainer} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
                                    <View style={[styles.gridLine, {top: 0}]}><Text style={styles.gridLabel}>1.</Text></View><View style={[styles.gridLine, {top: '50%'}]}><Text style={styles.gridLabel}>5.</Text></View><View style={[styles.gridLine, {top: '100%'}]}><Text style={styles.gridLabel}>10.</Text></View>
                                    {(() => {
                                        if (chartWidth === 0) return null;
                                        const data = player.recent_ranks.slice(0, 10).reverse();
                                        const chartHeight = 120;
                                        const totalPoints = data.length;
                                        const stepX = totalPoints > 1 ? chartWidth / (totalPoints - 1) : chartWidth / 2;
                                        const points = data.map((r, i) => { const cappedRank = Math.min(r.rank, 10); const y = ((cappedRank - 1) / 9) * chartHeight; const x = totalPoints > 1 ? i * stepX : chartWidth / 2; return { x, y, rank: r.rank }; });
                                        return (
                                            <View style={{ width: '100%', height: '100%' }}>
                                                {points.map((p, i) => { if (i === points.length - 1) return null; const nextP = points[i+1]; return (<Line key={`line-${i}`} x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y} color={COLORS.primary} />); })}
                                                {points.map((p, i) => { let dotColor = '#fff'; if (p.rank === 1) dotColor = '#ffd700'; else if (p.rank === 2) dotColor = '#c0c0c0'; else if (p.rank === 3) dotColor = '#cd7f32'; return (<View key={`dot-${i}`} style={{position: 'absolute', left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: dotColor, zIndex: 10}} />); })}
                                            </View>
                                        );
                                    })()}
                                </View>
                                <View style={styles.chartXAxis}><Text style={styles.axisLabel}>Starejše</Text><Text style={styles.axisLabel}>Novejše</Text></View>
                            </View>

                            <View style={styles.lastGamesSection}>
                                <View style={{flexDirection:'row', alignItems:'center', justifyContent: 'space-between', marginBottom:10}}>
                                    <View style={{flexDirection:'row', alignItems:'center'}}><Calendar size={20} color={COLORS.textMuted} style={{marginRight:8}} /><Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{showAllGames ? 'Vse igre' : 'Zadnjih 5 iger'}</Text></View>
                                    {player.recent_ranks.length > 5 && (<TouchableOpacity onPress={() => setShowAllGames(!showAllGames)}><Text style={{color: COLORS.primary, fontWeight: '600', fontSize: 14}}>{showAllGames ? 'Pokaži manj' : 'Pokaži vse'}</Text></TouchableOpacity>)}
                                </View>
                                {(showAllGames ? player.recent_ranks : player.recent_ranks.slice(0, 5)).map((r, i) => (
                                    <View key={i} style={styles.rankRow}><Text style={styles.rankRowDate}>{new Date(r.date).toLocaleDateString('sl-SI')}</Text><View style={styles.rankBadge}><Text style={styles.rankBadgeText}>{r.rank}. mesto</Text></View></View>
                                ))}
                            </View>

                            <View style={styles.rivalsSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}><Swords size={20} color={COLORS.danger} style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Osebni rivali</Text></View>
                                {(() => {
                                    const rivals = getRivals(player.h2h);
                                    if (!rivals) return <Text style={styles.emptyText}>Premalo odigranih skupnih iger za izračun rivalov (vsaj 3 igre z istim nasprotnikom).</Text>;
                                    return (
                                        <View>
                                            {rivals.stranka && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Najljubša stranka</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.stranka.opponent) }} style={[styles.playerAvatar, {width: 24, height: 24, borderRadius: 12, marginRight: 8}]} /><Text style={styles.rivalName}>{rivals.stranka.opponent}</Text></View><Text style={styles.rivalDesc}>Zmage proti njemu: <Text style={{fontWeight: '700', color: COLORS.text}}>{Math.round(rivals.stranka.winPct)} %</Text> ({rivals.stranka.wins} Z / {rivals.stranka.losses} P)</Text></View>)}
                                            {rivals.mora && rivals.mora.opponent !== rivals.stranka.opponent && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Trn v peti</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.mora.opponent) }} style={[styles.playerAvatar, {width: 24, height: 24, borderRadius: 12, marginRight: 8}]} /><Text style={styles.rivalName}>{rivals.mora.opponent}</Text></View><Text style={styles.rivalDesc}>Porazi proti njemu: <Text style={{fontWeight: '700', color: COLORS.text}}>{Math.round(rivals.mora.lossPct)} %</Text> ({rivals.mora.losses} P / {rivals.mora.wins} Z)</Text></View>)}
                                            {rivals.derbi && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Večni derbi</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.derbi.opponent) }} style={[styles.playerAvatar, {width: 24, height: 24, borderRadius: 12, marginRight: 8}]} /><Text style={styles.rivalName}>{rivals.derbi.opponent}</Text></View><Text style={styles.rivalDesc}>Izenačen boj: <Text style={{fontWeight: '700', color: COLORS.text}}>{Math.round(rivals.derbi.winPct)} %</Text> uspeh.</Text></View>)}
                                        </View>
                                    );
                                })()}
                            </View>

                            <View style={styles.recordsSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}><Trophy size={20} color="#ffd700" style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Osebni rekordi in ekstremi</Text></View>
                                <View style={styles.recordsGrid}>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>🚀 Življenjska igra</Text><Text style={[styles.recordValue, player.best_game && player.best_game.score > 0 ? {color: COLORS.success} : {}]}>{player.best_game ? (player.best_game.score > 0 ? `+${player.best_game.score}` : player.best_game.score) : '/'}</Text><Text style={styles.recordSub}>{player.best_game ? new Date(player.best_game.date).toLocaleDateString('sl-SI') : ''}</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>💀 Črni dan</Text><Text style={[styles.recordValue, player.worst_game && player.worst_game.score < 0 ? {color: COLORS.danger} : {}]}>{player.worst_game ? player.worst_game.score : '/'}</Text><Text style={styles.recordSub}>{player.worst_game ? new Date(player.worst_game.date).toLocaleDateString('sl-SI') : ''}</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>💰 Skupne točke</Text><Text style={[styles.recordValue, player.total_score_sum > 0 ? {color: COLORS.success} : (player.total_score_sum < 0 ? {color: COLORS.danger} : {color: COLORS.text})]}>{player.total_score_sum > 0 ? `+${player.total_score_sum}` : player.total_score_sum}</Text><Text style={styles.recordSub}>Karierni izkupiček</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>⚖️ Povprečje</Text><Text style={styles.recordValue}>{(player.total_score_sum / player.total_games).toFixed(1)}</Text><Text style={styles.recordSub}>Točk na igro</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>🏅 Stopničke</Text><Text style={styles.recordValue}>{Math.round(((player.wins + player.second + player.third) / player.total_games) * 100)} %</Text><Text style={styles.recordSub}>Iger med top 3</Text></View>
                                    <View style={styles.recordBox}><Text style={styles.recordTitle}>🔥 Niz zmag</Text><Text style={styles.recordValue}>{player.longest_win_streak}</Text><Text style={styles.recordSub}>Zaporednih zmag</Text></View>
                                    <View style={[styles.recordBox, {width: '100%', borderColor: 'rgba(255, 215, 0, 0.25)', borderTopColor: 'rgba(255, 215, 0, 0.5)', borderLeftColor: 'rgba(255, 215, 0, 0.35)', backgroundColor: 'rgba(255, 215, 0, 0.05)'}]}><Text style={[styles.recordTitle, {color: '#ffd700', fontSize: 16, marginBottom: 0}]}>🏅 Igralec meseca</Text><Text style={[styles.recordValue, {color: '#ffd700', marginTop: 8, fontSize: 32}]}>{(player.month_titles || []).length > 0 ? `×${(player.month_titles || []).length}` : '–'}</Text><Text style={styles.recordSub}>{(player.month_titles || []).length > 0 ? (player.month_titles || []).join(' · ') : 'Še brez naslova'}</Text></View>
                                    <View style={[styles.recordBox, {width: '100%', borderColor: 'rgba(245, 158, 11, 0.2)', borderTopColor: 'rgba(245, 158, 11, 0.5)', borderLeftColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.05)'}]}><View style={{flexDirection: 'row', alignItems: 'center'}}><Zap size={18} color={COLORS.warning} style={{marginRight: 8}} /><Text style={[styles.recordTitle, {color: COLORS.warning, marginBottom: 0, fontSize: 16}]}>Valati</Text></View><Text style={[styles.recordValue, {color: COLORS.warning, marginTop: 8, fontSize: 32}]}>{player.valat_count}</Text><Text style={styles.recordSub}>Skupno število uspešnih valatov</Text></View>
                                </View>
                            </View>

                            <View style={styles.recordsSection}>
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}><Trophy size={20} color="#ffd700" style={{marginRight:8}} /><Text style={[styles.sectionTitle, {marginBottom: 0}]}>Večni dosežki</Text></View>
                                <View style={{ gap: 10 }}>
                                    {(() => {
                                        const achievements = [
                                            { id: 'metla', title: 'Zlata metla', icon: '🧹', target: 3, current: player.current_win_streak, unlocked: player.longest_win_streak >= 3, descLocked: 'Zmagaj 3 igre zapored v katerih sodeluješ.', descUnlocked: 'Dosežek odklenjen: Zmagal si 3 igre zapored.' },
                                            { id: 'valat', title: 'Kralj valatov', icon: '⚡', target: 2, current: player.valat_count, unlocked: player.valat_count >= 2, descLocked: 'Odigraj in zmagaj 2 valata v svoji karieri.', descUnlocked: 'Dosežek odklenjen: Uspešno si odigral 2 valata v karieri.' },
                                            { id: 'feniks', title: 'Feniks', icon: '🦅', target: 3, current: player.phoenix_count, unlocked: player.phoenix_count >= 3, descLocked: 'Zmagaj 3 igre, v katerih je bil tvoj skupni seštevek točk med igro pod ničlo (v minusu).', descUnlocked: 'Dosežek odklenjen: Trikrat si zmagal igro, čeprav si bil vmes v minusu.' },
                                            { id: 'berac', title: 'Kralj beračev', icon: '🙏', target: 5, current: player.beggar_wins, unlocked: player.beggar_wins >= 5, descLocked: 'Odigraj in zmagaj 5 beračev v svoji karieri.', descUnlocked: 'Dosežek odklenjen: Uspešno si zmagal 5 beračev v karieri.' },
                                            { id: 'dominator', title: 'Gospodar mize', icon: '👑', target: 3, current: player.dominator_count, unlocked: player.dominator_count >= 3, descLocked: 'Zmagaj igro z vsaj 300 točkami prednosti pred drugim mestom, in to ponovi 3x.', descUnlocked: 'Dosežek odklenjen: Trikrat si zmagal z vsaj 300 točkami prednosti.' }
                                        ];
                                        const unlockedCount = achievements.filter(a => a.unlocked).length;
                                        return (
                                            <>
                                                {achievements.map(ach => {
                                                    const isUnlocked = ach.unlocked; const progress = isUnlocked ? 1 : (ach.current / ach.target);
                                                    return (
                                                        <View key={ach.id} style={styles.achievementBox}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{isUnlocked ? (<Text style={{ fontSize: 22 }}>{ach.icon}</Text>) : (<Lock size={20} color="#64748b" />)}</View><View style={{ flex: 1 }}><Text style={{ fontSize: 18, fontWeight: '800', color: isUnlocked ? '#ffd700' : '#94a3b8' }}>{ach.title}</Text></View></View>
                                                            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>{isUnlocked ? ach.descUnlocked : ach.descLocked}</Text>
                                                            {isUnlocked ? (<View style={{ flexDirection: 'row', alignItems: 'center' }}><Trophy size={14} color="#ffd700" style={{ marginRight: 6 }} /><Text style={{ color: '#ffd700', fontSize: 12, fontWeight: '700' }}>Odklenjeno</Text></View>) : (<View><View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' }}><View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 }} /></View><Text style={{ color: '#64748b', fontSize: 11, marginTop: 6, textAlign: 'right', fontWeight: '600' }}>({Math.min(ach.current, ach.target)} / {ach.target})</Text></View>)}
                                                        </View>
                                                    );
                                                })}
                                                {unlockedCount === 5 && (
                                                    <View style={styles.grandSlamBox}>
                                                        <LinearGradient colors={GRADIENT_COLORS} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.absoluteGradient} />
                                                        <View style={styles.relativeContentVertical}><Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: 1, textAlign: 'center' }}>🏆 GRAND SLAM 🏆</Text><Text style={{ fontSize: 15, color: '#e2e8f0', marginBottom: 15, textAlign: 'center', fontWeight: '500' }}>Čestitke, vse značke so tvoje!</Text><View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, width: '100%' }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' }}>Nagrada: Vsak igralec ti plača pivo! 🍻😎</Text></View></View>
                                                    </View>
                                                )}
                                            </>
                                        );
                                    })()}
                                </View>
                            </View>

                        </ScrollView>
                        <TouchableOpacity style={styles.closeButton} onPress={() => onClose()}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
                    </>
                )}
             </View>
         </View>
      </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  mainHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  
  absoluteGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  relativeContent: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  relativeContentVertical: { position: 'relative', zIndex: 1, alignItems: 'center', width: '100%' },

  globalStatsButton: {
      paddingVertical: 12, paddingHorizontal: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden'
  },
  
  subTitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 15 },
  listContainer: { padding: 16, gap: 12 },
  cardWrapper: { }, 
  gameCard: { 
      backgroundColor: COLORS.card, borderRadius: 20, padding: 18,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  gameTitleCombined: { color: '#fff', fontSize: 16, fontWeight: '600' },
  activeBadge: { backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, marginBottom: 8, textAlign: 'center', paddingHorizontal: 20 },
  loadingText: { color: COLORS.text, fontSize: 18, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  
  modalContent: { 
      backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 12 },
  modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  headerInfoButton: { padding: 4 },
  playersListContainer: { marginBottom: 20 },
  
  playerRowContainer: { 
      flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16, gap: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rankContainer: { width: 32, alignItems: 'center' },
  rankNumber: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  
  playerAvatar: {
      width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', borderTopColor: 'rgba(255, 255, 255, 0.3)', 
  },
  
  playerName: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '500', marginLeft: 4 },
  playerScore: { fontSize: 20, fontWeight: '700' },
  positiveScore: { color: COLORS.success },
  negativeScore: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 12 },
  
  closeButton: { 
      backgroundColor: '#5863ea', padding: 16, borderRadius: 12, alignItems: 'center', 
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', borderTopColor: 'rgba(255, 255, 255, 0.55)', borderLeftColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden' 
  },
  closeButtonFlex: { flex: 1 },
  closeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  radelciContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  radelc: { width: 10, height: 10, borderRadius: 5 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.radelcBorder },
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 },
  historyModal: { height: '85%', maxHeight: '85%' }, 
  historyList: { flex: 1, marginBottom: 16 },
  playerHistorySection: { marginBottom: 24 },
  
  playerHistoryHeader: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.20)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  playerRankBadge: { width: 28, alignItems: 'center', justifyContent: 'center' },
  playerRankText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  playerHistorySectionTitle: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: '600' },
  playerTotalScore: { fontSize: 22, fontWeight: '700' },
  
  historyItem: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 8, marginBottom: 8,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  pointsWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  fixedPointsBox: { width: 60, alignItems: 'flex-end', paddingRight: 5 },
  dotBox: { width: 20, alignItems: 'center', justifyContent: 'center' },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  positivePoints: { color: COLORS.success },
  negativePoints: { color: COLORS.danger },
  historyTotal: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  historyDate: { color: COLORS.textMuted, fontSize: 12, flex: 1, textAlign: 'right' },
  playedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.playedDot },
  
  tabContainer: { 
      flexDirection: 'row', marginBottom: 20, backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 4,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.15)', borderLeftColor: 'rgba(255, 255, 255, 0.10)', overflow: 'hidden'
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: { backgroundColor: COLORS.card },
  tabText: { color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  
  leaderboardItem: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 10, marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rankText: { color: COLORS.text, fontSize: 20, fontWeight: '700' }, 
  leaderboardName: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1 },
  medalBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  medalText: { color: '#fff', fontWeight: '800', marginLeft: 4, fontSize: 15 },
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailScroll: { flex: 1, marginBottom: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  
  formSection: { marginBottom: 24, alignItems: 'center' },
  formCard: { 
      backgroundColor: COLORS.inputBg, width: '100%', padding: 20, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  formText: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  formSubText: { color: COLORS.textMuted, marginTop: 4 },
  
  rivalsSection: { marginBottom: 24, marginTop: 10 }, 
  rivalCard: { 
      backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rivalTitle: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  rivalName: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  rivalDesc: { color: COLORS.textMuted, fontSize: 13 },
  
  recordsSection: { marginBottom: 24, marginTop: 10 },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recordBox: { 
      width: '48%', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  recordTitle: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  recordValue: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  recordSub: { color: '#64748b', fontSize: 11, textAlign: 'center' },
  
  chartSection: { 
      marginBottom: 24, backgroundColor: '#222', padding: 16, borderRadius: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  chartContainer: { height: 140, paddingBottom: 10, marginTop: 10 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { color: COLORS.textMuted, fontSize: 10 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#333', justifyContent: 'center' },
  gridLabel: { color: '#444', fontSize: 10, position: 'absolute', left: 0, top: -15 },
  lastGamesSection: { marginBottom: 20 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  rankRowDate: { color: COLORS.textMuted, fontSize: 14 },
  rankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  rankBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  
  awardCard: { 
      width: '48%', backgroundColor: COLORS.inputBg, padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  awardTitle: { color: COLORS.success, fontSize: 12, fontWeight: '800', marginTop: 4 }, 
  awardName: { color: COLORS.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginVertical: 2 },
  awardDesc: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
  
  winnerCard: { 
      alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 16, marginBottom: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  winnerText: { color: '#ffd700', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  winnerName: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  winnerScore: { color: COLORS.success, fontSize: 22, fontWeight: '800', marginTop: 4 },

  selectPlayerItem: {
      backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  gameModalInfoBtn: {
      paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.inputBg, borderRadius: 8, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  gameModalTrashBtn: {
      padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8,
      borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', borderTopColor: 'rgba(239, 68, 68, 0.4)', borderLeftColor: 'rgba(239, 68, 68, 0.3)', overflow: 'hidden'
  },
  winnerPopupCard: {
      backgroundColor: COLORS.card, padding: 30, borderRadius: 24, alignItems: 'center', width: '80%', zIndex: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderTopColor: 'rgba(255, 255, 255, 0.22)', borderLeftColor: 'rgba(255, 255, 255, 0.14)', overflow: 'hidden'
  },
  achievementBox: {
      backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  grandSlamBox: {
      marginTop: 10, padding: 20, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', borderTopColor: 'rgba(255, 255, 255, 0.3)', borderLeftColor: 'rgba(255, 255, 255, 0.2)', overflow: 'hidden'
  }
});
