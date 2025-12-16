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
          backgroundColor: '#1a1a1a', // Malenkost svetlejše od črne, da se loči od ekrana
          borderTopWidth: 1,          // Tanka črta za ločitev
          borderTopColor: '#333',     // Temno siva črta
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: '#4a9eff', // Modra za aktivno
        tabBarInactiveTintColor: '#9ca3af', // Svetlejša siva (boljša vidljivost)
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
      
      <Tabs.Screen
        name="not-found"
        options={{
           href: null,
        }}
      />
    </Tabs>
  );
}
