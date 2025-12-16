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
          borderTopColor: '#2a2a2a',
          // POPRAVEK: Dinamična višina glede na napravo + fiksni dodatek
          height: Platform.OS === 'ios' ? 95 : 70, 
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          position: 'absolute', // To včasih pomaga pri layoutu
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: '#4a9eff',
        tabBarInactiveTintColor: '#6b7280',
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
          tabBarIcon: ({ color, size }) => <Play size={28} color={color} fill={color === '#4a9eff' ? color : 'transparent'} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Zgodovina',
          tabBarIcon: ({ color, size }) => <History size={28} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="not-found"
        options={{ href: null }}
      />
    </Tabs>
  );
}
