// Slika v glavi profila. Na SVOJEM profilu (ime, izbrano na tem telefonu) ima spodaj desno
// moder krogec s fotoaparatom: zamenjaj sliko (kamera / galerija) ali vrni prejšnjo.
import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ActivityIndicator, StyleSheet, StyleProp, ImageStyle } from 'react-native';
import { Camera } from 'lucide-react-native';
import { getAvatarUrl, hasCustomAvatar, setCustomAvatar, useAvatarVersion } from '@/lib/avatars';
import { photoSupported, pickImage, cropSquare, uploadProfilePhoto, removeProfilePhoto } from '@/lib/photo';
import { showAlert, showToast } from '@/lib/alert';
import { useMyPlayer } from '@/components/WhoAmI';

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const n: any = navigator;
  return /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
};

export default function ProfileAvatar({ name, style }: { name: string; style?: StyleProp<ImageStyle> }) {
  useAvatarVersion(); // ob menjavi slike se takoj osveži
  const me = useMyPlayer();
  const mine = !!me && me === name;
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const choose = async (source: 'camera' | 'gallery') => {
    setMenu(false);
    if (!photoSupported()) { showAlert('Profilna slika', 'Nalaganje slike deluje v brskalniku (spletna aplikacija).'); return; }
    const file = await pickImage(source);
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadProfilePhoto(name, await cropSquare(file));
      setCustomAvatar(name, url);
      showToast('Slika je zamenjana.');
    } catch (e: any) {
      showAlert('Napaka', 'Slike ni bilo mogoče naložiti: ' + (e?.message || e));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setMenu(false);
    setBusy(true);
    try {
      await removeProfilePhoto(name);
      setCustomAvatar(name, null);
      showToast('Vrnjena je prejšnja slika.');
    } catch (e: any) {
      showAlert('Napaka', 'Slike ni bilo mogoče odstraniti: ' + (e?.message || e));
    } finally { setBusy(false); }
  };

  const img = <Image source={{ uri: getAvatarUrl(name) }} style={style} />;
  if (!mine) return img;

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => !busy && setMenu(true)} accessibilityLabel="Zamenjaj profilno sliko">
        {img}
        {busy && <View style={[StyleSheet.absoluteFill, styles.busy]}><ActivityIndicator color="#fff" /></View>}
        <View style={styles.badge}><Camera size={12} color="#fff" strokeWidth={2.4} /></View>
      </TouchableOpacity>

      {menu && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMenu(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setMenu(false)} style={styles.overlay}>
            <View style={styles.box}>
              <Text style={styles.title}>Profilna slika</Text>
              {isIOS() ? (
                // iPhone sam ponudi kamero ali galerijo
                <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => choose('gallery')}><Text style={styles.btnText}>Izberi sliko</Text></TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => choose('camera')}><Text style={styles.btnText}>Slikaj zdaj</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => choose('gallery')}><Text style={styles.btnText}>Iz galerije</Text></TouchableOpacity>
                </>
              )}
              {hasCustomAvatar(name) && (
                <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={remove}><Text style={[styles.btnText, { color: '#FF453A' }]}>Vrni prejšnjo sliko</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={{ padding: 10, alignItems: 'center' }} onPress={() => setMenu(false)}><Text style={{ color: '#8E8E93', fontSize: 15 }}>Prekliči</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0A84FF', borderWidth: 2, borderColor: '#121A2B', alignItems: 'center', justifyContent: 'center' },
  busy: { borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  box: { backgroundColor: '#121A2B', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28, gap: 10, borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#0A84FF' },
  secondary: { backgroundColor: 'rgba(255,255,255,0.12)' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
