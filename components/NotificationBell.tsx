import { useEffect, useMemo, useRef, useState, useCallback, ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Image, ActivityIndicator, AppState, Platform, Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, X, Trophy } from 'lucide-react-native';
import { PulseRings, PulseDot } from './Pulse';
import { getData } from '@/lib/dataCache';
import PullToRefresh from './PullToRefresh';
import { supabase } from '@/lib/supabase';
import { computeNotifications, AppNotification, GameSummary } from '@/lib/notifications';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import { loadGenders, g } from '@/lib/gender';
import TintBg from '@/components/TintBg';
import { LinearGradient } from 'expo-linear-gradient';
import { useStoryEntry } from '@/components/StoryEntry';
import { openStoryFlow, StoryEntry } from '@/lib/storyEntry';
import { MONTH_NAMES } from '@/lib/season';

// Ta telefon si zapomni, katera obvestila je že videl
// v2: ob posodobitvi aplikacije (nov dizajn) se vsa obstoječa obvestila štejejo kot prebrana,
// zato uporabnik po posodobitvi nima nobenega novega obvestila. Ob novi verziji ključa se to ponovi.
const SEEN_KEY = 'tarok_prebrana_obvestila_v2';
// Obvestila se prikazujejo samo od tega dne naprej (starejša se ne pokažejo)
const NOTIF_START = new Date(2026, 9, 26, 0, 0, 0).toISOString(); // 26. 10. 2026
// Vsak telefon si ob prvem odprtju zapomni ta dan: obvestila se kažejo samo od tega dne naprej,
// tako nihče ne dobi starih obvestil za nazaj (tudi če aplikacijo odpre šele čez nekaj dni)
const FIRST_OPEN_KEY = 'tarok_obvestila_od_v1';
async function notifCutoff(): Promise<string> {
  let first = await AsyncStorage.getItem(FIRST_OPEN_KEY).catch(() => null);
  if (!first) {
    const d = new Date();
    first = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
    await AsyncStorage.setItem(FIRST_OPEN_KEY, first).catch(() => {});
  }
  return first > NOTIF_START ? first : NOTIF_START;
}
const OLD_SEEN_KEYS = ['tarok_prebrana_obvestila_v1'];
// ... in katera je uporabnik počistil (križec, podrs, Počisti vse)
const DISMISSED_KEY = 'tarok_pocisceno_obvestila_v1';
const MAX_ITEMS = 120;

const C = {
  bg: '#000000',
  card: '#121A2B',
  cardInner: 'rgba(255,255,255,0.08)',
  primary: '#0A84FF',
  text: '#FFFFFF',
  muted: '#8E8E93',
  danger: '#FF453A',
  warning: '#FF9F0A',
  live: '#FF453A',
};

// emojiji se v obvestilih ne prikazujejo (besedila ostanejo enaka)
const clean = (t: string) => (t || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();

type FeedItem =
  | { type: 'live'; key: string; time: string; n: AppNotification }
  | { type: 'game'; key: string; time: string; g: GameSummary }
  | { type: 'story'; key: string; time: string; e: StoryEntry; me: string | null };

// Starejša obvestila so imela ključ brez igre na koncu. Da se ob posodobitvi ne pokažejo
// znova kot nova (ali znova po tem, ko si jih zaprl), za obvestila pred to spremembo
// upoštevamo tudi stari ključ.
const LEGACY_BEFORE = '2026-10-25T21:30:00Z';
const UUID_SUFFIX = /:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const inSet = (set: Set<string>, item: FeedItem) => {
  if (set.has(item.key)) return true;
  if (item.type !== 'live' || item.time >= LEGACY_BEFORE || !UUID_SUFFIX.test(item.key)) return false;
  return set.has(item.key.replace(UUID_SUFFIX, ''));
};

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric' })} ob ${d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`;
};

