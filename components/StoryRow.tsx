// Vrsta krogov "Tvoji meseci · Zgodbe" v profilu igralca.
// Moder obroč = nova (še neogledana) zgodba, siv = že ogledana; zlat krog = leto.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getData } from '@/lib/dataCache';
import { storyPeriods } from '@/lib/monthStory';
import { loadSeen, isNewStory } from '@/lib/storySeen';
import { MONTH_NAMES } from '@/lib/season';
import StoryViewer from '@/components/StoryViewer';
import { emit } from '@/lib/storyEntry';

const BLUE = ['#0A84FF', '#64D2FF', '#5E5CE6'] as const;
const GOLD = ['#FFD60A', '#FF9F0A', '#FFF3B0'] as const;
const GREY = ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)'] as const;

export default function StoryRow({ name }: { name: string }) {
  const [periods, setPeriods] = useState<string[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, sn] = await Promise.all([getData(), loadSeen()]);
      if (cancelled) return;
      setPeriods(storyPeriods(d as any, name));
      setSeen(new Set(sn));
    })();
    return () => { cancelled = true; };
  }, [name]);

  if (!periods.length) return null;

  return (
    <View style={{ marginTop: 6, marginBottom: 6 }}>
      <View style={styles.head}>
        <Text style={styles.title}>Tvoji meseci</Text>
        <Text style={styles.side}>Zgodbe</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}>
        {periods.map((p, i) => {
          const year = p.length === 4;
          const isNew = isNewStory(seen, name, periods, p);
          const ring = year ? (isNew ? GOLD : GREY) : isNew ? BLUE : GREY;
          const m = year ? null : Number(p.slice(5)) - 1;
          return (
            <TouchableOpacity key={p} activeOpacity={0.75} onPress={() => setOpen(i)} style={{ alignItems: 'center', gap: 6 }}>
              <LinearGradient colors={ring as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                <View style={styles.gap}>
                  <View style={[styles.core, year && { backgroundColor: 'rgba(255,214,10,0.14)' }]}>
                    {year ? (
                      <Text style={[styles.mon, { fontSize: 14, fontWeight: '700', color: '#FFD60A' }]}>{p}</Text>
                    ) : (
                      <>
                        <Text style={styles.mon}>{MONTH_NAMES[m!].slice(0, 3).toUpperCase()}</Text>
                        <Text style={styles.yr}>{p.slice(0, 4)}</Text>
                      </>
                    )}
                  </View>
                </View>
              </LinearGradient>
              <Text style={[styles.label, isNew && { color: '#FFFFFF', fontWeight: '600' }]}>{year ? `Leto ${p}` : MONTH_NAMES[m!]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {open !== null && (
        <StoryViewer
          name={name}
          periods={periods}
          start={open}
          onClose={() => setOpen(null)}
          onSeen={p => { setSeen(prev => new Set(prev).add(`${name}|${p}`)); emit(); }} // krogec zgoraj in kartica se osvežita takoj
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  side: { fontSize: 13, color: '#8E8E93' },
  ring: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  gap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0E1420', alignItems: 'center', justifyContent: 'center' },
  core: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(40,100,200,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  mon: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', lineHeight: 17 },
  yr: { fontSize: 9, color: '#8E8E93', marginTop: 2 },
  label: { fontSize: 11, color: '#8E8E93' },
});
