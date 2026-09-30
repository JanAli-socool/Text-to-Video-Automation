import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, TrendingUp, Clock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/colors';
import { VideoCard } from '@/components/VideoCard';
import type { VideoWithCreator } from '@/types';

type Tab = 'trending' | 'recent';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VideoWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('trending');

  const fetchVideos = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const orderCol = tab === 'trending' ? 'likes_count' : 'created_at';

    const { data, error } = await supabase
      .from('videos')
      .select(
        'id, user_id, title, prompt, style, status, thumbnail_url, video_url, duration, aspect_ratio, is_public, likes_count, views_count, model, created_at, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)'
      )
      .eq('is_public', true)
      .eq('status', 'completed')
      .order(orderCol, { ascending: false })
      .limit(30);

    if (!error && data) {
      setVideos(data as unknown as VideoWithCreator[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handlePress = (videoId: string) => {
    router.push(`/video/${videoId}`);
  };

  const headerHeight = 160 + insets.top;

  if (loading && videos.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary[400]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <Sparkles size={22} color={COLORS.primary[400]} strokeWidth={2} />
            <Text style={styles.brandName}>NeuraMotion</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            AI-generated videos from the community
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'trending' && styles.tabBtnActive]}
            onPress={() => setTab('trending')}
            activeOpacity={0.7}
          >
            <TrendingUp size={15} color={tab === 'trending' ? COLORS.neutral[950] : COLORS.neutral[400]} strokeWidth={2} />
            <Text style={[styles.tabText, tab === 'trending' && styles.tabTextActive]}>
              Trending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'recent' && styles.tabBtnActive]}
            onPress={() => setTab('recent')}
            activeOpacity={0.7}
          >
            <Clock size={15} color={tab === 'recent' ? COLORS.neutral[950] : COLORS.neutral[400]} strokeWidth={2} />
            <Text style={[styles.tabText, tab === 'recent' && styles.tabTextActive]}>
              Latest
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VideoCard video={item} onPress={handlePress} />}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingTop: headerHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchVideos(true)}
            tintColor={COLORS.primary[400]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptyText}>
              Be the first to create and share an AI-generated video!
            </Text>
          </View>
        }
      />

      <View style={[styles.stickyHeader, { paddingTop: insets.top + 16, height: headerHeight }]}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <Sparkles size={22} color={COLORS.primary[400]} strokeWidth={2} />
            <Text style={styles.brandName}>NeuraMotion</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            AI-generated videos from the community
          </Text>
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'trending' && styles.tabBtnActive]}
            onPress={() => setTab('trending')}
            activeOpacity={0.7}
          >
            <TrendingUp size={15} color={tab === 'trending' ? COLORS.neutral[950] : COLORS.neutral[400]} strokeWidth={2} />
            <Text style={[styles.tabText, tab === 'trending' && styles.tabTextActive]}>
              Trending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'recent' && styles.tabBtnActive]}
            onPress={() => setTab('recent')}
            activeOpacity={0.7}
          >
            <Clock size={15} color={tab === 'recent' ? COLORS.neutral[950] : COLORS.neutral[400]} strokeWidth={2} />
            <Text style={[styles.tabText, tab === 'recent' && styles.tabTextActive]}>
              Latest
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.neutral[950],
    borderBottomColor: COLORS.neutral[800],
    borderBottomWidth: 1,
  },
  headerTop: {
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandName: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: COLORS.neutral[0],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[400],
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.neutral[900],
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary[400],
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: COLORS.neutral[400],
  },
  tabTextActive: {
    color: COLORS.neutral[950],
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  row: {
    gap: 16,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: COLORS.neutral[0],
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.neutral[400],
    textAlign: 'center',
  },
});
