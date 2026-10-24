import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { WS_EVENTS, type NotificationItem, type NotificationType } from '@openmusic/shared';
import { api } from '../src/lib/api';
import { useSocketEvent } from '../src/lib/socket';
import { formatRelative } from '../src/lib/format';
import { useTheme, withAlpha } from '../src/theme';
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  Enter,
  ErrorState,
  Skeleton,
  Text,
} from '../src/components/ui';
import { Bell, Heart, SealCheck, ThumbsUp } from '../src/components/icons';
import { CheckCircle, UserPlus } from '../src/features/mobile-social/icons';
import { haptics } from '../src/features/mobile-social/haptics';
import {
  actorName,
  describeNotification,
  notificationTarget,
} from '../src/features/mobile-social/notificationText';
import { useCursorList } from '../src/features/mobile-social/useCursorList';

function TypeIcon({ type, color }: { type: NotificationType; color: string }) {
  switch (type) {
    case 'FOLLOW':
      return <UserPlus size={14} color={color} weight="bold" />;
    case 'POST_LIKE':
      return <Heart size={14} color={color} weight="fill" />;
    case 'REVIEW_REACTION':
      return <ThumbsUp size={14} color={color} weight="fill" />;
    case 'TRACK_LISTENED':
      return <CheckCircle size={14} color={color} weight="fill" />;
    case 'CRITIC_APPROVED':
      return <SealCheck size={14} color={color} weight="fill" />;
  }
}

/**
 * Notifications: paged list, new ones arrive live over the socket (with a haptic), everything is
 * marked read on open while this visit keeps the unread highlight, and each row opens what it is
 * about (profile, release or chat).
 */
export default function NotificationsScreen() {
  const { colors, space, radii } = useTheme();
  const list = useCursorList<NotificationItem>(
    (cursor) => api.notifications.list({ cursor, limit: 30 }),
    []
  );
  const markedRead = useRef(false);

  useEffect(() => {
    if (markedRead.current || list.loading) return;
    if (list.items.some((n) => n.readAt === null)) {
      markedRead.current = true;
      void api.notifications.markRead().catch(() => {
        markedRead.current = false;
      });
    }
  }, [list.items, list.loading]);

  useSocketEvent(WS_EVENTS.SERVER_NOTIFICATION, (n) => {
    haptics.notify();
    list.setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
    void api.notifications.markRead([n.id]).catch(() => undefined);
  });

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={list.items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{
        paddingHorizontal: space[5],
        paddingTop: space[2],
        paddingBottom: space[12],
      }}
      ItemSeparatorComponent={() => <Divider style={{ marginLeft: 60 }} />}
      refreshControl={
        <RefreshControl
          refreshing={list.refreshing}
          onRefresh={list.reload}
          tintColor={colors.accent}
        />
      }
      onEndReached={() => void list.loadMore()}
      onEndReachedThreshold={0.5}
      renderItem={({ item, index }) => {
        const unread = item.readAt === null;
        const target = notificationTarget(item);
        const text = describeNotification(item);
        return (
          <Enter index={index} kind="fade">
            <Pressable
              accessibilityRole={target ? 'link' : 'text'}
              accessibilityLabel={`${unread ? 'Nuova. ' : ''}${text}, ${formatRelative(item.createdAt)}`}
              disabled={!target}
              onPress={() => target && router.push(target)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderRadius: radii.md,
                  backgroundColor: pressed
                    ? colors.surface
                    : unread
                      ? withAlpha(colors.text, 0.035)
                      : 'transparent',
                },
              ]}
            >
              <View>
                <Avatar name={actorName(item)} src={item.actor?.avatarUrl} size="md" decorative />
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.bg },
                  ]}
                >
                  <TypeIcon type={item.type} color={colors.textMuted} />
                </View>
              </View>
              <View style={styles.flex}>
                <Text size="sm" variant={unread ? 'bodyStrong' : 'body'}>
                  {text}
                </Text>
                <Text size="xs" tone="muted">
                  {formatRelative(item.createdAt)}
                </Text>
              </View>
              {unread ? (
                <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
              ) : null}
            </Pressable>
          </Enter>
        );
      }}
      ListFooterComponent={
        list.loadingMore ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Carico altre notifiche" />
        ) : list.loadMoreError ? (
          <Button label="Riprova a caricare" variant="ghost" onPress={() => void list.loadMore()} />
        ) : undefined
      }
      ListEmptyComponent={
        list.loading ? (
          <View style={{ gap: space[2] }} accessibilityLabel="Caricamento delle notifiche">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={56} />
            ))}
          </View>
        ) : list.error ? (
          <ErrorState
            title="Notifiche non disponibili"
            error={list.error}
            onRetry={list.reload}
            retrying={list.refreshing}
          />
        ) : (
          <EmptyState
            title="Tutto tranquillo"
            description="Qui vedrai follow, like, reazioni e i brani che i tuoi amici hanno ascoltato."
            icon={<Bell size={32} color={colors.textSubtle} weight="light" />}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 72,
  },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