// Kartica, ki jo lahko podrsaš levo ali desno, da jo počistiš
function SwipeToDismiss({ onDismiss, children }: { onDismiss: () => void; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const responder = useRef(
    PanResponder.create({
      // prevzamemo samo vodoravni poteg (navpično ostane drsenje seznama)
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 80 || Math.abs(g.vx) > 0.8) {
          Animated.timing(x, { toValue: g.dx > 0 ? 600 : -600, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(onDismiss);
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start(),
    })
  ).current;
  const opacity = x.interpolate({ inputRange: [-250, 0, 250], outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' });
  return (
    <Animated.View style={[{ transform: [{ translateX: x }], opacity }, Platform.OS === 'web' && ({ userSelect: 'none', cursor: 'grab' } as any)]} {...responder.panHandlers}>
      {children}
    </Animated.View>
  );
}

export default function NotificationBell() {
  const { openProfile } = usePlayerProfile();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const channelName = useRef(`zvoncek-${Math.random().toString(36).slice(2)}`).current;

  const load = useCallback(async () => {
    try {
      await loadGenders();
      // podatki iz skupnega pomnilnika (po prvem nalaganju se prenese samo novo)
      const d = await getData();
      const { live, summaries } = computeNotifications(d.games, d.players, d.entries, d.radelci);
      // prikažemo samo obvestila od dneva prvega odprtja na tem telefonu naprej (izračun pa upošteva vso zgodovino)
      const cutoff = await notifCutoff();
      const items: FeedItem[] = [
        ...live.filter(n => n.time >= cutoff).map(n => ({ type: 'live' as const, key: n.id, time: n.time, n })),
        ...summaries.filter(s => s.time >= cutoff).map(s => ({ type: 'game' as const, key: `game:${s.gameId}`, time: s.time, g: s })),
      ].sort((a, b) => b.time.localeCompare(a.time));
      setFeed(items);

      const storedDismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (storedDismissed) setDismissed(new Set(JSON.parse(storedDismissed)));

      // Prvi zagon na tem telefonu: vsa obstoječa obvestila štejemo kot prebrana
      const stored = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      if (stored === null) {
        OLD_SEEN_KEYS.forEach(k => AsyncStorage.removeItem(k).catch(() => {}));
        const all = new Set(items.map(i => i.key));
        await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...all])).catch(() => {});
        setSeen(all);
      } else {
        setSeen(new Set(JSON.parse(stored)));
      }
    } catch (err) {
      console.error('Napaka pri obvestilih:', err);
    }
  }, []);

  // Nalaganje + osveževanje v živo (ob vsaki spremembi točk ali koncu igre)
  useEffect(() => {
    load();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 1500);
    };
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, refresh)
      .subscribe();
    const appStateSub = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      appStateSub.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, channelName]);

  // zgodba prejšnjega meseca (prvih 7 dni v mesecu) je vedno na vrhu
  const { entry, me } = useStoryEntry();
  const feedAll = useMemo<FeedItem[]>(() => {
    if (!entry) return feed;
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    return [{ type: 'story' as const, key: `story:${entry.target}`, time: first, e: entry, me }, ...feed];
  }, [feed, entry, me]);

  // Prikazana obvestila = vsa, ki jih uporabnik ni počistil
  const visible = useMemo(() => feedAll.filter(i => !inSet(dismissed, i)).slice(0, MAX_ITEMS), [feedAll, dismissed]);
  const unreadKeys = useMemo(() => (seen ? visible.filter(i => !inSet(seen, i)).map(i => i.key) : []), [visible, seen]);

  // Val okoli zvonca, ko pride novo obvestilo (ne ob prvem nalaganju)
  const [bellPulse, setBellPulse] = useState(0);
  const prevUnread = useRef<number | null>(null);
  useEffect(() => {
    if (!seen) return;
    const n = unreadKeys.length;
    if (prevUnread.current !== null && n > prevUnread.current) setBellPulse(p => p + 1);
    prevUnread.current = n;
  }, [unreadKeys.length, seen]);

  const saveDismissed = (next: Set<string>) => {
    setDismissed(next);
    AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])).catch(() => {});
  };
  const dismissOne = (key: string) => saveDismissed(new Set([...dismissed, key]));
  const dismissAll = () => {
    const keys = feedAll.map(i => i.key);
    saveDismissed(new Set([...dismissed, ...keys]));
    const allSeen = new Set([...(seen || []), ...keys]);
    setSeen(allSeen);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...allSeen])).catch(() => {});
  };

  const openFeed = async () => {
    setOpen(true);
    setLoading(true);
    await load();
    setLoading(false);
  };

  // Ob zaprtju označimo vse kot prebrano
  const closeFeed = async () => {
    setOpen(false);
    const all = new Set([...(seen || []), ...feedAll.map(i => i.key)]);
    setSeen(all);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...all])).catch(() => {});
  };

  const isNew = (item: FeedItem) => !!seen && !inSet(seen, item);

  return (
    <>
      <TouchableOpacity onPress={openFeed} style={styles.bellButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Obvestila">
        {bellPulse > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%' }}>
            <PulseRings key={bellPulse} size={30} color={C.primary} times={1} scaleTo={1.9} />
          </View>
        )}
        <Bell size={23} color={C.primary} strokeWidth={1.9} />
        {unreadKeys.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadKeys.length > 99 ? '99+' : unreadKeys.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={closeFeed}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Obvestila</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {visible.length > 0 && (
                  <TouchableOpacity onPress={dismissAll} style={styles.clearAll}><Text style={styles.clearAllText}>Počisti vse</Text></TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeFeed} style={styles.closeCircle}><X size={15} color="#AEAEB2" strokeWidth={3} /></TouchableOpacity>
              </View>
            </View>

            {loading && visible.length === 0 && feed.length === 0 ? (
              <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
            ) : visible.length === 0 ? (
              <Text style={styles.empty}>Ni novih obvestil.</Text>
            ) : (
              <PullToRefresh onRefresh={load}>{(scrollProps) => (
              <ScrollView {...scrollProps} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                {visible.map(item =>
                  item.type === 'story' ? (
                    <SwipeToDismiss key={item.key} onDismiss={() => dismissOne(item.key)}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { closeFeed(); setTimeout(openStoryFlow, 350); }} style={[styles.card, { alignItems: 'center', gap: 12 }]}>
                      <LinearGradient colors={(item.e.year ? ['#FFD60A', '#FF9F0A', '#FFF3B0'] : ['#0A84FF', '#64D2FF', '#5E5CE6']) as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storyRing}>
                        <View style={styles.storyGap}>
                          {item.me
                            ? <Image source={{ uri: getAvatarUrl(item.me) }} style={styles.storyAvatar} />
                            : <View style={[styles.storyAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,100,200,0.25)' }]}><Text style={{ fontSize: 9, fontWeight: '700', color: item.e.year ? '#FFD60A' : '#FFFFFF' }}>{item.e.year ? item.e.target : MONTH_NAMES[Number(item.e.target.slice(5)) - 1].slice(0, 3).toUpperCase()}</Text></View>}
                        </View>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <View style={styles.metaRow}>
                          {isNew(item) && <View style={styles.newDot} />}
                          <Text style={styles.time}>Zgodba</Text>
                        </View>
                        <Text style={styles.itemTitle}>{item.me ? (item.e.year ? `Tvoje leto ${item.e.target} je pripravljeno` : `Tvoj ${MONTH_NAMES[Number(item.e.target.slice(5)) - 1].toLowerCase()} je pripravljen`) : item.e.title}</Text>
                        <Text style={styles.itemText}>{item.me ? 'Tapni in poglej svojo zgodbo' : item.e.sub}</Text>
                      </View>
                      <TouchableOpacity onPress={() => dismissOne(item.key)} style={styles.closeOne} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={13} color={C.muted} strokeWidth={3} /></TouchableOpacity>
                    </TouchableOpacity>
                    </SwipeToDismiss>
                  ) : item.type === 'live' ? (
                    <SwipeToDismiss key={item.key} onDismiss={() => dismissOne(item.key)}>
                    <TouchableOpacity activeOpacity={0.7} disabled={!item.n.player} onPress={() => item.n.player && openProfile(item.n.player)} style={styles.card}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.metaRow}>
                          {isNew(item) && <View style={styles.newDot} />}
                          {item.n.kind === 'live' && <View style={styles.liveChip}><PulseDot color={C.live} size={5} /><Text style={styles.liveChipText}>V ŽIVO</Text></View>}
                          <Text style={styles.time}>{timeLabel(item.time)}</Text>
                        </View>
                        <Text style={styles.itemTitle}>{clean(item.n.title)}</Text>
                        <Text style={styles.itemText}>{clean(item.n.text)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => dismissOne(item.key)} style={styles.closeOne} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={13} color={C.muted} strokeWidth={3} /></TouchableOpacity>
                    </TouchableOpacity>
                    </SwipeToDismiss>
                  ) : (
                    <SwipeToDismiss key={item.key} onDismiss={() => dismissOne(item.key)}>
                    <View style={[styles.card, styles.gameCard]}>
                      <View style={styles.metaRow}>
                        {isNew(item) && <View style={styles.newDot} />}
                        <Text style={[styles.time, { flex: 1 }]}>Igra {item.g.gameDate} · zaključena {timeLabel(item.time)}</Text>
                        <TouchableOpacity onPress={() => dismissOne(item.key)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={13} color={C.muted} strokeWidth={3} /></TouchableOpacity>
                      </View>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => openProfile(item.g.winners.split(' & ')[0])} style={styles.winnerRow}>
                        <TintBg />
                        <Trophy size={20} color="#FFD60A" />
                        <Image source={{ uri: getAvatarUrl(item.g.winners.split(' & ')[0]) }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{item.g.winners.includes(' & ') ? 'Zmagovalci' : g(item.g.winners, 'Zmagovalec', 'Zmagovalka')}: {item.g.winners}</Text>
                          <Text style={styles.itemText}>{item.g.winnerScore} točk</Text>
                        </View>
                      </TouchableOpacity>
                      {item.g.awards.length > 0 && <Text style={styles.awards}>{item.g.awards.map(clean).join(' · ')}</Text>}
                      {item.g.items.map(n => (
                        <TouchableOpacity key={n.id} activeOpacity={0.7} disabled={!n.player} onPress={() => n.player && openProfile(n.player)} style={styles.subItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.subTitle}>{clean(n.title)}</Text>
                            <Text style={styles.itemText}>{clean(n.text)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    </SwipeToDismiss>
                  )
                )}
                <Text style={styles.hint}>Podrsaj obvestilo levo ali desno, da ga počistiš.</Text>
              </ScrollView>
              )}</PullToRefresh>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: { marginRight: 16, padding: 4 },
  badge: { position: 'absolute', top: -3, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10, height: '88%', borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: C.text, fontSize: 21, fontWeight: '600' },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingRight: 26, paddingLeft: 0, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)', backgroundColor: C.card },
  cardNew: {},
  gameCard: { flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingRight: 0 },
  icon: { fontSize: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  liveChip: { backgroundColor: 'rgba(255,69,58,0.16)', borderRadius: 9, paddingHorizontal: 6, height: 18, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveChipText: { color: C.live, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  time: { color: '#636366', fontSize: 11 },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  itemTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  itemText: { color: '#AEAEB2', fontSize: 13, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'rgba(255,255,255,0.24)' },
  awards: { color: C.muted, fontSize: 12, lineHeight: 18 },
  subItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  subIcon: { fontSize: 20 },
  subTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  closeOne: { position: 'absolute', top: 12, right: 0, padding: 4 },
  clearAll: { paddingHorizontal: 4, paddingVertical: 6 },
  clearAllText: { color: C.primary, fontSize: 13, fontWeight: '500' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#636366', fontSize: 11, textAlign: 'center', marginTop: 14 },
  storyRing: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  storyGap: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  storyAvatar: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#1C1C1E' },
});
