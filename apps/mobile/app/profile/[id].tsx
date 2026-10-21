import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/lib/api';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import { SocialProfile } from '../../src/features/mobile-social/SocialProfile';

/** Public profile (`/api/profile/:userId`): follow, message, posts, reviews, heavy rotation. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = typeof id === 'string' ? id : '';
  const { colors } = useTheme();
  const profile = useApiQuery(() => api.profile.byId(userId), [userId], {
    enabled: userId.length > 0,
  });

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{ title: profile.data ? `@${profile.data.user.username}` : 'Profilo' }}
      />
      <SocialProfile userId={userId} profile={profile} />
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
