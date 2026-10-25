import { useEffect, useMemo, useRef, useState, useCallback, ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Image, ActivityIndicator, AppState, Platform, Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { computeNotifications, AppNotification, GameSummary } from '@/lib/notifications';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';

// Ta telefon si zapomni, katera obvestila je že videl
const SEEN_KEY = 'tarok_prebrana_obvestila_v1';
// ... in katera je uporabnik počistil (križec, podrs, Počisti vse)
const DISMISSED_KEY = 'tarok_pocisceno_obvestila_v1';
const MAX_ITEMS = 120;

const C = {
  bg: '#0d1321',
  card: '#1e293b',
  cardInner: '#334155',
  primary: '#556eeb',
  text: '#FFFFFF',
  muted: '#94A3B8',
  danger: '#EF4444',
  warning: '#F59E0B',
  live: '#10B981',
};

type FeedItem =
  | { type: 'live'; key: string; time: string; n: AppNotification }
  | { type: 'game'; key: string; time: string; g: GameSummary };

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
      const [g, p, e, r] = await Promise.all([
        supabase.from('games').select('id, name, created_at, is_active'),
        supabase.from('players').select('id, game_id, name, total_score'),
        supabase.from('score_entries').select('id, player_id, game_id, points, created_at, played, is_partner, is_beggar, is_valat, is_penalty'),
        supabase.from('radelci').select('player_id, game_id'),
      ]);
      if (g.error || p.error || e.error) return;
      const { live, summaries } = computeNotifications(g.data || [], p.data || [], e.data || [], r.data || []);
      const items: FeedItem[] = [
        ...live.map(n => ({ type: 'live' as const, key: n.id, time: n.time, n })),
        ...summaries.map(s => ({ type: 'game' as const, key: `game:${s.gameId}`, time: s.time, g: s })),
      ].sort((a, b) => b.time.localeCompare(a.time));
      setFeed(items);

      const storedDismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (storedDismissed) setDismissed(new Set(JSON.parse(storedDismissed)));

      // Prvi zagon na tem telefonu: vsa obstoječa obvestila štejemo kot prebrana
      const stored = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      if (stored === null) {
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

  // Prikazana obvestila = vsa, ki jih uporabnik ni počistil
  const visible = useMemo(() => feed.filter(i => !dismissed.has(i.key)).slice(0, MAX_ITEMS), [feed, dismissed]);
  const unreadKeys = useMemo(() => (seen ? visible.filter(i => !seen.has(i.key)).map(i => i.key) : []), [visible, seen]);

  const saveDismissed = (next: Set<string>) => {
    setDismissed(next);
    AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])).catch(() => {});
  };
  const dismissOne = (key: string) => saveDismissed(new Set([...dismissed, key]));
  const dismissAll = () => {
    const keys = feed.map(i => i.key);
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
    const all = new Set([...(seen || []), ...feed.map(i => i.key)]);
    setSeen(all);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...all])).catch(() => {});
  };

  const isNew = (key: string) => !!seen && !seen.has(key);

  return (
    <>
      <TouchableOpacity onPress={openFeed} style={styles.bellButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Obvestila">
        <Bell size={24} color={C.text} />
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
                <TouchableOpacity onPress={closeFeed} style={{ padding: 6 }}><X size={24} color={C.muted} /></TouchableOpacity>
              </View>
            </View>

            {loading && visible.length === 0 && feed.length === 0 ? (
              <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
            ) : visible.length === 0 ? (
              <Text style={styles.empty}>Ni novih obvestil. 🎉</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30, gap: 10 }}>
                {visible.map(item =>
                  item.type === 'live' ? (
                    <SwipeToDismiss key={item.key} onDismiss={() => dismissOne(item.key)}>
                    <TouchableOpacity activeOpacity={0.7} disabled={!item.n.player} onPress={() => item.n.player && openProfile(item.n.player)} style={[styles.card, isNew(item.key) && styles.cardNew]}>
                      <Text style={styles.icon}>{item.n.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={styles.metaRow}>
                          {item.n.kind === 'live' && <View style={styles.liveChip}><Text style={styles.liveChipText}>V ŽIVO</Text></View>}
                          <Text style={styles.time}>{timeLabel(item.time)}</Text>
                          {isNew(item.key) && <View style={styles.newDot} />}
                        </View>
                        <Text style={styles.itemTitle}>{item.n.title}</Text>
                        <Text style={styles.itemText}>{item.n.text}</Text>
                      </View>
                      {item.n.player && <Image source={{ uri: getAvatarUrl(item.n.player) }} style={styles.avatar} />}
                      <TouchableOpacity onPress={() => dismissOne(item.key)} style={styles.closeOne} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={16} color={C.muted} /></TouchableOpacity>
                    </TouchableOpacity>
                    </SwipeToDismiss>
                  ) : (
                    <SwipeToDismiss key={item.key} onDismiss={() => dismissOne(item.key)}>
                    <View style={[styles.card, styles.gameCard, isNew(item.key) && styles.cardNew]}>
                      <View style={styles.metaRow}>
                        <Text style={[styles.time, { flex: 1 }]}>Igra {item.g.gameDate} · zaključena {timeLabel(item.time)}</Text>
                        {isNew(item.key) && <View style={styles.newDot} />}
                        <TouchableOpacity onPress={() => dismissOne(item.key)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={16} color={C.muted} /></TouchableOpacity>
                      </View>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => openProfile(item.g.winners.split(' & ')[0])} style={styles.winnerRow}>
                        <Text style={styles.icon}>🏁</Text>
                        <Image source={{ uri: getAvatarUrl(item.g.winners.split(' & ')[0]) }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>Zmagovalec: {item.g.winners}</Text>
                          <Text style={styles.itemText}>{item.g.winnerScore} točk</Text>
                        </View>
                      </TouchableOpacity>
                      {item.g.awards.length > 0 && <Text style={styles.awards}>{item.g.awards.join('   ')}</Text>}
                      {item.g.items.map(n => (
                        <TouchableOpacity key={n.id} activeOpacity={0.7} disabled={!n.player} onPress={() => n.player && openProfile(n.player)} style={styles.subItem}>
                          <Text style={styles.subIcon}>{n.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.subTitle}>{n.title}</Text>
                            <Text style={styles.itemText}>{n.text}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    </SwipeToDismiss>
                  )
                )}
                <Text style={styles.hint}>Podrsaj obvestilo levo ali desno, da ga počistiš.</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: { marginRight: 16, padding: 4 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '88%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: C.text, fontSize: 22, fontWeight: '700' },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.cardInner, borderRadius: 14, padding: 14, paddingRight: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardNew: { borderColor: C.primary },
  gameCard: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  icon: { fontSize: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  liveChip: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  liveChipText: { color: C.live, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  time: { color: C.muted, fontSize: 12 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  itemTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  itemText: { color: C.muted, fontSize: 14, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  awards: { color: C.muted, fontSize: 13, lineHeight: 20 },
  subItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 10, padding: 10 },
  subIcon: { fontSize: 20 },
  subTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  closeOne: { position: 'absolute', top: 8, right: 8, padding: 2 },
  clearAll: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  clearAllText: { color: C.text, fontSize: 13, fontWeight: '600' },
  hint: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 6 },
});
