import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  WS_EVENTS,
  type CatalogTrack,
  type ChatMessage,
  type ChatReactionType,
} from '@openmusic/shared';
import { api, isApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useSocketEvent } from '../../src/lib/socket';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import {
  Avatar,
  CoverArt,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
  describeError,
} from '../../src/components/ui';
import { CatalogPickerSheet } from '../../src/features/mobile-social/CatalogPickerSheet';
import { MusicChatBubble } from '../../src/features/mobile-social/MusicChatBubble';
import { haptics } from '../../src/features/mobile-social/haptics';
import { MusicNote, PaperPlaneRight, X } from '../../src/features/mobile-social/icons';

/**
 * 1:1 conversation: history (latest 50), live `chat:message`, mark-as-read on open and on each
 * incoming message, text + track sharing (catalog search incl. external databases), reactions and
 * "ascoltato" on received tracks. Composer sits at the bottom (thumb zone) above the keyboard.
 */
export default function ConversationScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const otherId = typeof userId === 'string' ? userId : '';
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, space, radii, font } = useTheme();
  const [draft, setDraft] = useState('');
  const [track, setTrack] = useState<CatalogTrack | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<TextInputInstance>(null);

  const other = useApiQuery(() => api.profile.byId(otherId), [otherId], {
    enabled: otherId.length > 0,
  });
  const thread = useApiQuery(
    async () => {
      const messages = await api.chat.conversation(otherId);
      void api.chat.markConversationRead(otherId).catch(() => undefined);
      return messages;
    },
    [otherId],
    { enabled: otherId.length > 0 }
  );

  const upsert = useCallback(
    (message: ChatMessage, live: boolean) => {
      thread.setData((prev) => {
        const list = prev ?? [];
        return list.some((m) => m.id === message.id)
          ? list.map((m) => (m.id === message.id ? message : m))
          : [...list, message];
      });
      if (live) setLiveIds((s) => new Set(s).add(message.id));
    },
    [thread]
  );

  useSocketEvent(WS_EVENTS.SERVER_CHAT_MESSAGE, (message) => {
    if (message.senderId !== otherId && message.receiverId !== otherId) return;
    upsert(message, true);
    if (message.senderId === otherId) {
      haptics.tap();
      void api.chat.markConversationRead(otherId).catch(() => undefined);
    }
  });

  const send = async () => {
    const content = draft.trim();
    if ((!content && !track) || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await api.chat.send({
        receiverId: otherId,
        content: content.length > 0 ? content : undefined,
        trackId: track?.id,
      });
      upsert(message, true);
      haptics.success();
      setDraft('');
      setTrack(null);
    } catch (err) {
      haptics.error();
      setSendError(
        isApiError(err)
          ? (err.fieldError('content') ?? err.fieldError('trackId') ?? err.message)
          : describeError(err)
      );
    } finally {
      setSending(false);
    }
  };

  const react = async (message: ChatMessage, reaction: ChatReactionType | null) => {
    upsert({ ...message, reaction }, false);
    try {
      upsert(await api.chat.react(message.id, reaction), false);
    } catch {
      haptics.error();
      upsert(message, false);
    }
  };

  const markListened = async (message: ChatMessage) => {
    upsert({ ...message, isListened: true }, false);
    try {
      upsert(await api.chat.markListened(message.id), false);
    } catch {
      haptics.error();
      upsert(message, false);
    }
  };

  const profile = other.data;
  const name = profile ? (profile.user.displayName ?? profile.user.username) : 'Chat';
  const messages = thread.data ?? [];
  const reversed = [...messages].reverse();
  const canSend = (draft.trim().length > 0 || track !== null) && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Profilo di ${name}`}
              onPress={() => profile && router.push(`/profile/${profile.user.id}`)}
              style={styles.headerTitle}
            >
              {profile ? (
                <Avatar name={name} src={profile.user.avatarUrl} size="xs" decorative />
              ) : null}
              <Text variant="bodyStrong" numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ),
        }}
      />

      {thread.loading ? (
        <View
          style={[styles.flex, { padding: space[5], gap: space[3] }]}
          accessibilityLabel="Caricamento dei messaggi"
        >
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', width: '60%' }}>
              <Skeleton height={i % 2 ? 44 : 72} />
            </View>
          ))}
        </View>
      ) : thread.error ? (
        <View style={[styles.flex, { padding: space[5] }]}>
          <ErrorState
            title="Conversazione non disponibile"
            error={thread.error}
            onRetry={thread.reload}
            retrying={thread.refreshing}
          />
        </View>
      ) : (
        <FlatList
          inverted={messages.length > 0}
          data={reversed}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space[5], flexGrow: 1 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <MusicChatBubble
                message={item}
                isMine={mine}
                animateIn={liveIds.has(item.id)}
                onReact={mine ? undefined : (m, r) => void react(m, r)}
                onMarkListened={mine ? undefined : (m) => void markListened(m)}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="Nessun messaggio"
              description="Rompi il ghiaccio con un brano: tocca la nota in basso."
              icon={<MusicNote size={28} color={colors.textSubtle} />}
            />
          }
        />
      )}

      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
            paddingBottom: Math.max(insets.bottom, space[2]),
          },
        ]}
      >
        {track ? (
          <View
            style={[
              styles.attachment,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.md,
                borderColor: colors.border,
              },
            ]}
          >
            <CoverArt uri={track.coverUrl ?? null} size={36} />
            <View style={styles.flexShrink}>
              <Text variant="bodyStrong" size="sm" numberOfLines={1}>
                {track.title}
              </Text>
              <Text size="xs" tone="secondary" numberOfLines={1}>
                {track.artistName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rimuovi brano"
              hitSlop={8}
              onPress={() => setTrack(null)}
              style={styles.iconBtn}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
        {sendError ? (
          <Text size="sm" tone="rotten" accessibilityLiveRegion="polite">
            {sendError}
          </Text>
        ) : null}
        <View style={styles.inputRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Condividi un brano"
            onPress={() => {
              haptics.tap();
              setPickerOpen(true);
            }}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
          >
            <MusicNote size={22} color={colors.textMuted} weight="regular" />
          </Pressable>
          <TextInput
            ref={inputRef}
            accessibilityLabel="Messaggio"
            placeholder={track ? 'Aggiungi due parole (facoltativo)' : 'Scrivi un messaggio'}
            placeholderTextColor={colors.textSubtle}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.borderStrong,
                borderRadius: radii.lg,
                fontFamily: font.sans,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invia"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            disabled={!canSend}
            onPress={() => void send()}
            style={[
              styles.iconBtn,
              {
                backgroundColor: canSend ? colors.accent : colors.surface,
                borderRadius: radii.pill,
              },
            ]}
          >
            <PaperPlaneRight
              size={22}
              color={canSend ? colors.accentContrast : colors.textSubtle}
              weight="fill"
            />
          </Pressable>
        </View>
      </View>

      <CatalogPickerSheet
        visible={pickerOpen}
        mode="tracks"
        title={`Manda un brano a ${name}`}
        onClose={() => setPickerOpen(false)}
        onPick={(pick) => {
          if (pick.kind === 'track') setTrack(pick.track);
          setPickerOpen(false);
          inputRef.current?.focus();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderWidth: 1,
    fontSize: 16,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
