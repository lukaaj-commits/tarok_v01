// Profil igralca (prestavljeno iz zaslona Zgodovina - izgled in vsebina NESPREMENJENA)
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { TrendingUp, TrendingDown, Swords, Trophy, Zap, Lock, Check, Sigma, Divide, BarChart3, Flame } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayerStats, getFormStatus, getRivals } from '@/lib/playerStats';
import { getAvatarUrl } from '@/lib/avatars';
import DuelModal from '@/components/DuelModal';
import TintBg from '@/components/TintBg';
import { g } from '@/lib/gender';
import { CHALLENGES, IZZIVI, IZZIVI_START } from '@/lib/challenges';
import StoryRow from '@/components/StoryRow';
import SwipeTabs from '@/components/SwipeTabs';
import ProfileAvatar from '@/components/ProfileAvatar';
import { MonthRankRow, TableStats } from '@/components/ProfileExtras';
import { PhoneOwnerRow } from '@/components/WhoAmI';

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
  sheet: '#121A2B',
  soft: '#64D2FF',
  label: 'rgba(100,210,255,0.6)',
};

// barve oblike forme (namesto emojijev)
const FORM_COLORS: Record<string, string> = { 'Vroče': '#FF9F0A', 'Odlična': '#30D158', 'Srednja': '#FFD60A', 'Hladna': '#8E8E93' };

const GRADIENT_COLORS = ['#0A84FF', '#0A84FF']; 

type Props = { player: PlayerStats | null; visible: boolean; onClose: () => void };

// slovnica: 1 igra, 2 igri, 3-4 igre, 5+ iger
const plural = (n: number, one: string, two: string, few: string, many: string) => {
  const m = n % 100;
  return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many;
};

