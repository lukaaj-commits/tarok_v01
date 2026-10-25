// Dvorana slavnih - seznam rekordov vseh časov (zavihek "Rekordi" v lestvici)
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { computeRecords, HallRecord } from '@/lib/records';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';

export default function HallOfFame() {
  const { openProfile } = usePlayerProfile();
  const [records, setRecords] = useState<HallRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, p, e] = await Promise.all([
        supabase.from('games').select('id, created_at'),
        supabase.from('players').select('id, game_id, name, total_score'),
        supabase.from('score_entries').select('id, player_id, game_id, points, created_at, is_valat, is_beggar'),
      ]);
      if (!cancelled && !g.error && !p.error && !e.error) setRecords(computeRecords(g.data || [], p.data || [], e.data || []));
    })();
    return () => { cancelled = true; };
  }, []);

  if (!records) return <ActivityIndicator size="large" color="#556eeb" style={{ marginTop: 30 }} />;

  return (
    <View style={{ gap: 10 }}>
      {records.map(r => (
        <TouchableOpacity key={r.id} activeOpacity={0.7} disabled={!r.holders.length} onPress={() => r.holders[0] && openProfile(r.holders[0])} style={styles.card}>
          <Text style={styles.icon}>{r.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{r.title}</Text>
            {r.holders.length > 0 && <Text style={styles.holder}>{r.holders.join(' & ')}</Text>}
            {!!r.detail && <Text style={styles.detail}>{r.detail}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {r.holders.length > 0 && (
              <View style={{ flexDirection: 'row' }}>
                {r.holders.slice(0, 3).map((h, i) => (
                  <Image key={h} source={{ uri: getAvatarUrl(h) }} style={[styles.avatar, i > 0 && { marginLeft: -10 }]} />
                ))}
              </View>
            )}
            <Text style={styles.value}>{r.value}</Text>
          </View>
        </TouchableOpacity>
      ))}
      <Text style={styles.note}>Ko nekdo podre rekord, se tukaj zamenja samodejno.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#334155', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  icon: { fontSize: 26 },
  title: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  holder: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 2 },
  detail: { color: '#64748b', fontSize: 12, marginTop: 2 },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#1e293b', backgroundColor: '#1e293b' },
  value: { color: '#ffd700', fontSize: 15, fontWeight: '800', textAlign: 'right', maxWidth: 120 },
  note: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 10 },
});
