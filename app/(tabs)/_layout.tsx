import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Trophy, History } from 'lucide-react-native';
import NotificationBell from '@/components/NotificationBell';
import { T } from '@/lib/theme';
import { ScreenWithGlow } from '@/components/AppBackground';

export default function TabLayout() {
  return (
    <Tabs
      // vsak zavihek dobi svoje neprosojno ozadje s sijem
      screenLayout={({ children }) => <ScreenWithGlow>{children}</ScreenWithGlow>}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: T.bg,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTransparent: false,
        headerShadowVisible: false,
        headerTintColor: T.text,
        headerTitleStyle: { fontSize: 20, fontWeight: '600' },
        headerRight: () => <NotificationBell />,
        sceneStyle: { backgroundColor: T.bg },
        tabBarStyle: {
          backgroundColor: T.tabBar,
          borderTopColor: T.tabBorder,
          borderTopWidth: 0.5,
          // na spletu je privzeta višina premajhna za pisavo Poppins
          ...(Platform.OS === 'web' ? { height: 62, paddingTop: 6, paddingBottom: 8 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, minHeight: 15, fontWeight: '500' },
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.muted,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Aktivna Igra',
          tabBarIcon: ({ size, color }) => (
            <Trophy size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Zgodovina',
          tabBarIcon: ({ size, color }) => (
            <History size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}