export default function PlayerProfileModal({ player, visible, onClose }: Props) {
  const [showAllGames, setShowAllGames] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [showDuel, setShowDuel] = useState(false);
  const [tab, setTab] = useState<'stats' | 'ach'>('stats');
  const [showClassic, setShowClassic] = useState(false);
  const detailScrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const tabsY = useRef(0);
  const changeTab = (t: 'stats' | 'ach') => {
    if (scrollY.current > tabsY.current) detailScrollRef.current?.scrollTo({ y: tabsY.current, animated: false });
    setTab(t);
  };

  // ob odprtju novega igralca: začni na vrhu in pokaži zadnjih 5 iger
  useEffect(() => {
    if (!visible) return;
    setShowAllGames(false);
    setTab('stats');
    setShowClassic(false);
    const t = setTimeout(() => detailScrollRef.current?.scrollTo({ y: 0, animated: false }), 100);
    return () => clearTimeout(t);
  }, [player, visible]);

  const Line = ({ x1, y1, x2, y2, color }: { x1: number, y1: number, x2: number, y2: number, color: string }) => {
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      return (<View style={{ position: 'absolute', left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - 1, width: length, height: 2, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />);
  };

  // koliko dosežkov je odklenjenih (Klasika: enaka pravila kot spodaj v seznamu)
  const classicUnlocked = player ? [player.longest_win_streak >= 3, player.valat_count >= 2, player.phoenix_count >= 3, player.beggar_wins >= 5, player.dominator_count >= 3].filter(Boolean).length : 0;
  const izziviUnlocked = player ? CHALLENGES.filter(ch => ((player.challenges || {})[ch.id] || 0) >= ch.threshold).length : 0;


  // ena vrstica dosežka ali izziva: ikona (kljukica / ključavnica), naslov, opis, napredek
  const AchRow = ({ title, desc, unlocked, count, current, target, showProgress }: { title: string; desc: string; unlocked: boolean; count?: number; current: number; target: number; showProgress: boolean }) => (
    <View style={[styles.achRow, !unlocked && { opacity: 0.6 }]}>
      <View style={[styles.achIcon, unlocked ? styles.achIconOn : styles.achIconOff]}>
        {unlocked ? <Check size={16} color={COLORS.soft} strokeWidth={2.6} /> : <Lock size={15} color="#636366" />}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.achTitle, !unlocked && { color: '#8E8E93' }]}>{title}</Text>
          {unlocked && !!count && count > 1 && <Text style={styles.timesBadge}>×{count}</Text>}
          <View style={{ flex: 1 }} />
          <Text style={[styles.achState, unlocked && { color: COLORS.soft }]}>{unlocked ? 'Odklenjeno' : showProgress ? `${Math.min(current, target)} / ${target}` : 'Še ni odklenjeno'}</Text>
        </View>
        <Text style={styles.achDesc}>{desc}</Text>
        {!unlocked && showProgress && (
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(current / target, 1) * 100}%` }]} /></View>
        )}
      </View>
    </View>
  );

  // zbirka Klasika (obstoječi dosežki) - prikazana zgoraj, ali strnjena na dnu, ko je zaključena
  const renderClassic = () => !player ? null : (
                            <View style={styles.recordsSection}>
                                <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Klasika</Text><Text style={styles.collCount}>{classicUnlocked} / 5</Text></View>
                                <Text style={styles.collSub}>Štejejo vse partije od začetka.</Text>
                                <View>
                                    {(() => {
                                        const achievements = [
                                            { id: 'metla', title: 'Zlata metla', icon: '🧹', target: 3, current: player.current_win_streak, unlocked: player.longest_win_streak >= 3, descLocked: 'Zmagaj 3 igre zapored v katerih sodeluješ.', descUnlocked: `Dosežek odklenjen: ${g(player.name, 'Zmagal', 'Zmagala')} si 3 igre zapored.` },
                                            { id: 'valat', title: 'Kralj valatov', icon: '⚡', target: 2, current: player.valat_count, unlocked: player.valat_count >= 2, descLocked: 'Odigraj in zmagaj 2 valata v svoji karieri.', descUnlocked: `Dosežek odklenjen: Uspešno si ${g(player.name, 'odigral', 'odigrala')} 2 valata v karieri.` },
                                            { id: 'feniks', title: 'Feniks', icon: '🦅', target: 3, current: player.phoenix_count, unlocked: player.phoenix_count >= 3, descLocked: 'Zmagaj 3 igre, v katerih je bil tvoj skupni seštevek točk med igro pod ničlo (v minusu).', descUnlocked: `Dosežek odklenjen: Trikrat si ${g(player.name, 'zmagal', 'zmagala')} igro, čeprav si ${g(player.name, 'bil', 'bila')} vmes v minusu.` },
                                            { id: 'berac', title: 'Kralj beračev', icon: '🙏', target: 5, current: player.beggar_wins, unlocked: player.beggar_wins >= 5, descLocked: 'Odigraj in zmagaj 5 beračev v svoji karieri.', descUnlocked: `Dosežek odklenjen: Uspešno si ${g(player.name, 'zmagal', 'zmagala')} 5 beračev v karieri.` },
                                            { id: 'dominator', title: 'Gospodar mize', icon: '👑', target: 3, current: player.dominator_count, unlocked: player.dominator_count >= 3, descLocked: 'Zmagaj igro z vsaj 300 točkami prednosti pred drugim mestom, in to ponovi 3x.', descUnlocked: `Dosežek odklenjen: Trikrat si ${g(player.name, 'zmagal', 'zmagala')} z vsaj 300 točkami prednosti.` }
                                        ];
                                        const unlockedCount = achievements.filter(a => a.unlocked).length;
                                        return (
                                            <>
                                                {achievements.map(ach => (
                                                    <AchRow key={ach.id} title={ach.title} desc={ach.unlocked ? ach.descUnlocked : ach.descLocked} unlocked={ach.unlocked} current={ach.current} target={ach.target} showProgress />
                                                ))}
                                                {unlockedCount === 5 && (
                                                    <View style={styles.grandSlamBox}>
<TintBg />
                                                        <Text style={styles.gsTitle}>GRAND SLAM</Text>
                                                        <Text style={styles.gsSub}>Čestitke, vsi klasični dosežki so tvoji!</Text>
                                                        <View style={styles.gsReward}><Text style={styles.gsRewardText}>Nagrada: Vsak igralec ti plača pivo!</Text></View>
                                                    </View>
                                                )}
                                            </>
                                        );
                                    })()}
                                </View>
                            </View>
  );

  return (
    <>
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
                        <ScrollView ref={detailScrollRef} style={styles.detailScroll} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}>
                            {/* glava: slika, ime, odigrane igre in zmage, indeks */}
                            <View style={styles.profileHead}>
                                <ProfileAvatar name={player.name} style={styles.profileAvatar} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.profileName} numberOfLines={1}>{player.name}</Text>
                                    <Text style={styles.profileSub}>{player.total_games} {plural(player.total_games, 'igra', 'igri', 'igre', 'iger')} · {player.wins} {plural(player.wins, 'zmaga', 'zmagi', 'zmage', 'zmag')} · <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{Math.round(player.avg_performance)} %</Text></Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowDuel(true)} activeOpacity={0.7} style={styles.duelCircle} accessibilityLabel="Primerjaj z">
                                    <LinearGradient colors={['rgba(255,214,10,0.30)', 'rgba(255,159,10,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={StyleSheet.absoluteFill} />
                                    <Swords size={20} color="#FFD60A" strokeWidth={2} />
                                    <Text style={styles.duelCircleText}>Primerjaj</Text>
                                </TouchableOpacity>
                            </View>

                            {/* zavihka */}
                            <View style={styles.tabContainer} onLayout={e => { tabsY.current = e.nativeEvent.layout.y; }}>
                                <TouchableOpacity style={[styles.tabButton, tab === 'stats' && styles.tabButtonActive]} onPress={() => changeTab('stats')}><Text style={[styles.tabText, tab === 'stats' && styles.tabTextActive]}>Statistika</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.tabButton, tab === 'ach' && styles.tabButtonActive]} onPress={() => changeTab('ach')}><Text style={[styles.tabText, tab === 'ach' && styles.tabTextActive]}>Dosežki</Text></TouchableOpacity>
                            </View>

                            <SwipeTabs canPrev={tab === 'ach'} canNext={tab === 'stats'} onSwipe={d => changeTab(d === 1 ? 'ach' : 'stats')}>
                            {/* oba zavihka ostaneta naložena (brez poskakovanja ob vrnitvi), viden je le izbrani */}
                            <View style={tab !== 'stats' ? { display: 'none' } : undefined}>
                            <>
                            {/* zgodbe po mesecih (krogi kot na Instagramu) */}
                            <StoryRow name={player.name} />


                            <View style={styles.sectionHead}>
                                <Text style={styles.sectionTitle}>Gibanje uvrstitev</Text>
                                {(() => { const f = getFormStatus(player.recent_ranks); const c = FORM_COLORS[f.text] || COLORS.textMuted; return (
                                    <View style={[styles.formBadge, { backgroundColor: c + '29' }]}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                                        <Text style={[styles.formLabel, { color: c }]}>Forma: {f.text.toLowerCase()}</Text>
                                    </View>
                                ); })()}
                            </View>
                            <View style={styles.chartSection}>
                                <View style={styles.chartContainer} onLayout={(event) => { const w = event.nativeEvent.layout.width; if (w > 0) setChartWidth(w); }}>
                                    <View style={[styles.gridLine, {top: 0}]}><Text style={styles.gridLabel}>1.</Text></View><View style={[styles.gridLine, {top: '50%'}]}><Text style={styles.gridLabel}>5.</Text></View><View style={[styles.gridLine, {top: '100%'}]}><Text style={styles.gridLabel}>10.</Text></View>
                                    {(() => {
                                        if (chartWidth === 0) return null;
                                        const data = player.recent_ranks.slice(0, 10).reverse();
                                        const chartHeight = 80;
                                        const totalPoints = data.length;
                                        const stepX = totalPoints > 1 ? chartWidth / (totalPoints - 1) : chartWidth / 2;
                                        const points = data.map((r, i) => { const cappedRank = Math.min(r.rank, 10); const y = ((cappedRank - 1) / 9) * chartHeight; const x = totalPoints > 1 ? i * stepX : chartWidth / 2; return { x, y, rank: r.rank }; });
                                        return (
                                            <View style={{ width: '100%', height: '100%' }}>
                                                {points.map((p, i) => { if (i === points.length - 1) return null; const nextP = points[i+1]; return (<Line key={`line-${i}`} x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y} color={COLORS.primary} />); })}
                                                {points.map((p, i) => { let dotColor = '#fff'; if (p.rank === 1) dotColor = '#FFD60A'; else if (p.rank === 2) dotColor = '#D1D1D6'; else if (p.rank === 3) dotColor = '#FF9F0A'; return (<View key={`dot-${i}`} style={{position: 'absolute', left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#0C111D', borderWidth: 2, borderColor: dotColor, zIndex: 10}} />); })}
                                            </View>
                                        );
                                    })()}
                                </View>
                                <View style={styles.chartXAxis}><Text style={styles.axisLabel}>Starejše · zadnjih 10 iger</Text><Text style={styles.axisLabel}>Novejše</Text></View>
                            </View>
                            <MonthRankRow name={player.name} style={{ marginTop: 14 }} />

                            <View style={styles.lastGamesSection}>
                                <View style={{flexDirection:'row', alignItems:'center', justifyContent: 'space-between', marginBottom:10}}>
                                    <Text style={styles.sectionTitle}>{showAllGames ? 'Vse igre' : 'Zadnje 3 igre'}</Text>
                                    {player.recent_ranks.length > 3 && (<TouchableOpacity onPress={() => setShowAllGames(!showAllGames)}><Text style={{color: COLORS.primary, fontWeight: '500', fontSize: 13}}>{showAllGames ? 'Pokaži manj' : 'Pokaži vse'}</Text></TouchableOpacity>)}
                                </View>
                                {(showAllGames ? player.recent_ranks : player.recent_ranks.slice(0, 3)).map((r, i) => (
                                    <View key={i} style={styles.rankRow}><Text style={styles.rankRowDate}>{new Date(r.date).toLocaleDateString('sl-SI')}</Text><View style={styles.rankBadge}><Text style={[styles.rankBadgeText, r.rank === 1 && { color: '#FFFFFF' }]}>{r.rank}. mesto</Text></View></View>
                                ))}
                            </View>

                            <View style={styles.recordsSection}>
                                <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>Osebni rekordi in ekstremi</Text>
                                {[
                                    { I: TrendingUp, t: 'Življenjska igra', s: player.best_game ? new Date(player.best_game.date).toLocaleDateString('sl-SI') : '', v: player.best_game ? (player.best_game.score > 0 ? `+${player.best_game.score}` : `${player.best_game.score}`) : '/', c: player.best_game && player.best_game.score > 0 ? COLORS.success : COLORS.text },
                                    { I: TrendingDown, t: 'Črni dan', s: player.worst_game ? new Date(player.worst_game.date).toLocaleDateString('sl-SI') : '', v: player.worst_game ? `${player.worst_game.score}` : '/', c: player.worst_game && player.worst_game.score < 0 ? COLORS.danger : COLORS.text },
                                    { I: Sigma, t: 'Skupne točke', s: 'Karierni izkupiček', v: player.total_score_sum > 0 ? `+${player.total_score_sum}` : `${player.total_score_sum}`, c: player.total_score_sum > 0 ? COLORS.success : (player.total_score_sum < 0 ? COLORS.danger : COLORS.text) },
                                    { I: Divide, t: 'Povprečje', s: 'Točk na igro', v: (player.total_score_sum / player.total_games).toFixed(1), c: COLORS.text },
                                    { I: BarChart3, t: 'Stopničke', s: 'Iger med top 3', v: `${Math.round(((player.wins + player.second + player.third) / player.total_games) * 100)} %`, c: COLORS.text },
                                    { I: Flame, t: 'Niz zmag', s: 'Zaporednih zmag', v: `${player.longest_win_streak}`, c: COLORS.text },
                                ].map(r => (
                                    <View key={r.t} style={styles.recRow}>
                                        <View style={styles.recIcon}><r.I size={16} color={COLORS.soft} strokeWidth={2} /></View>
                                        <View style={{ flex: 1 }}><Text style={styles.recTitle}>{r.t}</Text>{!!r.s && <Text style={styles.recSub}>{r.s}</Text>}</View>
                                        <Text style={[styles.recValue, { color: r.c }]}>{r.v}</Text>
                                    </View>
                                ))}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                    <View style={styles.tintCard}>
                                        <TintBg />
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Trophy size={12} color="#FFD60A" strokeWidth={2.4} /><Text style={styles.tintLabel}>Igralec meseca</Text></View>
                                        <Text style={styles.tintValue}>{(player.month_titles || []).length > 0 ? `×${(player.month_titles || []).length}` : '–'}</Text>
                                        <Text style={styles.tintSub}>{(player.month_titles || []).length > 0 ? (player.month_titles || []).join(' · ') : 'Še brez naslova'}</Text>
                                    </View>
                                    <View style={styles.tintCard}>
                                        <TintBg />
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Zap size={12} color="#FFD60A" strokeWidth={2.4} /><Text style={styles.tintLabel}>Valati</Text></View>
                                        <Text style={styles.tintValue}>{player.valat_count}</Text>
                                        <Text style={styles.tintSub}>Uspešni valati skupaj</Text>
                                    </View>
                                </View>
                            </View>

                            <TableStats name={player.name} />
                            <View style={styles.rivalsSection}>
                                <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>Osebni rivali</Text>
                                {(() => {
                                    const rivals = getRivals(player.h2h);
                                    if (!rivals) return <Text style={styles.emptyText}>Premalo odigranih skupnih iger za izračun rivalov (vsaj 3 igre z istim nasprotnikom).</Text>;
                                    return (
                                        <View>
                                            {rivals.stranka && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Najljubša stranka</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.stranka.opponent) }} style={[styles.playerAvatar, {width: 30, height: 30, borderRadius: 15, marginRight: 10}]} /><Text style={styles.rivalName}>{rivals.stranka.opponent}</Text></View><Text style={styles.rivalDesc}>Zmage proti {g(rivals.stranka.opponent, 'njemu', 'njej')}: <Text style={{fontWeight: '600', color: COLORS.text}}>{Math.round(rivals.stranka.winPct)} %</Text> ({rivals.stranka.wins} Z / {rivals.stranka.losses} P)</Text></View>)}
                                            {rivals.mora && rivals.mora.opponent !== rivals.stranka.opponent && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Trn v peti</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.mora.opponent) }} style={[styles.playerAvatar, {width: 30, height: 30, borderRadius: 15, marginRight: 10}]} /><Text style={styles.rivalName}>{rivals.mora.opponent}</Text></View><Text style={styles.rivalDesc}>Porazi proti {g(rivals.mora.opponent, 'njemu', 'njej')}: <Text style={{fontWeight: '600', color: COLORS.text}}>{Math.round(rivals.mora.lossPct)} %</Text> ({rivals.mora.losses} P / {rivals.mora.wins} Z)</Text></View>)}
                                            {rivals.derbi && (<View style={styles.rivalCard}><Text style={styles.rivalTitle}>Večni derbi</Text><View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Image source={{ uri: getAvatarUrl(rivals.derbi.opponent) }} style={[styles.playerAvatar, {width: 30, height: 30, borderRadius: 15, marginRight: 10}]} /><Text style={styles.rivalName}>{rivals.derbi.opponent}</Text></View><Text style={styles.rivalDesc}>Izenačen boj: <Text style={{fontWeight: '600', color: COLORS.text}}>{Math.round(rivals.derbi.winPct)} %</Text> uspeh.</Text></View>)}
                                        </View>
                                    );
                                })()}
                            </View>

                            
                            </>
                            </View>
                            <View style={tab !== 'ach' ? { display: 'none' } : undefined}>
                            <>
{classicUnlocked < 5 && renderClassic()}
                            <View style={styles.recordsSection}>
                                <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{IZZIVI.name}</Text><Text style={styles.collCount}>{izziviUnlocked} / {CHALLENGES.length}</Text></View>
                                <Text style={styles.collSub}>Štejejo partije od {new Date(IZZIVI_START).toLocaleDateString('sl-SI')} naprej.</Text>
                                <View>
                                    {CHALLENGES.map(ch => {
                                        const count = (player.challenges || {})[ch.id] || 0;
                                        return <AchRow key={ch.id} title={ch.title} desc={ch.desc} unlocked={count >= ch.threshold} count={count} current={count} target={ch.threshold} showProgress={ch.threshold > 1} />;
                                    })}
                                    {izziviUnlocked === CHALLENGES.length && (
                                        <View style={styles.grandSlamBox}>
<TintBg />
                                            <Text style={styles.gsTitle}>{IZZIVI.completionTitle}</Text>
                                            <Text style={styles.gsSub}>Čestitke, vsi izzivi so tvoji!</Text>
                                            <View style={styles.gsReward}><Text style={styles.gsRewardText}>{IZZIVI.reward}</Text></View>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {classicUnlocked >= 5 && (
                                <View style={{ marginTop: 6 }}>
                                    <TouchableOpacity onPress={() => setShowClassic(v => !v)} activeOpacity={0.7} style={styles.doneCollection}>
                                        <View style={styles.achIconOnBox}><Check size={16} color={COLORS.soft} strokeWidth={2.6} /></View>
                                        <Text style={styles.doneTitle}>Klasika</Text>
                                        <Text style={styles.doneSub}>5 / 5 · Grand Slam ✓</Text>
                                        <Text style={styles.doneToggle}>{showClassic ? 'Skrij' : 'Pokaži'}</Text>
                                    </TouchableOpacity>
                                    {showClassic && <View style={{ marginTop: 12 }}>{renderClassic()}</View>}
                                </View>
                            )}
                            </>
                            </View>
                            </SwipeTabs>
                        </ScrollView>
                        {/* kdo uporablja ta telefon (za "Tvoj mesec" na začetnem zaslonu) */}
                        <PhoneOwnerRow />
                        <TouchableOpacity style={styles.closeButton} onPress={() => onClose()}><Text style={styles.closeButtonText}>Zapri</Text></TouchableOpacity>
                    </>
                )}
             </View>
         </View>
      </Modal>
    {showDuel && player && <DuelModal playerA={player.name} onClose={() => setShowDuel(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.10)' },
  profileName: { color: COLORS.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.4 },
  profileSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  profilePct: { color: '#94A3B8', fontSize: 26, fontWeight: '800' },
  duelButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(85,110,235,0.18)', borderWidth: 1, borderColor: 'rgba(85,110,235,0.5)', marginBottom: 14 },
  formBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 12 },
  formLabel: { fontSize: 12, fontWeight: '600' },
  doneCollection: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 2, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)' },
  doneTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  doneSub: { flex: 1, color: COLORS.textMuted, fontSize: 12 },
  doneToggle: { color: COLORS.primary, fontSize: 13, fontWeight: '500' },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },
  duelCircle: { width: 64, height: 64, borderRadius: 32, marginRight: 4, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,214,10,0.35)', borderTopColor: 'rgba(255,230,140,0.55)' },
  duelCircleText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  collCount: { color: COLORS.textMuted, fontSize: 13, fontWeight: '500' },
  collSub: { color: '#636366', fontSize: 12, marginBottom: 6, paddingHorizontal: 2 },
  timesBadge: { color: COLORS.soft, backgroundColor: 'rgba(100,210,255,0.14)', fontSize: 11, fontWeight: '600', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  
  modalContent: { backgroundColor: COLORS.sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, maxHeight: '92%', borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)', borderBottomWidth: 0, overflow: 'hidden' },
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
  
  playerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)' },
  
  playerName: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '500', marginLeft: 4 },
  playerScore: { fontSize: 20, fontWeight: '700' },
  positiveScore: { color: COLORS.success },
  negativeScore: { color: COLORS.danger },
  neutralScore: { color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 12 },
  
  closeButton: { backgroundColor: COLORS.primary, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeButtonFlex: { flex: 1 },
  closeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  radelciContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  radelc: { width: 10, height: 10, borderRadius: 5 }, 
  radelcUnused: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.radelcBorder },
  radelcUsed: { backgroundColor: COLORS.radelcFill, borderWidth: 0 },
  historyModal: { height: '92%', maxHeight: '92%' }, 
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
  
  tabContainer: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', marginBottom: 6, borderRadius: 12, padding: 3 },
  tabButton: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabButtonActive: { backgroundColor: COLORS.primary, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.25)' },
  tabText: { color: '#AEAEB2', fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  
  leaderboardItem: { 
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.inputBg, borderRadius: 10, marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  rankText: { color: COLORS.text, fontSize: 20, fontWeight: '700' }, 
  leaderboardName: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1 },
  medalBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  medalText: { color: '#fff', fontWeight: '800', marginLeft: 4, fontSize: 15 },
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailScroll: { flex: 1, marginBottom: 14 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  
  formSection: { marginBottom: 24, alignItems: 'center' },
  formCard: { 
      backgroundColor: COLORS.inputBg, width: '100%', padding: 20, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  formText: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  formSubText: { color: COLORS.textMuted, marginTop: 4 },
  
  rivalsSection: { marginTop: 24, marginBottom: 10 }, 
  rivalCard: { paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  rivalTitle: { color: COLORS.label, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  rivalName: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  rivalDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  
  recordsSection: { marginTop: 24 },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recordBox: { 
      width: '48%', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderTopColor: 'rgba(255, 255, 255, 0.18)', borderLeftColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden'
  },
  recordTitle: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  recordValue: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  recordSub: { color: '#64748b', fontSize: 11, textAlign: 'center' },
  
  chartSection: { backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 14, marginTop: 8 },
  chartContainer: { height: 100, paddingBottom: 10, marginTop: 6 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { color: '#636366', fontSize: 10 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center' },
  gridLabel: { color: '#636366', fontSize: 10, position: 'absolute', left: 0, top: -14 },
  lastGamesSection: { marginTop: 24 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  rankRowDate: { color: '#AEAEB2', fontSize: 14 },
  rankBadge: { height: 24, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.30)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  rankBadgeText: { color: '#AEAEB2', fontSize: 12, fontWeight: '600' },
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
  grandSlamBox: { marginTop: 14, padding: 16, borderRadius: 16, alignItems: 'center', gap: 6, backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  // --- nov dizajn (D5) ---
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 4, paddingHorizontal: 2 },
  achRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  achIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  achIconOn: { backgroundColor: 'rgba(100,210,255,0.12)', borderColor: 'rgba(100,210,255,0.18)' },
  achIconOff: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.06)' },
  achIconOnBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,210,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(100,210,255,0.18)' },
  achTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  achState: { color: '#636366', fontSize: 11 },
  achDesc: { color: COLORS.textMuted, fontSize: 12, lineHeight: 16 },
  progressTrack: { height: 4, marginTop: 5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.primary },
  gsTitle: { color: COLORS.text, fontSize: 20, fontWeight: '600', letterSpacing: 1 },
  gsSub: { color: '#EBEBF5', fontSize: 13, textAlign: 'center' },
  gsReward: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)', width: '100%' },
  gsRewardText: { color: '#AEAEB2', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  recIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(100,210,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(100,210,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  recTitle: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  recSub: { color: COLORS.textMuted, fontSize: 11 },
  recValue: { fontSize: 19, fontWeight: '600' },
  tintCard: { flex: 1, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, gap: 2, backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  tintLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  tintValue: { color: COLORS.text, fontSize: 22, fontWeight: '600' },
  tintSub: { color: '#AEAEB2', fontSize: 11 },
});
