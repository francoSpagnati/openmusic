import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { ChatCircle, Compass, House, PlayCircle, User } from '../../src/components/icons';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors, font } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: font.sansSemiBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <House
              size={24}
              color={focused ? colors.accent : colors.muted}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Esplora',
          tabBarIcon: ({ focused }) => (
            <Compass
              size={24}
              color={focused ? colors.accent : colors.muted}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ focused }) => (
            <PlayCircle
              size={24}
              color={focused ? colors.accent : colors.muted}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => (
            <ChatCircle
              size={24}
              color={focused ? colors.accent : colors.muted}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ focused }) => (
            <User
              size={24}
              color={focused ? colors.accent : colors.muted}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
