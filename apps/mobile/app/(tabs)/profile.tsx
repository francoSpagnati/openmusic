import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import { SocialProfile } from '../../src/features/mobile-social/SocialProfile';

/** Own profile (`/api/profile/me`): posts, reviews, heavy rotation, link to settings. */
export default function MyProfileScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const profile = useApiQuery(() => api.profile.me(), []);
  const firstFocus = React.useRef(true);

  // Counts change elsewhere (follows, new posts): refresh when the tab comes back into view.
  useFocusEffect(
    React.useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void profile.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reload is stable
    }, [])
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <SocialProfile userId={profile.data?.user.id ?? user?.id ?? ''} profile={profile} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
