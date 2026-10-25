// Dvorana slavnih - seznam rekordov vseh časov (zavihek "Rekordi" v lestvici)
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { computeRecords, HallRecord } from '@/lib/records';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import { TrendingUp, TrendingDown, Plus, Minus, Crown, Trophy, Layers, Sigma, Zap, Hand, Flame, Timer, Award } from 'lucide-react-native';

// tanke ikone namesto emojijev (po vrsti rekorda)
const ICONS: Record<string, any> = {
  'best-game': TrendingUp, 'worst-game': TrendingDown, 'best-entry': Plus, 'worst-entry': Minus,
  margin: Crown, wins: Trophy, games: Layers, career: Sigma, valats: Zap, beggars: Hand, streak: Flame, marathon: Timer,
};
const valueColor = (v: string) => (v.startsWith('-') || v.startsWith('−') ? '#FF453A' : v.startsWith('+') ? '#30D158' : '#FFFFFF');

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

  if (!records) return <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 30 }} />;

  return (
    <View>
      {records.map(r => (
        <TouchableOpacity key={r.id} activeOpacity={0.7} disabled={!r.holders.length} onPress={() => r.holders[0] && openProfile(r.holders[0])} style={styles.card}>
          {(() => { const Ic = ICONS[r.id] || Award; return <View style={styles.iconBox}><Ic size={18} color="#64D2FF" strokeWidth={2} /></View>; })()}
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
            <Text style={[styles.value, { color: valueColor(String(r.value)) }]}>{r.value}</Text>
          </View>
        </TouchableOpacity>
      ))}
      <Text style={styles.note}>Ko nekdo podre rekord, se tukaj zamenja samodejno.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)' },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(100,210,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(100,210,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#8E8E93', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  holder: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 1 },
  detail: { color: '#636366', fontSize: 11, marginTop: 1 },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#121A2B', backgroundColor: '#1C2233' },
  value: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'right', maxWidth: 120 },
  note: { color: '#636366', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 10 },
});
