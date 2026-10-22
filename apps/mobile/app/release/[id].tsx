import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import type { CatalogRelease, DualScoreDetails, ReactionType, ReviewItem } from '@openmusic/shared';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import { EmptyState, ErrorState, Skeleton, SkeletonText, Text } from '../../src/components/ui';
import { PreviewPlayerProvider } from '../../src/features/mobile-discovery/PreviewPlayer';
import { applyReaction, myReactions } from '../../src/features/mobile-discovery/reactions';
import { haptics } from '../../src/features/mobile-discovery/haptics';
import { CriticReviewCard } from '../../src/features/mobile-discovery/release/CriticReviewCard';
import { DualScoreCard } from '../../src/features/mobile-discovery/release/DualScoreCard';
import { ReleaseHeaderCard } from '../../src/features/mobile-discovery/release/ReleaseHeaderCard';
import { ReviewCard } from '../../src/features/mobile-discovery/release/ReviewCard';
import { ReviewComposer } from '../../src/features/mobile-discovery/release/ReviewComposer';
import { Tracklist } from '../../src/features/mobile-discovery/release/Tracklist';
import { VideoCard } from '../../src/features/mobile-discovery/release/VideoCard';
import { EditionStrip } from '../../src/features/mobile-discovery/editions/EditionCards';
import { CaretRight } from '../../src/features/mobile-discovery/icons';

function scoreFromRelease(release: CatalogRelease): DualScoreDetails {
  return {
    releaseId: release.id,
    audienceAvg: release.audienceAvg ?? null,
    audienceFreshPct: release.audienceFreshPct ?? null,
    audienceCount: release.audienceCount,
    criticAvg: release.criticAvg ?? null,
    criticFreshPct: release.criticFreshPct ?? null,
    criticCount: release.criticCount,
  };
}

/**
 * Release page: tinted header with the real cover and metadata (local catalog or imported from
 * Deezer / iTunes / MusicBrainz), dual score, tracklist on sides A/B with 30s previews, the
 * viewer's review composer, audience reviews with reactions, critic quotes and videos. Secondary
 * sections load on their own and fail on their own.
 */
export default function ReleaseScreen() {
  return (
    <PreviewPlayerProvider>
      <ReleaseContent />
    </PreviewPlayerProvider>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="eyebrow" accessibilityRole="header">
      {children}
    </Text>
  );
}

