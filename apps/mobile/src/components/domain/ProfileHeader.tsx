import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { UserProfileData } from '@openmusic/shared';
import { Avatar, Badge, Text } from '../ui';

/** Name, handle, role, bio and counters for a profile (own or someone else's). */
export function ProfileHeader({ profile }: { profile: UserProfileData }) {
  const { user, social, stats } = profile;
  const name = user.displayName ?? user.username;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Avatar name={name} src={user.avatarUrl} size="xl" decorative />
        <View style={styles.flex}>
          <Text variant="headline" numberOfLines={2} accessibilityRole="header">
            {name}
          </Text>
          <Text variant="mono" size="sm" tone="secondary">
            @{user.username}
          </Text>
          {user.role === 'CRITIC' ? (
            <Badge label={user.criticOutlet ?? 'Critico'} tone="accent" size="sm" />
          ) : null}
        </View>
      </View>
      {user.bio ? <Text tone="secondary">{user.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat label="Follower" value={social.followersCount} />
        <Stat label="Seguiti" value={social.followingCount} />
        <Stat label="Recensioni" value={stats.totalReviews} />
        <Stat label="Post" value={social.postsCount} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text variant="mono" size="lg">
        {value}
      </Text>
      <Text variant="eyebrow">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 2 },
});
