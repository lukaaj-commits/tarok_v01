import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { Play, History, Users, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#121212',
          borderTopWidth: 1,
          borderTopColor: '#333',
          // POPRAVEK: Zelo varna višina, da se gumbi ne skrijejo
          height: Platform.OS === 'ios' ? 110 : 80,
          paddingBottom: Platform.OS === 'ios' ? 35 : 15,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarActiveTintColor: '#4a9eff',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Igra',
          tabBarIcon: ({ color, size }) => <Play size={30} color={color} fill={color === '#4a9eff' ? color : 'transparent'} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Zgodovina',
          tabBarIcon: ({ color, size }) => <History size={30} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="not-found"
        options={{ href: null }}
      />
    </Tabs>
  );
}
