import { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Heart, Eye, Play } from 'lucide-react-native';
import { COLORS } from '@/lib/colors';
import { formatCount, formatDuration, timeAgo } from '@/lib/format';
import type { VideoWithCreator } from '@/types';

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 48) / 2;

interface VideoCardProps {
  video: VideoWithCreator;
  onPress: (videoId: string) => void;
  compact?: boolean;
}

function VideoCardBase({ video, onPress, compact }: VideoCardProps) {
  const aspect = video.aspect_ratio === '9:16' ? 9 / 16 : video.aspect_ratio === '1:1' ? 1 : 16 / 9;
  const thumbHeight = compact ? cardWidth * 0.65 : cardWidth / aspect;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => onPress(video.id)}
    >
      <View style={[styles.thumbWrap, { height: thumbHeight }]}>
        <Image source={{ uri: video.thumbnail_url }} style={styles.thumbnail} />
        <View style={styles.overlay}>
          <View style={styles.playBtn}>
            <Play size={18} color={COLORS.neutral[0]} strokeWidth={2} fill={COLORS.neutral[0]} />
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </View>
        </View>
        {video.status === 'processing' && (
          <View style={styles.processingBadge}>
            <Text style={styles.processingText}>Processing</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <View style={styles.meta}>
          {video.profiles?.avatar_url ? (
            <Image source={{ uri: video.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(video.profiles?.username || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.username} numberOfLines={1}>
            {video.profiles?.username || 'Unknown'}
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Heart size={12} color={COLORS.neutral[500]} strokeWidth={2} />
            <Text style={styles.statText}>{formatCount(video.likes_count)}</Text>
          </View>
          <View style={styles.statItem}>
            <Eye size={12} color={COLORS.neutral[500]} strokeWidth={2} />
            <Text style={styles.statText}>{formatCount(video.views_count)}</Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo(video.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const VideoCard = memo(VideoCardBase);

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: COLORS.neutral[900],
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  thumbWrap: {
    width: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral[950] + '80',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.neutral[0] + '30',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.neutral[950] + '90',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  durationText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: COLORS.neutral[0],
  },
  processingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.warning[500] + '90',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  processingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: COLORS.neutral[950],
  },
  info: {
    padding: 12,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: COLORS.neutral[0],
    lineHeight: 18,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  avatarFallback: {
    backgroundColor: COLORS.neutral[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: COLORS.neutral[0],
  },
  username: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.neutral[400],
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[500],
  },
  timeAgo: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[600],
    marginLeft: 'auto',
  },
});
