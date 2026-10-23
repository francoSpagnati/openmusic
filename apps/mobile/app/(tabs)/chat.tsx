import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { WS_EVENTS, type ConversationSummary } from '@openmusic/shared';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useFriendsPresence, useSocketEvent } from '../../src/lib/socket';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { formatRelative } from '../../src/lib/format';
import { useTheme } from '../../src/theme';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  EmptyState,
  Enter,
  ErrorState,
  Skeleton,
  Text,
} from '../../src/components/ui';
import { UserPickerSheet } from '../../src/features/mobile-social/UserPickerSheet';
import { PressableScale } from '../../src/features/mobile-social/PressableScale';
import { haptics } from '../../src/features/mobile-social/haptics';
import { MusicNote, PencilSimple } from '../../src/features/mobile-social/icons';

function preview(c: ConversationSummary, myId: string | undefined): string {
  const m = c.lastMessage;
  const prefix = m.senderId === myId ? 'Tu: ' : '';
  if (m.track) return `${prefix}${m.track.title} — ${m.track.artistName}`;
  return `${prefix}${m.content ?? ''}`;
}

/**
 * Chat inbox: conversations newest first, unread counts, live presence dots, and live updates
 * from `chat:message` (the row moves to the top without a refetch). Refetches on focus so the
 * unread counts are right after reading a thread.
 */
export default function ChatInboxScreen() {
  const { colors, space, radii } = useTheme();
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const inbox = useApiQuery(() => api.chat.conversations(), []);
  const { friends } = useFriendsPresence();
  const online = new Map(friends.map((f) => [f.userId, f]));

  // Back from a thread: refetch so its unread count drops (the first focus is the initial load).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void inbox.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reload is stable
    }, [])
  );

  useSocketEvent(WS_EVENTS.SERVER_CHAT_MESSAGE, (message) => {
    const otherId = message.senderId === user?.id ? message.receiverId : message.senderId;
    // New conversation partner: we need their profile row, so refetch the inbox.
    if (!inbox.data?.some((c) => c.otherUser.id === otherId)) {
      void inbox.reload();
      return;
    }
    inbox.setData((list) => {
      const existing = list?.find((c) => c.otherUser.id === otherId);
      if (!list || !existing) return list;
      const updated: ConversationSummary = {
        ...existing,
        lastMessage: message,
        unreadCount: existing.unreadCount + (message.receiverId === user?.id ? 1 : 0),
      };
      return [updated, ...list.filter((c) => c.otherUser.id !== otherId)];
    });
  });

  const conversations = inbox.data ?? [];

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.otherUser.id}
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: space[4],
          paddingBottom: 112,
        }}
        ItemSeparatorComponent={() => <Divider style={{ marginLeft: 56 }} />}
        refreshControl={
          <RefreshControl
            refreshing={inbox.refreshing}
            onRefresh={inbox.reload}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <Text
            variant="headline"
            size="3xl"
            accessibilityRole="header"
            style={{ marginBottom: space[4] }}
          >
            Chat
          </Text>
        }
        renderItem={({ item, index }) => {
          const name = item.otherUser.displayName ?? item.otherUser.username;
          const presence = online.get(item.otherUser.id);
          const unread = item.unreadCount > 0;
          return (
            <Enter index={index}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Conversazione con ${name}${unread ? `, ${item.unreadCount} non letti` : ''}. Ultimo: ${preview(item, user?.id)}`}
                onPress={() => router.push(`/chat/${item.otherUser.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surface : 'transparent',
                    opacity: pressed ? 0.9 : 1,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Avatar
                  name={name}
                  src={item.otherUser.avatarUrl}
                  status={
                    presence
                      ? presence.isGhostMode
                        ? 'ghost'
                        : presence.currentlyPlaying?.isPlaying
                          ? 'live'
                          : 'online'
                      : undefined
                  }
                  decorative
                />
                <View style={styles.text}>
                  <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1}>
                    {name}
                  </Text>
                  <View style={styles.previewRow}>
                    {item.lastMessage.track ? (
                      <MusicNote size={14} color={colors.textMuted} weight="regular" />
                    ) : null}
                    <Text
                      size="sm"
                      tone={unread ? 'primary' : 'secondary'}
                      numberOfLines={1}
                      style={styles.text}
                    >
                      {preview(item, user?.id)}
                    </Text>
                  </View>
                </View>
                <View style={styles.meta}>
                  <Text size="xs" tone="muted">
                    {formatRelative(item.lastMessage.createdAt)}
                  </Text>
                  {unread ? (
                    <Badge
                      label={String(item.unreadCount)}
                      tone="neutral"
                      variant="solid"
                      size="sm"
                      mono
                    />
                  ) : null}
                </View>
              </Pressable>
            </Enter>
          );
        }}
        ListEmptyComponent={
          inbox.loading ? (
            <View style={{ gap: space[2] }} accessibilityLabel="Caricamento delle chat">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={60} />
              ))}
            </View>
          ) : inbox.error ? (
            <ErrorState
              title="Non riusciamo a caricare le chat"
              error={inbox.error}
              onRetry={inbox.reload}
              retrying={inbox.refreshing}
            />
          ) : (
            <EmptyState
              title="Nessuna conversazione"
              description="Manda un brano a un amico: è il modo migliore per iniziare."
              action={
                <Button
                  label="Nuova chat"
                  variant="secondary"
                  onPress={() => setPickerOpen(true)}
                />
              }
            />
          )
        }
      />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Nuova chat"
        onPress={() => {
          haptics.tap();
          setPickerOpen(true);
        }}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent,
            borderRadius: radii.pill,
            right: space[5],
            bottom: space[5],
          },
        ]}
      >
        <PencilSimple size={22} color={colors.accentContrast} weight="regular" />
      </PressableScale>

      <UserPickerSheet
        visible={pickerOpen}
        title="Nuova chat"
        onClose={() => setPickerOpen(false)}
        onPick={(u) => {
          setPickerOpen(false);
          router.push(`/chat/${u.id}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 72,
  },
  text: { flex: 1, minWidth: 0 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { alignItems: 'flex-end', gap: 4 },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
