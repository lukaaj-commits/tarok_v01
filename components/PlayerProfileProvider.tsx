// Omogoča, da se profil igralca odpre s katerega koli zaslona:
//   const { openProfile } = usePlayerProfile();  openProfile('Miha');
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { loadGenders } from '@/lib/gender';
import { Modal, View, ActivityIndicator } from 'react-native';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import { fetchPlayerStats, PlayerStats } from '@/lib/playerStats';
import { showAlert } from '@/lib/alert';

type Ctx = {
  openProfile: (name: string) => void;        // naloži sveže podatke in odpre profil
  showProfile: (stats: PlayerStats) => void;  // odpre profil z že naloženimi podatki
};

const PlayerProfileContext = createContext<Ctx>({ openProfile: () => {}, showProfile: () => {} });
export const usePlayerProfile = () => useContext(PlayerProfileContext);

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // spol igralcev za pravilna besedila
  useEffect(() => { loadGenders(); }, []);

  const showProfile = useCallback((stats: PlayerStats) => {
    setPlayer(stats);
    setVisible(true);
  }, []);

  const openProfile = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    try {
      const all = await fetchPlayerStats();
      const found = all.find(s => s.name === name.trim());
      if (found) showProfile(found);
      else showAlert('Profil', `Za igralca ${name} še ni statistike.`);
    } catch (e: any) {
      showAlert('Napaka', 'Profila ni bilo mogoče naložiti.');
    } finally {
      setLoading(false);
    }
  }, [showProfile]);

  return (
    <PlayerProfileContext.Provider value={{ openProfile, showProfile }}>
      {children}
      {/* Okni se ustvarita šele ob odpiranju, da sta vedno NAD ostalimi okni (lestvica, obvestila ...) */}
      {loading && (
        <Modal visible transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0A84FF" />
          </View>
        </Modal>
      )}
      {visible && <PlayerProfileModal player={player} visible={visible} onClose={() => setVisible(false)} />}
    </PlayerProfileContext.Provider>
  );
}
