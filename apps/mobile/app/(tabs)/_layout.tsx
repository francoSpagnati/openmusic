import React from 'react';
import { StyleSheet } from 'react-native';
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
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontFamily: font.sansMedium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <House
              size={24}
              color={focused ? colors.accent : colors.textSubtle}
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
              color={focused ? colors.accent : colors.textSubtle}
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
              color={focused ? colors.accent : colors.textSubtle}
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
              color={focused ? colors.accent : colors.textSubtle}
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
              color={focused ? colors.accent : colors.textSubtle}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
