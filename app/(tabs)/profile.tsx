import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LogOut,
  Settings,
  Film,
  Heart,
  Eye,
  Edit2,
  Trash2,
  Globe,
  Lock,
  Sparkles,
  Check,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/lib/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { VideoCard } from '@/components/VideoCard';
import { deleteVideo, toggleVideoVisibility } from '@/lib/videoService';
import { formatCount } from '@/lib/format';
import type { VideoWithCreator } from '@/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, refreshProfile, updateProfile } = useAuth();
  const [videos, setVideos] = useState<VideoWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchVideos = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase
      .from('videos')
      .select(
        'id, user_id, title, prompt, style, status, thumbnail_url, video_url, duration, aspect_ratio, is_public, likes_count, views_count, model, created_at, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVideos(data as unknown as VideoWithCreator[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const totalLikes = videos.reduce((sum, v) => sum + v.likes_count, 0);
  const totalViews = videos.reduce((sum, v) => sum + v.views_count, 0);

  const handlePress = (videoId: string) => {
    router.push(`/video/${videoId}`);
  };

  const handleDelete = (videoId: string, title: string) => {
    Alert.alert(
      'Delete video',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteVideo(videoId);
            if (error) {
              Alert.alert('Error', error);
            } else {
              setVideos((prev) => prev.filter((v) => v.id !== videoId));
            }
          },
        },
      ]
    );
  };

  const handleToggleVisibility = async (videoId: string, current: boolean) => {
    const { error } = await toggleVideoVisibility(videoId, current);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, is_public: !current } : v))
      );
    }
  };

  const openEditModal = () => {
    setEditName(profile?.full_name || '');
    setEditBio(profile?.bio || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await updateProfile({
      full_name: editName.trim(),
      bio: editBio.trim(),
    });
    setSavingProfile(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setEditModalVisible(false);
    }
  };

  if (loading && videos.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary[400]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <VideoCard video={item} onPress={handlePress} compact />
            {item.user_id === user?.id && (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => handleToggleVisibility(item.id, item.is_public)}
                >
                  {item.is_public ? (
                    <>
                      <Globe size={14} color={COLORS.neutral[400]} strokeWidth={2} />
                      <Text style={styles.cardActionText}>Public</Text>
                    </>
                  ) : (
                    <>
                      <Lock size={14} color={COLORS.neutral[400]} strokeWidth={2} />
                      <Text style={styles.cardActionText}>Private</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardActionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(item.id, item.title)}
                >
                  <Trash2 size={14} color={COLORS.error[400]} strokeWidth={2} />
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingTop: 320 + insets.top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              fetchVideos(true);
              refreshProfile();
            }}
            tintColor={COLORS.primary[400]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Film size={40} color={COLORS.neutral[700]} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptyText}>
              Head to the Create tab to generate your first AI video
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(tabs)/create')}
              activeOpacity={0.85}
            >
              <Sparkles size={16} color={COLORS.neutral[950]} strokeWidth={2} />
              <Text style={styles.emptyBtnText}>Create your first video</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Fixed header with profile info */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerActions}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={openEditModal} activeOpacity={0.7}>
              <Edit2 size={18} color={COLORS.neutral[300]} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Alert.alert(
                  'Sign out',
                  'Are you sure you want to sign out?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <LogOut size={18} color={COLORS.neutral[300]} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <View />
            ) : null}
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {(profile?.username || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            {profile && (
              <View style={styles.planBadge}>
                <Text style={styles.planText}>{profile.plan}</Text>
              </View>
            )}
          </View>

          <View style={styles.profileDetails}>
            <Text style={styles.displayName}>{profile?.full_name || profile?.username || 'Creator'}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            <View style={styles.creditsRow}>
              <Sparkles size={14} color={COLORS.secondary[400]} strokeWidth={2} />
              <Text style={styles.creditsText}>{profile?.credits ?? 0} credits</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Film size={16} color={COLORS.neutral[400]} strokeWidth={2} />
            <Text style={styles.statValue}>{formatCount(videos.length)}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statBox}>
            <Heart size={16} color={COLORS.neutral[400]} strokeWidth={2} />
            <Text style={styles.statValue}>{formatCount(totalLikes)}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statBox}>
            <Eye size={16} color={COLORS.neutral[400]} strokeWidth={2} />
            <Text style={styles.statValue}>{formatCount(totalViews)}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
        </View>
      </View>

      {/* Edit profile modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setEditModalVisible(false)}
              >
                <X size={20} color={COLORS.neutral[400]} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Full name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={COLORS.neutral[600]}
            />

            <Text style={styles.modalLabel}>Bio</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell the world about your work..."
              placeholderTextColor={COLORS.neutral[600]}
              multiline
              textAlignVertical="top"
              maxLength={150}
            />

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.85}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color={COLORS.neutral[950]} />
              ) : (
                <>
                  <Check size={18} color={COLORS.neutral[950]} strokeWidth={2} />
                  <Text style={styles.saveBtnText}>Save changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.neutral[950],
    borderBottomColor: COLORS.neutral[800],
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: COLORS.neutral[0],
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: COLORS.neutral[0],
  },
  planBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.secondary[400],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: COLORS.neutral[950],
    textTransform: 'capitalize',
  },
  profileDetails: {
    flex: 1,
  },
  displayName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: COLORS.neutral[0],
    marginBottom: 2,
  },
  username: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[400],
    marginBottom: 6,
  },
  bio: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[300],
    lineHeight: 18,
    marginBottom: 8,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creditsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: COLORS.secondary[400],
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.neutral[900],
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    gap: 4,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: COLORS.neutral[0],
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[500],
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  row: {
    gap: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: -10,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.neutral[900],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  cardActionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: COLORS.neutral[400],
  },
  deleteBtn: {
    borderColor: COLORS.error[500] + '40',
  },
  deleteText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: COLORS.error[400],
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: COLORS.neutral[0],
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.neutral[400],
    textAlign: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[400],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.neutral[950],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.neutral[900],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: COLORS.neutral[0],
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.neutral[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: COLORS.neutral[300],
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.neutral[800],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: COLORS.neutral[0],
    marginBottom: 16,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[400],
    borderRadius: 14,
    height: 52,
    marginTop: 8,
  },
  saveBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: COLORS.neutral[950],
  },
});
