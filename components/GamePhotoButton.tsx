// Gumb "📸 Slika večera": doda sliko igre, ali jo pokaže (z možnostjo Zamenjaj)
import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { photoSupported, pickImage, compressImage, uploadGamePhoto } from '@/lib/photo';
import { showAlert } from '@/lib/alert';
import { Camera } from 'lucide-react-native';

// iPhone/iPad: sistem sam ponudi izbiro (galerija, kamera, datoteka), zato našega okna ne kažemo
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const n: any = navigator;
  return /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
};

type Props = {
  gameId: string;
  photoUrl?: string | null;
  title?: string;                       // npr. "Tarok, 24. 10. 2026"
  onChange?: (url: string) => void;     // nova povezava po nalaganju
  onPress?: () => void;                 // npr. ustavi samodejno zapiranje okna
  style?: StyleProp<ViewStyle>;
};

export default function GamePhotoButton({ gameId, photoUrl, title, onChange, onPress, style }: Props) {
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [chooser, setChooser] = useState(false); // izbira: kamera ali galerija
  const [url, setUrl] = useState<string | null>(photoUrl || null);
  const current = url || photoUrl || null;

  const chooseAndUpload = async (source: 'camera' | 'gallery') => {
    setChooser(false);
    if (!photoSupported()) { showAlert('Slika večera', 'Nalaganje slike deluje v brskalniku (spletna aplikacija).'); return; }
    const file = await pickImage(source);
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const newUrl = await uploadGamePhoto(gameId, blob);
      setUrl(newUrl);
      onChange?.(newUrl);
    } catch (e: any) {
      showAlert('Napaka', 'Slike ni bilo mogoče naložiti: ' + (e?.message || e));
    } finally {
      setUploading(false);
    }
  };

  // izbira slike: na iPhonu takoj sistemski meni, drugje naše okno (Slikaj zdaj / Iz galerije)
  const openChooser = () => { if (isIOS()) chooseAndUpload('gallery'); else setChooser(true); };

  const press = () => {
    onPress?.();
    if (uploading) return;
    if (current) setViewer(true); else openChooser();
  };

  return (
    <>
      <TouchableOpacity onPress={press} activeOpacity={0.8} style={[styles.button, current ? styles.buttonHas : styles.buttonEmpty, style]}>
        {uploading ? (
          <><ActivityIndicator size="small" color="#fff" /><Text style={styles.text}>Nalagam …</Text></>
        ) : (
          // ko je slika že naložena: zelen gumb brez ikone fotoaparata
          current ? <Text style={styles.text}>Slika večera</Text> : <><Camera size={19} color="#fff" /><Text style={styles.text}>Slika večera</Text></>
        )}
      </TouchableOpacity>

      {chooser && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setChooser(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setChooser(false)} style={styles.chooserOverlay}>
            <View style={styles.chooserBox}>
              <Text style={styles.chooserTitle}>Slika večera</Text>
              <TouchableOpacity style={[styles.cButton, styles.close]} onPress={() => chooseAndUpload('camera')}><Text style={styles.vText}>Slikaj zdaj</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.cButton, styles.replace]} onPress={() => chooseAndUpload('gallery')}><Text style={styles.vText}>Iz galerije</Text></TouchableOpacity>
              <TouchableOpacity style={{ padding: 10, alignItems: 'center' }} onPress={() => setChooser(false)}><Text style={{ color: '#8E8E93', fontSize: 15 }}>Prekliči</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {viewer && current && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewer(false)}>
          <View style={styles.overlay}>
            <Image source={{ uri: current }} style={styles.photo} resizeMode="contain" />
            {!!title && <Text style={styles.title}>{title}</Text>}
            <View style={styles.row}>
              <TouchableOpacity style={[styles.vButton, styles.replace]} disabled={uploading} onPress={openChooser}>
                {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.vText}>Zamenjaj</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vButton, styles.close]} onPress={() => setViewer(false)}>
                <Text style={styles.vText}>Zapri</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 0.5 },
  buttonEmpty: { backgroundColor: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)' },
  buttonHas: { backgroundColor: '#30D158', borderColor: '#30D158' },
  text: { color: '#fff', fontSize: 16, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  photo: { width: '100%', height: '75%' },
  title: { color: '#cbd5e1', fontSize: 15, marginTop: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 18, width: '100%', maxWidth: 420 },
  vButton: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  replace: { backgroundColor: 'rgba(255,255,255,0.12)' },
  close: { backgroundColor: '#0A84FF' },
  cButton: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chooserOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  chooserBox: { backgroundColor: '#121A2B', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28, gap: 10, borderWidth: 0.5, borderBottomWidth: 0, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  chooserTitle: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
});
