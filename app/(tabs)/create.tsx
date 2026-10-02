import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
  FadeOutDown,
} from 'react-native-reanimated';
import {
  Sparkles,
  Wand2,
  ChevronDown,
  ChevronUp,
  Lock,
  Globe,
  Zap,
  Clock,
  AlertCircle,
  Check,
  ArrowRight,
} from 'lucide-react-native';
import { COLORS } from '@/lib/colors';
import { useAuth } from '@/context/AuthContext';
import { generateVideo, type GenerationStage } from '@/lib/videoService';
import { router, useFocusEffect } from 'expo-router';
import { FadeIn, SlideIn, PressableScale, ProgressBar, Pulse } from '@/components/Animations';
import {
  VIDEO_STYLES,
  ASPECT_RATIOS,
  AI_MODELS,
  TRENDING_PROMPTS,
  type AspectRatio,
  type GenerationParams,
  STRESS_TEST_PROMPT,
} from '@/types';

const { width } = Dimensions.get('window');

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued for generation',
  encoding_prompt: 'Encoding your prompt',
  diffusing: 'Running diffusion model',
  decoding_frames: 'Decoding video frames',
  encoding_video: 'Encoding video',
  finalizing: 'Finalizing your video',
};

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [model, setModel] = useState('neura-motion-v1');
  const [isPublic, setIsPublic] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [generatedVideoId, setGeneratedVideoId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const previewNavigatedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile])
  );

  const creditsNeeded = duration + (model === 'neura-motion-v2' ? 2 : model === 'diffusion-cine' ? 5 : 0);
  const hasEnoughCredits = (profile?.credits ?? 0) >= creditsNeeded;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Empty prompt', 'Please describe the video you want to create.');
      return;
    }
    if (!hasEnoughCredits) {
      Alert.alert('Not enough credits', 'You need more credits to generate this video.');
      return;
    }

    setGenerating(true);
    setProgress(0);
    setStageLabel('Starting...');
    setPreviewReady(false);
    setGeneratedVideoId(null);
    previewNavigatedRef.current = false;

    const params: GenerationParams = {
      prompt: prompt.trim(),
      style,
      duration,
      aspect_ratio: aspectRatio,
      model,
      is_public: isPublic,
    };

    const { video, error } = await generateVideo(params, {
      onProgress: (pct, stage) => {
        setProgress(pct);
        setStageLabel(stage);
      },
      onPreviewReady: (videoId) => {
        setPreviewReady(true);
        setGeneratedVideoId(videoId);
        // Enter the player at the first playable preview; it will keep polling
        // and swap to the final asset without resetting the media element.
        if (!previewNavigatedRef.current) {
          previewNavigatedRef.current = true;
          router.push(`/video/${videoId}`);
        }
      },
      onError: (err) => {
        Alert.alert('Generation failed', err);
      },
    });

    setGenerating(false);

    if (error) {
      return;
    }

    await refreshProfile();
    if (!previewNavigatedRef.current) router.push(`/video/${video.id}`);
  };

  const usePrompt = (p: string) => {
    setPrompt(p);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!generating}
      >
        <FadeIn duration={300}>
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Wand2 size={24} color={COLORS.primary[400]} strokeWidth={2} />
              <Text style={styles.title}>Create Video</Text>
            </View>
            <Text style={styles.subtitle}>
              Describe your vision and let AI bring it to life
            </Text>
          </View>
        </FadeIn>

        {/* Credits banner */}
        <SlideIn from="bottom" delay={50}>
          <View style={styles.creditsBanner}>
            <View style={styles.creditsLeft}>
              <Sparkles size={16} color={COLORS.secondary[400]} strokeWidth={2} />
              <Text style={styles.creditsText}>
                {profile ? `${profile.credits} credits available` : 'Syncing credits…'}
              </Text>
            </View>
            <Text style={styles.creditsCost}>
              This generation: {creditsNeeded} credits
            </Text>
          </View>
        </SlideIn>

        {/* Generation overlay - replaces form during generation */}
        {generating ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutDown.duration(200)}
            style={styles.generationOverlay}
          >
            <Pulse duration={2000}>
              <View style={styles.genIconWrap}>
                <Wand2 size={36} color={COLORS.primary[400]} strokeWidth={2} />
              </View>
            </Pulse>

            <Text style={styles.genTitle}>Generating your video</Text>
            <Text style={styles.genStage}>{stageLabel}</Text>

            <View style={styles.genProgressSection}>
              <ProgressBar progress={progress} height={8} color={COLORS.primary[400]} style={styles.genProgressBar} />
              <Text style={styles.genProgressText}>{progress}%</Text>
            </View>

            {/* Stage indicators */}
            <View style={styles.stageRow}>
              {Object.entries(STAGE_LABELS).map(([key, label], i) => {
                const stageThresholds = [0, 10, 25, 65, 85, 95];
                const threshold = stageThresholds[i] || 100;
                const isComplete = progress >= (stageThresholds[i + 1] || 100);
                const isActive = progress >= threshold && !isComplete;

                return (
                  <View key={key} style={styles.stageItem}>
                    <View style={[
                      styles.stageDot,
                      isComplete && styles.stageDotComplete,
                      isActive && styles.stageDotActive,
                    ]}>
                      {isComplete && <Check size={10} color={COLORS.neutral[950]} strokeWidth={3} />}
                    </View>
                    <Text style={[
                      styles.stageLabel,
                      isComplete && styles.stageLabelComplete,
                      isActive && styles.stageLabelActive,
                    ]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {previewReady && (
              <Animated.View
                entering={FadeInDown.duration(400)}
                style={styles.previewReadyBox}
              >
                <Check size={18} color={COLORS.success[500]} strokeWidth={2} />
                <Text style={styles.previewReadyText}>Preview is ready — redirecting to player...</Text>
              </Animated.View>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Prompt input */}
            <View style={styles.section}>
              <Text style={styles.label}>Prompt</Text>
              <TextInput
                style={styles.promptInput}
                placeholder="A cinematic shot of a rocket launching into a starry sky at dusk..."
                placeholderTextColor={COLORS.neutral[600]}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <View style={styles.promptFooter}>
                <Text style={styles.charCount}>{prompt.length}/500</Text>
              </View>
            </View>

            {/* Trending prompts */}
            {prompt.length === 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Try a trending prompt</Text>
                <View style={styles.promptChips}>
                  <PressableScale onPress={() => { setPrompt(STRESS_TEST_PROMPT); setDuration(45); setStyle('cinematic'); }} style={[styles.promptChip, styles.benchmarkChip]}>
                    <Text style={styles.promptChipText} numberOfLines={2}>🎞️ Run cinematic stress test · 45s</Text>
                  </PressableScale>
                  {TRENDING_PROMPTS.slice(0, 4).map((p, i) => (
                    <PressableScale
                      key={i}
                      onPress={() => usePrompt(p)}
                      style={styles.promptChip}
                    >
                      <Text style={styles.promptChipText} numberOfLines={2}>
                        {p}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            )}

            {/* Style selector */}
            <View style={styles.section}>
              <Text style={styles.label}>Style</Text>
              <View style={styles.styleGrid}>
                {VIDEO_STYLES.map((s) => (
                  <PressableScale
                    key={s.id}
                    onPress={() => setStyle(s.id)}
                    style={[styles.styleChip, style === s.id && styles.styleChipActive]}
                  >
                    <Text style={styles.styleEmoji}>{s.icon}</Text>
                    <Text style={[styles.styleLabel, style === s.id && styles.styleLabelActive]}>
                      {s.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Duration: <Text style={styles.labelValue}>{duration}s</Text>
              </Text>
              <View style={styles.durationRow}>
                {[3, 5, 8, 10, 15, 30, 45].map((d) => (
                  <PressableScale
                    key={d}
                    onPress={() => setDuration(d)}
                    style={[styles.durBtn, duration === d && styles.durBtnActive]}
                  >
                    <Text style={[styles.durText, duration === d && styles.durTextActive]}>
                      {d}s
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Aspect ratio */}
            <View style={styles.section}>
              <Text style={styles.label}>Aspect ratio</Text>
              <View style={styles.aspectRow}>
                {ASPECT_RATIOS.map((ar) => (
                  <PressableScale
                    key={ar.id}
                    onPress={() => setAspectRatio(ar.id)}
                    style={[styles.aspectBtn, aspectRatio === ar.id && styles.aspectBtnActive]}
                  >
                    <View
                      style={[
                        styles.aspectPreview,
                        {
                          width: 30 * (ar.w / Math.max(ar.w, ar.h)),
                          height: 30 * (ar.h / Math.max(ar.w, ar.h)),
                        },
                        aspectRatio === ar.id && styles.aspectPreviewActive,
                      ]}
                    />
                    <Text style={[styles.aspectLabel, aspectRatio === ar.id && styles.aspectLabelActive]}>
                      {ar.id}
                    </Text>
                    <Text style={styles.aspectDesc}>{ar.label}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Advanced settings */}
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
              activeOpacity={0.7}
            >
              <Text style={styles.advancedText}>Advanced settings</Text>
              {showAdvanced ? (
                <ChevronUp size={18} color={COLORS.neutral[400]} strokeWidth={2} />
              ) : (
                <ChevronDown size={18} color={COLORS.neutral[400]} strokeWidth={2} />
              )}
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedSection}>
                {/* Model selection */}
                <View style={styles.section}>
                  <Text style={styles.label}>AI Model</Text>
                  <View style={styles.modelList}>
                    {AI_MODELS.map((m) => (
                      <PressableScale
                        key={m.id}
                        onPress={() => setModel(m.id)}
                        style={[styles.modelCard, model === m.id && styles.modelCardActive]}
                      >
                        <View style={styles.modelHeader}>
                          <Text style={[styles.modelName, model === m.id && styles.modelNameActive]}>
                            {m.label}
                          </Text>
                          {m.speed === 'fast' && <Zap size={13} color={COLORS.secondary[400]} strokeWidth={2} />}
                          {m.speed === 'slow' && <Clock size={13} color={COLORS.warning[400]} strokeWidth={2} />}
                          {m.speed === 'slowest' && <Clock size={13} color={COLORS.error[400]} strokeWidth={2} />}
                        </View>
                        <Text style={styles.modelDesc}>{m.desc}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>

                {/* Visibility */}
                <View style={styles.section}>
                  <Text style={styles.label}>Visibility</Text>
                  <View style={styles.visibilityRow}>
                    <PressableScale
                      onPress={() => setIsPublic(true)}
                      style={[styles.visBtn, isPublic && styles.visBtnActive]}
                    >
                      <Globe size={16} color={isPublic ? COLORS.neutral[950] : COLORS.neutral[400]} strokeWidth={2} />
                      <Text style={[styles.visText, isPublic && styles.visTextActive]}>Public</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={() => setIsPublic(false)}
                      style={[styles.visBtn, !isPublic && styles.visBtnActive]}
                    >
                      <Lock size={16} color={!isPublic ? COLORS.neutral[950] : COLORS.neutral[400]} strokeWidth={2} />
                      <Text style={[styles.visText, !isPublic && styles.visTextActive]}>Private</Text>
                    </PressableScale>
                  </View>
                </View>
              </View>
            )}

            <View style={{ height: 120 }} />
          </Animated.View>
        )}
      </ScrollView>

      {/* Generate button - fixed bottom */}
      {!generating && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <PressableScale
            onPress={handleGenerate}
            scaleTo={0.97}
            style={[styles.genBtn, !hasEnoughCredits && styles.genBtnDisabled]}
          >
            <Wand2 size={20} color={COLORS.neutral[950]} strokeWidth={2} />
            <Text style={styles.genBtnText}>Generate Video</Text>
            <View style={styles.genBtnCredits}>
              <Text style={styles.genBtnCreditsText}>{creditsNeeded}</Text>
            </View>
          </PressableScale>
          {!hasEnoughCredits && (
            <View style={styles.creditWarning}>
              <AlertCircle size={13} color={COLORS.warning[400]} strokeWidth={2} />
              <Text style={styles.creditWarningText}>
                Not enough credits for this configuration
              </Text>
            </View>
          )}
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
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerSection: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: COLORS.neutral[0],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.neutral[400],
  },
  creditsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.neutral[900],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.secondary[400],
  },
  creditsCost: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.neutral[400],
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: COLORS.neutral[200],
    marginBottom: 12,
  },
  labelValue: {
    color: COLORS.primary[400],
  },
  promptInput: {
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    borderRadius: 14,
    padding: 16,
    minHeight: 120,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: COLORS.neutral[0],
    lineHeight: 22,
  },
  promptFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.neutral[600],
  },
  promptChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    borderRadius: 10,
    padding: 12,
    width: (width - 48) / 2,
  },
  benchmarkChip: {
    borderColor: COLORS.primary[400],
    backgroundColor: COLORS.primary[400] + '18',
    width: '100%',
  },
  promptChipText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.neutral[300],
    lineHeight: 17,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  styleChipActive: {
    backgroundColor: COLORS.primary[400] + '20',
    borderColor: COLORS.primary[400],
  },
  styleEmoji: {
    fontSize: 14,
  },
  styleLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: COLORS.neutral[300],
  },
  styleLabelActive: {
    color: COLORS.primary[300],
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  durBtnActive: {
    backgroundColor: COLORS.primary[400],
    borderColor: COLORS.primary[400],
  },
  durText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.neutral[300],
  },
  durTextActive: {
    color: COLORS.neutral[950],
  },
  aspectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  aspectBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    gap: 8,
  },
  aspectBtnActive: {
    backgroundColor: COLORS.primary[400] + '20',
    borderColor: COLORS.primary[400],
  },
  aspectPreview: {
    borderWidth: 1.5,
    borderColor: COLORS.neutral[600],
    borderRadius: 4,
  },
  aspectPreviewActive: {
    borderColor: COLORS.primary[400],
    backgroundColor: COLORS.primary[400] + '30',
  },
  aspectLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: COLORS.neutral[300],
  },
  aspectLabelActive: {
    color: COLORS.primary[300],
  },
  aspectDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[500],
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral[800],
  },
  advancedText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.neutral[300],
  },
  advancedSection: {
    paddingTop: 12,
  },
  modelList: {
    gap: 8,
  },
  modelCard: {
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    borderRadius: 12,
    padding: 14,
  },
  modelCardActive: {
    borderColor: COLORS.primary[400],
    backgroundColor: COLORS.primary[400] + '10',
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modelName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.neutral[200],
  },
  modelNameActive: {
    color: COLORS.primary[300],
  },
  modelDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.neutral[500],
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
  },
  visBtnActive: {
    backgroundColor: COLORS.primary[400],
    borderColor: COLORS.primary[400],
  },
  visText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: COLORS.neutral[400],
  },
  visTextActive: {
    color: COLORS.neutral[950],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.neutral[950] + 'f0',
    borderTopColor: COLORS.neutral[800],
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary[400],
    borderRadius: 14,
    height: 54,
  },
  genBtnDisabled: {
    opacity: 0.5,
  },
  genBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: COLORS.neutral[950],
  },
  genBtnCredits: {
    backgroundColor: COLORS.neutral[950] + '30',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genBtnCreditsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: COLORS.neutral[950],
  },
  creditWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  creditWarningText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.warning[400],
  },
  // Generation overlay styles
  generationOverlay: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  genIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.primary[800],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  genTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: COLORS.neutral[0],
    marginBottom: 8,
  },
  genStage: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: COLORS.primary[300],
    marginBottom: 32,
  },
  genProgressSection: {
    width: '100%',
    marginBottom: 32,
  },
  genProgressBar: {
    marginBottom: 8,
  },
  genProgressText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: COLORS.neutral[400],
    textAlign: 'center',
  },
  stageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 24,
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.neutral[900],
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stageDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDotActive: {
    backgroundColor: COLORS.primary[400],
  },
  stageDotComplete: {
    backgroundColor: COLORS.success[500],
  },
  stageLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[500],
  },
  stageLabelActive: {
    color: COLORS.primary[300],
  },
  stageLabelComplete: {
    color: COLORS.neutral[300],
  },
  previewReadyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.success[500] + '15',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.success[500] + '30',
  },
  previewReadyText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: COLORS.success[500],
  },
});
