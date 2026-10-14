import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { THEME, type FriendPresence } from '@openmusic/shared';
import { LiveFriendsBar } from './src/components/LiveFriendsBar';
import { useNowPlayingSocket } from './src/hooks/useNowPlayingSocket';
import { Heart, ChatCircle, Repeat, Play, Pause, Disc, Star } from 'phosphor-react-native';

const MOCK_SOCIAL_POSTS = [
  {
    id: 'mob_post_1',
    author: 'Elena Rossi',
    handle: '@elena_rossi',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
    timeAgo: '18m fa',
    content:
      'Weird Fishes/Arpeggi resta una delle composizioni più ipnotiche mai registrate. L’intreccio delle tre chitarre pulite mi fa venire i brividi ad ogni ascolto.',
    albumTitle: 'In Rainbows',
    artist: 'Radiohead',
    year: 2007,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop',
    rating: 5.0,
    likes: 34,
    comments: 8,
  },
  {
    id: 'mob_post_2',
    author: 'Marco Valenti',
    handle: '@marcov',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
    timeAgo: '1h fa',
    content:
      'I sintetizzatori analogici e le linee di basso di Random Access Memories suonano con una dinamica pazzesca in cuffia. Produzione senza tempo.',
    albumTitle: 'Random Access Memories',
    artist: 'Daft Punk',
    year: 2013,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop',
    rating: 4.8,
    likes: 52,
    comments: 14,
  },
  {
    id: 'mob_post_3',
    author: 'Sofia Bianchi',
    handle: '@sofiab',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
    timeAgo: '3h fa',
    content:
      'La fusione tra jazz, funk e conscious hip-hop rende questo disco il capolavoro sonoro del decennio.',
    albumTitle: 'To Pimp a Butterfly',
    artist: 'Kendrick Lamar',
    year: 2015,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=600&fit=crop',
    rating: 5.0,
    likes: 89,
    comments: 21,
  },
];

export default function App() {
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
  const mockUserId = '11111111-2222-3333-4444-555555555555';

  const {
    friends,
    isGhostMode,
    isConnected,
    toggleGhostMode,
  } = useNowPlayingSocket({
    serverUrl: API_URL,
    userId: mockUserId,
  });

  const togglePlay = (id: string) => {
    setPlayingPostId(playingPostId === id ? null : id);
  };

  const toggleLike = (id: string) => {
    setLikedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.bgPrimary} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Disc size={24} weight="duotone" color={THEME.colors.accentWarm} />
          <Text style={styles.logoText}>OpenMusic</Text>
        </View>

        <View style={styles.connectionBadge}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: isConnected ? THEME.colors.accentFresh : THEME.colors.accentWarm },
            ]}
          />
          <Text style={styles.connectionLabel}>
            {isConnected ? 'Live' : 'Feed'}
          </Text>
        </View>
      </View>

      {/* Live Friends Stories Bar */}
      <LiveFriendsBar
        friends={friends}
        isMyGhostModeActive={isGhostMode}
        onToggleGhostMode={toggleGhostMode}
        onPressFriendTrack={() => {}}
      />

      {/* Social Music Feed */}
      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
        {MOCK_SOCIAL_POSTS.map((post) => {
          const isPlaying = playingPostId === post.id;
          const isLiked = likedPosts[post.id];

          return (
            <View key={post.id} style={styles.postCard}>
              {/* Post Author */}
              <View style={styles.postAuthorRow}>
                <Image source={{ uri: post.avatar }} style={styles.authorAvatar} />
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{post.author}</Text>
                  <Text style={styles.authorMeta}>
                    {post.handle} • {post.timeAgo}
                  </Text>
                </View>
              </View>

              {/* Review Text */}
              <Text style={styles.postText}>{post.content}</Text>

              {/* Embedded Album Card */}
              <View style={styles.albumCard}>
                <View style={styles.coverContainer}>
                  <Image source={{ uri: post.coverUrl }} style={styles.albumCover} />
                  <TouchableOpacity
                    onPress={() => togglePlay(post.id)}
                    style={styles.playButtonOverlay}
                    activeOpacity={0.8}
                  >
                    {isPlaying ? (
                      <Pause size={20} weight="fill" color="#121214" />
                    ) : (
                      <Play size={20} weight="fill" color="#121214" style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.albumDetails}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {post.albumTitle}
                  </Text>
                  <Text style={styles.albumArtist}>
                    {post.artist} • {post.year}
                  </Text>

                  <View style={styles.ratingRow}>
                    <Star size={14} weight="fill" color={THEME.colors.accentWarm} />
                    <Text style={styles.ratingText}>{post.rating.toFixed(1)}/5.0</Text>
                    {isPlaying && (
                      <Text style={styles.previewPlayingTag}>In riproduzione 30s</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Social Action Bar */}
              <View style={styles.actionBar}>
                <TouchableOpacity
                  onPress={() => toggleLike(post.id)}
                  style={styles.actionButton}
                  activeOpacity={0.7}
                >
                  <Heart
                    size={18}
                    weight={isLiked ? 'fill' : 'regular'}
                    color={isLiked ? THEME.colors.accentRotten : THEME.colors.textSecondary}
                  />
                  <Text style={[styles.actionCount, isLiked && { color: THEME.colors.accentRotten }]}>
                    {post.likes + (isLiked ? 1 : 0)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                  <ChatCircle size={18} color={THEME.colors.textSecondary} />
                  <Text style={styles.actionCount}>{post.comments}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                  <Repeat size={18} color={THEME.colors.textSecondary} />
                  <Text style={styles.actionCount}>4</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionLabel: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  feed: {
    flex: 1,
  },
  postCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  authorMeta: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  postText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  albumCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bgElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  coverContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  albumCover: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumDetails: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  albumTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  albumArtist: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    color: THEME.colors.accentWarm,
    fontSize: 12,
    fontWeight: '700',
  },
  previewPlayingTag: {
    color: THEME.colors.accentFresh,
    fontSize: 10,
    marginLeft: 6,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
  },
});
