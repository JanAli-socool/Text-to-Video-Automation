import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  FlatList,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  Eye,
  Share2,
  Clock,
  Film,
  Cpu,
  Tag,
  Globe,
  Lock,
  Sparkles,
  RefreshCw,
  MonitorPlay,
  Download,
} from 'lucide-react-native';
import { COLORS } from '@/lib/colors';
import { supabase } from '@/lib/supabase';
import { formatCount, formatDuration, timeAgo } from '@/lib/format';
import { FadeIn, SlideIn, PressableScale } from '@/components/Animations';
import { VideoPlayer, type PlayerState } from '@/components/VideoPlayer';
import { VideoCard } from '@/components/VideoCard';
import { pollVideoStatus } from '@/lib/videoService';
import type { VideoWithCreator, Profile } from '@/types';

const { width: screenWidth } = Dimensions.get('window');

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [video, setVideo] = useState<VideoWithCreator | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoWithCreator[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchVideo = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setPlayerState('loading');

    const { data, error } = await supabase
      .from('videos')
      .select(
        'id, user_id, title, prompt, style, status, thumbnail_url, video_url, duration, aspect_ratio, is_public, likes_count, views_count, model, created_at, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)'
      )
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      const videoData = data as unknown as VideoWithCreator;
      setVideo(videoData);

      if (videoData.status === 'processing') {
        // A processing record can already have a playable progressive preview.
        setPlayerState(videoData.video_url ? 'playing' : 'generating');
        startPolling(videoData.id);
      } else if (videoData.status === 'completed' && videoData.video_url) {
        setPlayerState('playing');
      } else if (videoData.status === 'failed') {
        setPlayerState('error');
      }

      const { data: creatorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user_id)
        .maybeSingle();
      if (creatorData) setCreator(creatorData as Profile);

      // Fetch related videos (same style, excluding current)
      const { data: related } = await supabase
        .from('videos')
        .select(
          'id, user_id, title, prompt, style, status, thumbnail_url, video_url, duration, aspect_ratio, is_public, likes_count, views_count, model, created_at, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)'
        )
        .eq('is_public', true)
        .eq('status', 'completed')
        .neq('id', id)
        .order('likes_count', { ascending: false })
        .limit(6);

      if (related) setRelatedVideos(related as unknown as VideoWithCreator[]);
    } else {
      setPlayerState('error');
    }

    setLoading(false);
  }, [id]);

  const startPolling = useCallback((videoId: string) => {
    setPolling(true);

    const poll = async () => {
      const result = await pollVideoStatus(videoId, (updated) => {
        setVideo((prev) => (prev ? { ...prev, ...updated } : prev));
        // Switch to playback as soon as the URL is present; completion is not
        // required for a progressive preview.
        if (updated.video_url && updated.status !== 'failed') setPlayerState('playing');
        else if (updated.status === 'processing') setPlayerState('generating');
      }, 2000, 60);

      setPolling(false);

      if (result && result.status === 'completed') {
        setVideo((prev) => (prev ? { ...prev, ...result } : prev));
        setPlayerState('playing');
      } else if (result && result.status === 'failed') {
        setPlayerState('error');
      }
    };

    poll();
  }, []);

  useEffect(() => {
    fetchVideo();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchVideo]);

  const handleShare = async () => {
    if (!video) return;
    try {
      await Share.share({
        message: `Check out "${video.title}" on NeuraMotion - AI-generated video!`,
      });
    } catch {}
  };

  const handleRetry = () => {
    fetchVideo();
  };

  const handleDownload = async () => {
    if (!video?.video_url || video.video_url.startsWith('mock://')) {
      Alert.alert('Demo preview', 'This demo render is an interactive preview, not an MP4 file. Downloads become available when a real video asset is attached.');
      return;
    }
    try {
      await Linking.openURL(video.video_url);
    } catch {
      Alert.alert('Download unavailable', 'The video file could not be opened for download.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary[400]} />
      </View>
    );
  }

  if (!video) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>Video not found</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const aspect = video.aspect_ratio === '9:16' ? 9 / 16 : video.aspect_ratio === '1:1' ? 1 : 16 / 9;

  const handleRelatedPress = (videoId: string) => {
    router.push(`/video/${videoId}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Player */}
        <FadeIn duration={400}>
          <VideoPlayer
            thumbnailUrl={video.thumbnail_url}
            videoUrl={video.video_url}
            aspectRatio={video.aspect_ratio}
            duration={video.duration}
            state={playerState}
            progress={polling ? 50 : 100}
            errorMessage={video.status === 'failed' ? 'Generation failed' : undefined}
            onRetry={handleRetry}
          />
        </FadeIn>

        {/* Action bar */}
        <SlideIn from="bottom" delay={100}>
          <View style={styles.actionBar}>
            <PressableScale onPress={() => setLiked(!liked)} style={styles.actionBtn}>
              <Heart
                size={22}
                color={liked ? COLORS.accent[400] : COLORS.neutral[400]}
                strokeWidth={2}
                fill={liked ? COLORS.accent[400] : 'none'}
              />
              <Text style={[styles.actionText, liked && styles.actionTextLiked]}>
                {formatCount(video.likes_count + (liked ? 1 : 0))}
              </Text>
            </PressableScale>

            <View style={styles.actionBtn}>
              <Eye size={20} color={COLORS.neutral[400]} strokeWidth={2} />
              <Text style={styles.actionText}>{formatCount(video.views_count)}</Text>
            </View>

            <PressableScale onPress={handleShare} style={styles.actionBtn}>
              <Share2 size={20} color={COLORS.neutral[400]} strokeWidth={2} />
              <Text style={styles.actionText}>Share</Text>
            </PressableScale>

            <PressableScale onPress={handleDownload} style={styles.actionBtn}>
              <Download size={20} color={COLORS.neutral[400]} strokeWidth={2} />
              <Text style={styles.actionText}>Download</Text>
            </PressableScale>

            <View style={[styles.visibilityTag, video.is_public ? styles.tagPublic : styles.tagPrivate]}>
              {video.is_public ? (
                <Globe size={13} color={COLORS.success[500]} strokeWidth={2} />
              ) : (
                <Lock size={13} color={COLORS.neutral[400]} strokeWidth={2} />
              )}
              <Text style={[styles.visibilityText, video.is_public ? styles.visibilityTextPublic : null]}>
                {video.is_public ? 'Public' : 'Private'}
              </Text>
            </View>
          </View>
        </SlideIn>

        <SlideIn from="bottom" delay={125}>
          <TouchableOpacity style={styles.webViewButton} onPress={() => router.push(`/web-view?id=${video.id}`)} activeOpacity={0.8}>
            <MonitorPlay size={17} color={COLORS.primary[300]} strokeWidth={2} />
            <Text style={styles.webViewButtonText}>Open Web View</Text>
          </TouchableOpacity>
        </SlideIn>

        {/* Title and meta */}
        <SlideIn from="bottom" delay={150}>
          <View style={styles.section}>
            <Text style={styles.videoTitle}>{video.title}</Text>
            <Text style={styles.timeAgoText}>{timeAgo(video.created_at)}</Text>
          </View>
        </SlideIn>

        {/* Creator card */}
        {creator && (
          <SlideIn from="bottom" delay={200}>
            <View style={styles.creatorCard}>
              <View style={styles.creatorAvatarFallback}>
                <Text style={styles.creatorAvatarLetter}>
                  {(creator.username || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{creator.full_name || creator.username}</Text>
                <Text style={styles.creatorUsername}>@{creator.username}</Text>
              </View>
              {creator.bio ? (
                <Text style={styles.creatorBio} numberOfLines={2}>
                  {creator.bio}
                </Text>
              ) : null}
            </View>
          </SlideIn>
        )}

        {/* Prompt */}
        <SlideIn from="bottom" delay={250}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Prompt</Text>
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>{video.prompt}</Text>
            </View>
          </View>
        </SlideIn>

        {/* Generation details */}
        <SlideIn from="bottom" delay={300}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Generation details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <View style={styles.detailIconWrap}>
                  <Tag size={15} color={COLORS.primary[400]} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Style</Text>
                  <Text style={styles.detailValue}>{video.style}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIconWrap}>
                  <Cpu size={15} color={COLORS.primary[400]} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Model</Text>
                  <Text style={styles.detailValue}>{video.model}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIconWrap}>
                  <Clock size={15} color={COLORS.primary[400]} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{formatDuration(video.duration)}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIconWrap}>
                  <Film size={15} color={COLORS.primary[400]} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Aspect ratio</Text>
                  <Text style={styles.detailValue}>{video.aspect_ratio}</Text>
                </View>
              </View>
            </View>
          </View>
        </SlideIn>

        {/* Related videos */}
        {relatedVideos.length > 0 && (
          <SlideIn from="bottom" delay={350}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>More like this</Text>
              <FlatList
                data={relatedVideos.slice(0, 4)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <VideoCard video={item} onPress={handleRelatedPress} compact />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedList}
                ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
              />
            </View>
          </SlideIn>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <ArrowLeft size={22} color={COLORS.neutral[0]} strokeWidth={2} />
      </TouchableOpacity>

      {/* Polling indicator */}
      {polling && (
        <View style={[styles.pollingBadge, { top: insets.top + 16 }]}>
          <RefreshCw size={13} color={COLORS.warning[400]} strokeWidth={2} />
          <Text style={styles.pollingText}>Checking...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[950],
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.neutral[950],
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.neutral[950],
    gap: 16,
  },
  errorTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: COLORS.neutral[0],
  },
  goBackBtn: {
    backgroundColor: COLORS.primary[400],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  goBackText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: COLORS.neutral[950],
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pollingBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
  },
  pollingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: COLORS.warning[400],
  },
  scrollContent: {
    paddingBottom: 40,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[800],
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: COLORS.neutral[300],
  },
  actionTextLiked: {
    color: COLORS.accent[400],
  },
  webViewButton: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary[400] + '55',
    backgroundColor: COLORS.primary[400] + '12',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  webViewButtonText: {
    color: COLORS.primary[300],
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  visibilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagPublic: {
    backgroundColor: COLORS.success[500] + '15',
  },
  tagPrivate: {
    backgroundColor: COLORS.neutral[800],
  },
  visibilityText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: COLORS.neutral[400],
  },
  visibilityTextPublic: {
    color: COLORS.success[500],
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  videoTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: COLORS.neutral[0],
    lineHeight: 28,
    marginBottom: 6,
  },
  timeAgoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[500],
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: COLORS.neutral[900],
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  creatorAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarLetter: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: COLORS.neutral[0],
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: COLORS.neutral[0],
  },
  creatorUsername: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[400],
  },
  creatorBio: {
    width: '100%',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[400],
    lineHeight: 18,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.neutral[300],
    marginBottom: 10,
  },
  promptBox: {
    backgroundColor: COLORS.neutral[900],
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  promptText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: COLORS.neutral[200],
    lineHeight: 22,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.neutral[900],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    width: '48%',
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary[400] + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[500],
  },
  detailValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: COLORS.neutral[200],
    textTransform: 'capitalize',
  },
  relatedList: {
    paddingRight: 20,
  },
});