function ReleaseContent() {
  const { colors, space } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const releaseId = typeof id === 'string' ? id : '';
  const enabled = releaseId.length > 0;

  const release = useApiQuery(() => api.catalog.release(releaseId), [releaseId], { enabled });
  const reviews = useApiQuery(() => api.reviews.forRelease(releaseId), [releaseId], { enabled });
  const score = useApiQuery(() => api.critic.dualScore(releaseId), [releaseId], { enabled });
  const critics = useApiQuery(() => api.critic.reviewsForRelease(releaseId), [releaseId], {
    enabled,
  });
  const videos = useApiQuery(() => api.videos.forRelease(releaseId), [releaseId], { enabled });
  const [pending, setPending] = useState<Record<string, ReadonlySet<ReactionType>>>({});

  const refreshing = release.refreshing || reviews.refreshing;
  const refreshAll = useCallback(() => {
    void release.reload();
    void reviews.reload();
    void score.reload();
    void critics.reload();
    void videos.reload();
  }, [release, reviews, score, critics, videos]);

  const mine = useMemo(
    () => (user ? ((reviews.data ?? []).find((r) => r.userId === user.id) ?? null) : null),
    [reviews.data, user]
  );
  const others = useMemo(
    () => (reviews.data ?? []).filter((r) => r.userId !== user?.id),
    [reviews.data, user]
  );

  const onSaved = useCallback(
    (saved: ReviewItem) => {
      reviews.setData((prev) => {
        const list = prev ?? [];
        return list.some((r) => r.id === saved.id)
          ? list.map((r) => (r.id === saved.id ? saved : r))
          : [saved, ...list];
      });
      // Scores are recomputed server-side on every review.
      void score.reload();
    },
    [reviews, score]
  );

  const setReview = useCallback(
    (reviewId: string, update: (r: ReviewItem) => ReviewItem) =>
      reviews.setData((prev) => prev?.map((r) => (r.id === reviewId ? update(r) : r))),
    [reviews]
  );

  const onReact = useCallback(
    (review: ReviewItem, type: ReactionType) => {
      const wasActive = myReactions(review).includes(type);
      setReview(review.id, (r) => applyReaction(r, type, !wasActive));
      setPending((prev) => ({ ...prev, [review.id]: new Set([...(prev[review.id] ?? []), type]) }));
      api.reviews
        .toggleReaction({ reviewId: review.id, type })
        .then((res) => {
          // The server is the source of truth (another device may have toggled it meanwhile).
          if (res.added === wasActive)
            setReview(review.id, (r) => applyReaction(r, type, res.added));
        })
        .catch(() => {
          haptics.error();
          setReview(review.id, (r) => applyReaction(r, type, wasActive));
        })
        .finally(() =>
          setPending((prev) => {
            const next = new Set(prev[review.id] ?? []);
            next.delete(type);
            return { ...prev, [review.id]: next };
          })
        );
    },
    [setReview]
  );

  if (release.loading) {
    return (
      <SafeAreaView
        edges={[]}
        style={[styles.flex, { backgroundColor: colors.bg, padding: space[4], gap: space[4] }]}
      >
        <View
          accessible
          accessibilityLabel="Caricamento del disco"
          style={[styles.center, { gap: space[4] }]}
        >
          <Skeleton width={240} height={240} />
          <SkeletonText lines={3} />
          <Skeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }
  if (release.error || !release.data) {
    return (
      <SafeAreaView
        edges={[]}
        style={[styles.flex, { backgroundColor: colors.bg, padding: space[4] }]}
      >
        <Stack.Screen options={{ title: 'Disco' }} />
        <ErrorState
          title="Disco non disponibile"
          error={release.error}
          onRetry={release.reload}
          retrying={release.refreshing}
        />
      </SafeAreaView>
    );
  }

  const data = release.data;
  const tracks = data.tracks ?? [];
  const previewTrack = tracks.find((t) => Boolean(t.previewUrl)) ?? tracks[0] ?? null;
  const dual = score.data ?? scoreFromRelease(data);
  const otherEditions = data.otherEditions ?? [];
  const hasOtherEditions = otherEditions.length > 0;
  const groupId = data.group?.id ?? null;

  return (
    <SafeAreaView edges={[]} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: data.title }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: space[10] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={colors.accent}
          />
        }
      >
        <ReleaseHeaderCard
          release={data}
          previewTrack={
            previewTrack
              ? { ...previewTrack, coverUrl: previewTrack.coverUrl ?? data.coverUrl ?? null }
              : null
          }
          hasOtherEditions={hasOtherEditions}
        />

        <View style={{ paddingHorizontal: space[4], gap: space[5] }}>
          <DualScoreCard
            score={dual}
            title={hasOtherEditions ? 'Voti di questa edizione' : undefined}
          />
          {groupId && hasOtherEditions ? (
            <Pressable
              accessibilityRole="link"
              accessibilityHint="Apre l'album con tutte le edizioni e il voto complessivo"
              onPress={() => router.push(`/album/${groupId}`)}
              style={({ pressed }) => [styles.albumLink, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text variant="bodyStrong" tone="accent" size="sm">
                {`Tutte le ${otherEditions.length + 1} edizioni e il voto complessivo`}
              </Text>
              <CaretRight size={16} color={colors.accent} weight="bold" />
            </Pressable>
          ) : null}

          <View style={{ gap: space[2] }}>
            <SectionTitle>Tracklist</SectionTitle>
            {tracks.length > 0 ? (
              <Tracklist tracks={tracks} fallbackCover={data.coverUrl} />
            ) : (
              <EmptyState
                size="compact"
                title="Tracklist non ancora disponibile"
                description="La importiamo dal database esterno alla prossima ricerca."
              />
            )}
          </View>

          {hasOtherEditions ? (
            <View style={{ gap: space[2] }}>
              <SectionTitle>Altre edizioni</SectionTitle>
              <Text variant="caption" tone="muted">
                Ristampe, remaster ed edizioni ampliate dello stesso album, ognuna con i suoi voti.
              </Text>
              <EditionStrip editions={otherEditions} />
            </View>
          ) : null}

          <View style={{ gap: space[3] }}>
            <SectionTitle>Recensioni del pubblico</SectionTitle>
            {user ? (
              <ReviewComposer
                releaseId={data.id}
                releaseTitle={data.title}
                edition={
                  hasOtherEditions || data.editionLabel
                    ? { label: data.editionLabel ?? null }
                    : null
                }
                existing={mine}
                onSaved={onSaved}
              />
            ) : null}
            {reviews.loading ? (
              <SkeletonText lines={3} />
            ) : reviews.error ? (
              <ErrorState
                variant="inline"
                title="Recensioni non caricate"
                error={reviews.error}
                onRetry={reviews.reload}
              />
            ) : (
              <>
                {mine ? (
                  <ReviewCard review={mine} isMine onReact={onReact} pending={pending[mine.id]} />
                ) : null}
                {others.length === 0 && !mine ? (
                  <EmptyState
                    size="compact"
                    title="Nessuna recensione"
                    description="Sii il primo a dire la tua."
                  />
                ) : (
                  others.map((r) => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      isMine={false}
                      onReact={onReact}
                      pending={pending[r.id]}
                    />
                  ))
                )}
              </>
            )}
          </View>

          {critics.error ? (
            <ErrorState
              variant="inline"
              title="Critica non caricata"
              error={critics.error}
              onRetry={critics.reload}
            />
          ) : critics.data && critics.data.length > 0 ? (
            <View style={{ gap: space[3] }}>
              <SectionTitle>La critica</SectionTitle>
              {critics.data.map((c) => (
                <CriticReviewCard key={c.id} review={c} />
              ))}
            </View>
          ) : null}

          {videos.error ? (
            <ErrorState
              variant="inline"
              title="Video non caricati"
              error={videos.error}
              onRetry={videos.reload}
            />
          ) : videos.data && videos.data.length > 0 ? (
            <View style={{ gap: space[3] }}>
              <SectionTitle>Video</SectionTitle>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space[3] }}
              >
                {videos.data.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  albumLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
});
