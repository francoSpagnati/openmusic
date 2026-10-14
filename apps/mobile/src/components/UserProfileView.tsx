import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  User as UserIcon,
  CheckCircle,
  ThumbsUp,
  PenNib,
  Compass,
  Heart,
  Fire,
} from 'phosphor-react-native';
import {
  THEME,
  type UserProfileData,
  type ReactionType,
  type CatalogTrack,
  type ReviewItem,
} from '@openmusic/shared';

interface UserProfileViewProps {
  profile: UserProfileData;
  onPressTrack?: (track: CatalogTrack) => void;
  onPressReview?: (review: ReviewItem) => void;
  onToggleReaction?: (reviewId: string, type: ReactionType) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  profile,
  onPressTrack,
  onPressReview,
  onToggleReaction,
}) => {
  const { user, stats, heavyRotation, recentReviews } = profile;

  const handleReactionPress = useCallback(
    (reviewId: string, type: ReactionType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onToggleReaction?.(reviewId, type);
    },
    [onToggleReaction]
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Profilo Utente */}
      <View style={styles.headerCard}>
        <View style={styles.avatarRow}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <UserIcon size={36} color={THEME.colors.textMuted} weight="duotone" />
            </View>
          )}

          <View style={styles.userNames}>
            <Text style={styles.displayName}>
              {user.displayName ?? user.username}
            </Text>
            <Text style={styles.username}>@{user.username}</Text>
            {user.role === 'CRITIC' && (
              <View style={styles.criticBadge}>
                <Text style={styles.criticBadgeText}>Critica Accreditata</Text>
              </View>
            )}
          </View>
        </View>

        {user.bio ? <Text style={styles.bioText}>{user.bio}</Text> : null}

        {/* Barra Statistiche (fontMono + tabular-nums) */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalReviews}</Text>
            <Text style={styles.statLabel}>Recensioni</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.verifiedReviews}</Text>
            <Text style={styles.statLabel}>Verificati</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalScrobbles}</Text>
            <Text style={styles.statLabel}>Scrobble</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {stats.averageRating ? stats.averageRating.toFixed(1) : '-'}
            </Text>
            <Text style={styles.statLabel}>Voto Medio</Text>
          </View>
        </View>
      </View>

      {/* Sezione: In Rotazione Pesante (Heavy Rotation) */}
      {heavyRotation.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Fire size={18} color={THEME.colors.accentWarm} weight="fill" />
            <Text style={styles.sectionTitle}>In Rotazione Pesante</Text>
          </View>

          <View style={styles.rotationList}>
            {heavyRotation.map((item, index) => (
              <Pressable
                key={item.track.id}
                onPress={() => onPressTrack?.(item.track)}
                style={styles.rotationItem}
              >
                <Text style={styles.rotationRank}>{index + 1}</Text>
                {item.track.coverUrl ? (
                  <Image
                    source={{ uri: item.track.coverUrl }}
                    style={styles.rotationCover}
                  />
                ) : (
                  <View style={[styles.rotationCover, styles.avatarFallback]} />
                )}
                <View style={styles.rotationMeta}>
                  <Text style={styles.rotationTitle} numberOfLines={1}>
                    {item.track.title}
                  </Text>
                  <Text style={styles.rotationArtist} numberOfLines={1}>
                    {item.track.artistName}
                  </Text>
                </View>
                <Text style={styles.rotationCount}>{item.playCount} play</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Sezione: Diario Recensioni */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Diario Recensioni</Text>

        {recentReviews.length === 0 ? (
          <Text style={styles.emptyText}>Nessuna recensione pubblicata finora.</Text>
        ) : (
          recentReviews.map((rev) => (
            <Pressable
              key={rev.id}
              onPress={() => onPressReview?.(rev)}
              style={styles.reviewCard}
            >
              <View style={styles.reviewHeader}>
                <View style={styles.ratingStars}>
                  <Text style={styles.ratingNumber}>
                    {(rev.rating / 20).toFixed(1)}{' '}
                    <Text style={styles.starSymbol}>★</Text>
                  </Text>
                </View>

                {rev.isVerifiedListen && (
                  <View style={styles.verifiedSmallBadge}>
                    <CheckCircle
                      size={12}
                      color={THEME.colors.accentFresh}
                      weight="fill"
                    />
                    <Text style={styles.verifiedSmallText}>Ascolto Verificato</Text>
                  </View>
                )}
              </View>

              {rev.content && (
                <Text style={styles.reviewContent}>{rev.content}</Text>
              )}

              {/* Vibe Tags */}
              {rev.vibeTags.length > 0 && (
                <View style={styles.reviewVibesRow}>
                  {rev.vibeTags.map((v) => (
                    <View key={v} style={styles.reviewVibeBadge}>
                      <Text style={styles.reviewVibeText}>{v}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Reazioni Costruttive (ADR-004) */}
              <View style={styles.reactionsRow}>
                <Pressable
                  onPress={() => handleReactionPress(rev.id, 'AGREE')}
                  style={[
                    styles.reactionBtn,
                    rev.userReaction === 'AGREE' && styles.reactionBtnActive,
                  ]}
                >
                  <ThumbsUp
                    size={14}
                    color={
                      rev.userReaction === 'AGREE'
                        ? THEME.colors.accentWarm
                        : THEME.colors.textSecondary
                    }
                    weight={rev.userReaction === 'AGREE' ? 'fill' : 'regular'}
                  />
                  <Text style={styles.reactionCountText}>
                    {rev.reactions.AGREE}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleReactionPress(rev.id, 'WELL_WRITTEN')}
                  style={[
                    styles.reactionBtn,
                    rev.userReaction === 'WELL_WRITTEN' && styles.reactionBtnActive,
                  ]}
                >
                  <PenNib
                    size={14}
                    color={
                      rev.userReaction === 'WELL_WRITTEN'
                        ? THEME.colors.accentWarm
                        : THEME.colors.textSecondary
                    }
                    weight={rev.userReaction === 'WELL_WRITTEN' ? 'fill' : 'regular'}
                  />
                  <Text style={styles.reactionCountText}>
                    {rev.reactions.WELL_WRITTEN}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleReactionPress(rev.id, 'DISCOVERED')}
                  style={[
                    styles.reactionBtn,
                    rev.userReaction === 'DISCOVERED' && styles.reactionBtnActive,
                  ]}
                >
                  <Compass
                    size={14}
                    color={
                      rev.userReaction === 'DISCOVERED'
                        ? THEME.colors.accentWarm
                        : THEME.colors.textSecondary
                    }
                    weight={rev.userReaction === 'DISCOVERED' ? 'fill' : 'regular'}
                  />
                  <Text style={styles.reactionCountText}>
                    {rev.reactions.DISCOVERED}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleReactionPress(rev.id, 'HEART')}
                  style={[
                    styles.reactionBtn,
                    rev.userReaction === 'HEART' && styles.reactionBtnActive,
                  ]}
                >
                  <Heart
                    size={14}
                    color={
                      rev.userReaction === 'HEART'
                        ? THEME.colors.accentRotten
                        : THEME.colors.textSecondary
                    }
                    weight={rev.userReaction === 'HEART' ? 'fill' : 'regular'}
                  />
                  <Text style={styles.reactionCountText}>
                    {rev.reactions.HEART}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgPrimary,
  },
  headerCard: {
    backgroundColor: THEME.colors.bgElevated,
    margin: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarFallback: {
    backgroundColor: THEME.colors.bgInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNames: {
    flex: 1,
  },
  displayName: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  username: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  criticBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${THEME.colors.accentWarm}20`,
    borderColor: THEME.colors.accentWarm,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  criticBadgeText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.accentWarm,
  },
  bioText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    marginTop: 14,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.bgInteractive,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.borderSubtle,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  rotationList: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    overflow: 'hidden',
  },
  rotationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  rotationRank: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    width: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rotationCover: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 12,
  },
  rotationMeta: {
    flex: 1,
  },
  rotationTitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  rotationArtist: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  rotationCount: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 11,
    color: THEME.colors.accentWarm,
    fontVariant: ['tabular-nums'],
  },
  reviewCard: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingNumber: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.accentWarm,
    fontVariant: ['tabular-nums'],
  },
  starSymbol: {
    fontSize: 13,
  },
  verifiedSmallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${THEME.colors.accentFresh}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedSmallText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.accentFresh,
  },
  reviewContent: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 10,
  },
  reviewVibesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reviewVibeBadge: {
    backgroundColor: THEME.colors.bgInteractive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  reviewVibeText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
    paddingTop: 10,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.bgInteractive,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  reactionBtnActive: {
    backgroundColor: `${THEME.colors.accentWarm}25`,
  },
  reactionCountText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
});
