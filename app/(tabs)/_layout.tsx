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
          backgroundColor: '#121212', // Temno ozadje (skoraj črno)
          borderTopWidth: 0,          // Odstrani grdo črto zgoraj
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
          elevation: 0,               // Odstrani senco na Androidu
          shadowOpacity: 0,           // Odstrani senco na iOS
        },
        tabBarActiveTintColor: '#4a9eff', // Aktivna barva (modra)
        tabBarInactiveTintColor: '#555',  // Neaktivna barva (temno siva)
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Igra',
          tabBarIcon: ({ color, size }) => <Play size={size} color={color} fill={color === '#4a9eff' ? color : 'transparent'} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Zgodovina',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      
      {/* Skrit tab za 'not-found', da ne dela težav navigaciji */}
      <Tabs.Screen
        name="not-found"
        options={{
           href: null,
        }}
      />
    </Tabs>
  );
}
