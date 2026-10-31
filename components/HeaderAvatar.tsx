// Krog s sliko igralca tega telefona v glavi zaslona (desno ob zvoncu).
// Tap odpre tvoj profil; če telefon še ne ve, kdo si, najprej "Kdo si?".
// Moder obroč = čaka te nova (neogledana) zgodba.
import { useEffect, useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Platform, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'lucide-react-native';
import { getAvatarUrl } from '@/lib/avatars';
import { usePlayerProfile } from '@/components/PlayerProfileProvider';
import { WhoAmISheet, useMyPlayer, verifyMyPlayer } from '@/components/WhoAmI';
import { getData } from '@/lib/dataCache';
import { storyPeriods } from '@/lib/monthStory';
import { loadSeen, isNewStory } from '@/lib/storySeen';
import { onStoryChange } from '@/lib/storyEntry';

const SIZE = 34;

export default function HeaderAvatar() {
  const me = useMyPlayer();
  const { openProfile } = usePlayerProfile();
  const [who, setWho] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  // ob odprtju in ob vrnitvi v aplikacijo preverimo, ali je ime prevzel drug telefon
  useEffect(() => {
    verifyMyPlayer();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') verifyMyPlayer(); });
    const onVis = () => { if (document.visibilityState === 'visible') verifyMyPlayer(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVis);
    return () => { sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // ali čaka nova zgodba (moder obroč)
  useEffect(() => {
    if (!me) { setHasNew(false); return; }
    let cancelled = false;
    const check = async () => {
      try {
        const [d, seen] = await Promise.all([getData(), loadSeen()]);
        const periods = storyPeriods(d as any, me);
        if (!cancelled) setHasNew(periods.some(p => isNewStory(seen, me, periods, p)));
      } catch {}
    };
    check();
    const off = onStoryChange(check);
    return () => { cancelled = true; off(); };
  }, [me]);

  const onPress = () => { if (me) openProfile(me); else setWho(true); };

  return (
    <>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }} accessibilityLabel={me ? `Moj profil (${me})` : 'Kdo si?'}>
        {!me ? (
          <View style={[styles.circle, styles.empty]}><User size={18} color="#8E8E93" strokeWidth={2} /></View>
        ) : hasNew ? (
          <LinearGradient colors={['#0A84FF', '#64D2FF', '#5E5CE6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
            <View style={styles.gap}><Image source={{ uri: getAvatarUrl(me) }} style={styles.inner} /></View>
          </LinearGradient>
        ) : (
          <View style={styles.plain}><Image source={{ uri: getAvatarUrl(me) }} style={styles.photo} /></View>
        )}
      </TouchableOpacity>
      {who && <WhoAmISheet onClose={() => setWho(false)} onPick={n => { setWho(false); if (n) openProfile(n); }} />}
    </>
  );
}

const styles = StyleSheet.create({
  btn: { marginRight: 16, width: SIZE + 4, height: SIZE + 4, alignItems: 'center', justifyContent: 'center' },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  empty: { backgroundColor: 'rgba(118,118,128,0.24)', alignItems: 'center', justifyContent: 'center' },
  plain: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, padding: 1.5, backgroundColor: 'rgba(255,255,255,0.18)' },
  photo: { flex: 1, borderRadius: SIZE / 2, backgroundColor: '#1C1C1E' },
  ring: { width: SIZE + 4, height: SIZE + 4, borderRadius: (SIZE + 4) / 2, alignItems: 'center', justifyContent: 'center' },
  gap: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  inner: { width: SIZE - 6, height: SIZE - 6, borderRadius: (SIZE - 6) / 2, backgroundColor: '#1C1C1E' },
});
