// Vstop v zgodbo prejšnjega meseca:
//  - StoryEntryHost (enkrat v _layout): odpre zgodbo; če telefon še ne ve, kdo si, najprej vpraša "Kdo si?"
//  - HomeStoryCard: kartica "Oktober je za nami" na začetnem zaslonu
//  - useStoryEntry: ali je vstop trenutno viden (uporablja tudi zvonec)
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { getData } from '@/lib/dataCache';
import { storyPeriods } from '@/lib/monthStory';
import { loadSeen } from '@/lib/storySeen';
import { computeEntry, onOpenStory, onStoryChange, emit, storyNow, StoryEntry } from '@/lib/storyEntry';
import { MONTH_NAMES, MONTH_LOCATIVE } from '@/lib/season';
import { getAvatarUrl } from '@/lib/avatars';
import { showToast } from '@/lib/alert';
import { g } from '@/lib/gender';
import StoryViewer from '@/components/StoryViewer';
import { WhoAmISheet, getMyPlayer, useMyPlayer } from '@/components/WhoAmI';

const BLUE = ['#0A84FF', '#64D2FF', '#5E5CE6'] as const;
const GOLD = ['#FFD60A', '#FF9F0A', '#FFF3B0'] as const;

// ali je vstop viden (osveži se ob spremembah: ogledano, izbran igralec)
export function useStoryEntry() {
  const me = useMyPlayer();
  const [entry, setEntry] = useState<StoryEntry | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [d, seen] = await Promise.all([getData(), loadSeen()]);
      setEntry(computeEntry(d, me, seen, storyNow()));
    } catch { setEntry(null); }
  }, [me]);
  useEffect(() => { refresh(); return onStoryChange(refresh); }, [refresh]);
  return { entry, me, refresh };
}

export function StoryEntryHost() {
  const [who, setWho] = useState(false);
  const [story, setStory] = useState<{ name: string; periods: string[]; start: number } | null>(null);

  const startFor = async (name: string) => {
    const d = await getData();
    const now = storyNow();
    const e = computeEntry(d, name, new Set(), now);
    const periods = storyPeriods(d as any, name, now);
    if (!e || !periods.includes(e.target)) {
      // izbrani igralec v tistem mesecu ni igral
      const m = now.getMonth();
      showToast(m === 0 ? `Lani ${g(name, 'nisi igral', 'nisi igrala')}.` : `V ${MONTH_LOCATIVE[(m + 11) % 12]} ${g(name, 'nisi igral', 'nisi igrala')}.`);
      emit();
      return;
    }
    setStory({ name, periods, start: periods.indexOf(e.target) });
  };

  useEffect(() => onOpenStory(async () => {
    const me = await getMyPlayer();
    if (me) startFor(me); else setWho(true);
  }), []);

  return (
    <>
      {who && (
        <WhoAmISheet
          onClose={() => setWho(false)}
          onPick={name => { setWho(false); if (name) startFor(name); }}
        />
      )}
      {story && (
        <StoryViewer
          name={story.name}
          periods={story.periods}
          start={story.start}
          onClose={() => { setStory(null); emit(); }}
          onSeen={() => emit()}
        />
      )}
    </>
  );
}

// kartica na začetnem zaslonu (spodaj, nad menijem)
export function HomeStoryCard({ onOpen }: { onOpen: () => void }) {
  const { entry, me } = useStoryEntry();
  if (!entry) return null;
  const month = entry.year ? entry.target : MONTH_NAMES[Number(entry.target.slice(5)) - 1].slice(0, 3).toUpperCase();
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onOpen} style={styles.card}>
      <LinearGradient colors={(entry.year ? GOLD : BLUE) as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
        <View style={styles.gap}>
          {me ? (
            <Image source={{ uri: getAvatarUrl(me) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.monthCore]}><Text style={[styles.month, entry.year && { color: '#FFD60A' }]}>{month}</Text></View>
          )}
        </View>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{entry.title}</Text>
        <Text style={styles.sub}>{entry.sub}</Text>
      </View>
      <ChevronRight size={18} color="#636366" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: 'rgba(40,100,200,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)' },
  ring: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  gap: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#1C1C1E' },
  monthCore: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,100,200,0.25)' },
  month: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  title: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  sub: { fontSize: 13, color: '#8E8E93', marginTop: 1 },
});
