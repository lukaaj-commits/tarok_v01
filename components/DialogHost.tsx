// Prikaz oken (obvestilo / potrditev) in kratkih sporočil iz lib/alert.ts
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, Platform } from 'react-native';
import { dialogStore } from '@/lib/alert';
import { T } from '@/lib/theme';

const NATIVE = Platform.OS !== 'web';

export default function DialogHost() {
  const [, force] = useState(0);
  useEffect(() => dialogStore.subscribe(() => force(n => n + 1)), []);
  const d = dialogStore.current();
  const toast = dialogStore.toast();

  // nežen prikaz kratkega sporočila
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: toast ? 1 : 0, duration: 180, useNativeDriver: NATIVE }).start();
  }, [toast?.seq, !!toast]);

  return (
    <>
      {/* Okno se ustvari šele ob prikazu, da je vedno nad ostalimi okni (npr. nad oknom igre) */}
      {d && (
      <Modal key={d.id} visible transparent animationType="fade" onRequestClose={() => dialogStore.close(false)}>
        <View style={styles.overlay}>
          {(
            <View style={styles.box}>
              <Text style={styles.title}>{d.title}</Text>
              {!!d.message && <Text style={styles.message}>{d.message}</Text>}
              <View style={styles.buttons}>
                {d.cancelText && (
                  <TouchableOpacity style={[styles.button, styles.cancel]} onPress={() => dialogStore.close(false)} activeOpacity={0.7}>
                    <Text style={styles.buttonText}>{d.cancelText}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.button, d.destructive ? styles.danger : styles.primary]} onPress={() => dialogStore.close(true)} activeOpacity={0.7}>
                  <Text style={styles.buttonText}>{d.confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
      )}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { opacity: fade }]}>
          <View style={styles.toast}><Text style={styles.toastText}>{toast.text}</Text></View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' },
  box: { backgroundColor: '#121A2B', borderRadius: 24, padding: 20, width: '90%', maxWidth: 400, borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.14)', borderTopColor: 'rgba(120,190,255,0.40)' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  message: { color: T.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  button: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.22)' },
  primary: { backgroundColor: '#0A84FF' },
  danger: { backgroundColor: '#FF453A' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center', zIndex: 9999 },
  toast: { backgroundColor: 'rgba(28,36,54,0.97)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11, borderWidth: 0.5, borderColor: 'rgba(100,170,255,0.18)', borderTopColor: 'rgba(120,190,255,0.40)', maxWidth: '88%' },
  toastText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', textAlign: 'center' },
});
