import { createElement, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Play, Pause, Loader2, AlertCircle, RefreshCw } from 'lucide-react-native';
import { COLORS } from '@/lib/colors';
import { formatDuration } from '@/lib/format';

export type PlayerState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error' | 'generating';

interface VideoPlayerProps {
  thumbnailUrl: string;
  videoUrl: string;
  aspectRatio: string;
  duration: number;
  state: PlayerState;
  progress?: number; // 0-100 for generation progress
  errorMessage?: string;
  onRetry?: () => void;
  onPlay?: () => void;
}

function SpinningLoader({ color = COLORS.primary[400], size = 28 }: { color?: string; size?: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Loader2 size={size} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

function PulsingDots() {
  const dots = [0, 1, 2];
  return (
    <View style={pulsingDotsStyles.container}>
      {dots.map((i) => {
        const opacity = useSharedValue(0.3);
        const scale = useSharedValue(0.8);

        useEffect(() => {
          opacity.value = withRepeat(
            withDelay(i * 300, withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })),
            -1,
            true
          );
          scale.value = withRepeat(
            withDelay(i * 300, withSpring(1.2, { damping: 12, stiffness: 100 })),
            -1,
            true
          );
        }, [i]);

        const animatedStyle = useAnimatedStyle(() => ({
          opacity: opacity.value,
          transform: [{ scale: scale.value }],
        }));

        return <Animated.View key={i} style={[pulsingDotsStyles.dot, animatedStyle]} />;
      })}
    </View>
  );
}

function WebVideo({ videoUrl, thumbnailUrl }: { videoUrl: string; thumbnailUrl: string }) {
  return createElement('video', {
    src: videoUrl,
    poster: thumbnailUrl,
    controls: true,
    playsInline: true,
    preload: 'metadata',
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: '#0a0a0a' },
  });
}

function MockVideoSurface({ scene, isPlaying }: { scene: string; isPlaying: boolean }) {
  const palette = ['#172554,#0f766e', '#3b0764,#0e7490', '#451a03,#9f1239', '#052e16,#164e63', '#1e1b4b,#7c2d12', '#111827,#1d4ed8', '#312e81,#be123c', '#082f49,#713f12'];
  const index = Math.abs(scene.split('').reduce((n, c) => n + c.charCodeAt(0), 0)) % palette.length;
  return createElement('div', {
    style: {
      position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', background: `linear-gradient(135deg, ${palette[index].replace(',', ' 0%, ')} 100%)`,
      fontFamily: 'Inter, Arial, sans-serif',
    },
  },
    createElement('div', { style: { position: 'absolute', width: '38%', height: '38%', borderRadius: '50%', background: 'rgba(45,212,191,.42)', filter: 'blur(28px)', animation: isPlaying ? 'mockFloat 3s ease-in-out infinite alternate' : 'none' } }),
    createElement('div', { style: { position: 'absolute', width: '24%', height: '70%', borderRadius: 18, background: 'linear-gradient(180deg, rgba(255,255,255,.72), rgba(45,212,191,.12))', transform: 'perspective(400px) rotateY(-18deg)', boxShadow: '0 0 60px rgba(45,212,191,.42)', animation: isPlaying ? 'mockDrift 4s ease-in-out infinite alternate' : 'none' } }),
    createElement('div', { style: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '42px 42px', transform: isPlaying ? 'scale(1.12)' : 'scale(1)', transition: 'transform 600ms ease' } }),
    createElement('div', { style: { zIndex: 2, textAlign: 'center', letterSpacing: 2, textShadow: '0 2px 18px #000' } },
      createElement('div', { style: { fontSize: 12, opacity: .72, textTransform: 'uppercase' } }, 'Demo render'),
      createElement('div', { style: { fontSize: 20, fontWeight: 700, marginTop: 6 } }, scene.replace('mock://', '').replaceAll('-', ' ')),
      createElement('div', { style: { fontSize: 11, opacity: .65, marginTop: 8 } }, isPlaying ? 'Playing preview' : 'Ready to play')
    ),
    createElement('style', null, '@keyframes mockFloat{from{transform:translate(-22%,12%) scale(.8)}to{transform:translate(30%,-12%) scale(1.2)}}@keyframes mockDrift{from{margin-left:-15%;transform:perspective(400px) rotateY(-18deg) translateY(8%)}to{margin-left:15%;transform:perspective(400px) rotateY(18deg) translateY(-8%)}}')
  );
}

export function VideoPlayer({
  thumbnailUrl,
  videoUrl,
  aspectRatio,
  duration,
  state,
  progress = 0,
  errorMessage,
  onRetry,
  onPlay,
}: VideoPlayerProps) {
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const playButtonScale = useSharedValue(1);
  const overlayOpacity = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  const aspect = aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '1:1' ? 1 : 16 / 9;
  const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
  const isMockVideo = isDemoMode || videoUrl.startsWith('mock://');
  const mockScene = videoUrl.startsWith('mock://') ? videoUrl : 'mock://library-demo';

  // Simulated playback progress (since mock videos have no real stream)
  useEffect(() => {
    if (state === 'playing' && isActuallyPlaying) {
      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.1;
          if (next >= duration) {
            setIsActuallyPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state, isActuallyPlaying, duration]);

  useEffect(() => {
    progressWidth.value = withSpring((currentTime / duration) * 100, { damping: 20, stiffness: 200 });
  }, [currentTime, duration]);

  const handlePlayPause = useCallback(() => {
    if (state === 'error') {
      onRetry?.();
      return;
    }
    if (state === 'generating' || state === 'loading' || state === 'buffering') return;

    setIsActuallyPlaying((prev) => {
      const next = !prev;
      overlayOpacity.value = withTiming(next ? 0 : 1, { duration: 300 });
      playButtonScale.value = withSpring(next ? 0.9 : 1, { damping: 15, stiffness: 200 });
      return next;
    });
    onPlay?.();
  }, [state, onRetry, onPlay]);

  const handlePressArea = useCallback(() => {
    if (isMockVideo) {
      handlePlayPause();
      return;
    }
    setShowControls((prev) => {
      if (prev && isActuallyPlaying) {
        overlayOpacity.value = withTiming(0, { duration: 300 });
        return false;
      }
      overlayOpacity.value = withTiming(1, { duration: 300 });
      return true;
    });
  }, [isActuallyPlaying, isMockVideo, handlePlayPause]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const playBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  const canPlay = state === 'playing';
  const isBusy = state === 'loading' || state === 'buffering' || state === 'generating';

  return (
    <View style={[styles.container, { aspectRatio: aspect }]}>
      <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />

      {/* A preview URL is published while the job is still processing. Keep the
          media element mounted between status updates so the browser/WebView can
          retain its buffered range and playback position. */}
      {isMockVideo && Platform.OS === 'web' && state !== 'generating' && state !== 'error' && (
        <MockVideoSurface scene={mockScene} isPlaying={isActuallyPlaying} />
      )}
      {!isMockVideo && videoUrl && state !== 'generating' && state !== 'error' && Platform.OS === 'web' && (
        <WebVideo videoUrl={videoUrl} thumbnailUrl={thumbnailUrl} />
      )}
      {!isMockVideo && videoUrl && state !== 'generating' && state !== 'error' && Platform.OS !== 'web' && (
        <WebView
          source={{ html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body><video controls playsinline preload="auto" poster="${thumbnailUrl}" style="width:100%;height:100%;background:#0a0a0a" src="${videoUrl}"></video></body></html>` }}
          style={styles.nativeVideo}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          onError={() => onRetry?.()}
        />
      )}

      {/* Dimming overlay only belongs to the placeholder/state surface. */}
      {(!videoUrl || state === 'generating' || state === 'error') && (
        <Animated.View style={[styles.dimOverlay, overlayStyle]} />
      )}

      {/* Controls overlay */}
      <Animated.View
        pointerEvents={!isMockVideo && videoUrl && state !== 'generating' && state !== 'error' ? 'none' : 'auto'}
        style={[styles.controlsOverlay, overlayStyle, !isMockVideo && videoUrl && state !== 'generating' && state !== 'error' && styles.nativeControlsHidden]}
      >
        {state === 'generating' && (
          <View style={styles.stateOverlay}>
            <SpinningLoader color={COLORS.warning[400]} size={36} />
            <Text style={styles.statusText}>Generating your video</Text>
            <Text style={styles.progressText}>{progress}% complete</Text>
            <View style={styles.genProgressBar}>
              <Animated.View style={[styles.genProgressFill, { width: `${progress}%` } as any]} />
            </View>
            <Text style={styles.hintText}>Preview will appear as soon as it's ready</Text>
          </View>
        )}

        {state === 'loading' && (
          <View style={styles.stateOverlay}>
            <SpinningLoader color={COLORS.primary[400]} size={36} />
            <Text style={styles.statusText}>Loading video...</Text>
          </View>
        )}

        {state === 'buffering' && (
          <View style={styles.stateOverlay}>
            <SpinningLoader color={COLORS.primary[400]} size={28} />
            <Text style={styles.statusTextSmall}>Buffering...</Text>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.stateOverlay}>
            <AlertCircle size={40} color={COLORS.error[400]} strokeWidth={2} />
            <Text style={styles.statusText}>Playback failed</Text>
            <Text style={styles.errorDetail}>{errorMessage || 'Unable to load this video'}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
              <RefreshCw size={16} color={COLORS.neutral[0]} strokeWidth={2} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {(canPlay || state === 'paused') && !isBusy && (
          <TouchableOpacity
            style={styles.touchArea}
            onPress={handlePressArea}
            activeOpacity={1}
          >
            <Animated.View style={[styles.playButton, playBtnStyle]}>
              <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.85}>
                {isActuallyPlaying ? (
                  <Pause size={32} color={COLORS.neutral[0]} strokeWidth={2} fill={COLORS.neutral[0]} />
                ) : (
                  <Play size={32} color={COLORS.neutral[0]} strokeWidth={2} fill={COLORS.neutral[0]} style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        )}

        {state === 'idle' && !isBusy && (
          <View style={styles.stateOverlay}>
            <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.85}>
              <Animated.View style={[styles.playButton, playBtnStyle]}>
                <Play size={32} color={COLORS.neutral[0]} strokeWidth={2} fill={COLORS.neutral[0]} style={{ marginLeft: 3 }} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Bottom progress bar (scrubber) */}
      {canPlay && (
        <View style={styles.scrubber}>
          <Text style={styles.timeText}>{formatDuration(Math.floor(currentTime))}</Text>
          <View style={styles.scrubberTrack}>
            <Animated.View style={[styles.scrubberFill, progressStyle]} />
          </View>
          <Text style={styles.timeText}>{formatDuration(duration)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  nativeVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeControlsHidden: {
    opacity: 0,
  },
  touchArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stateOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 30,
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: COLORS.neutral[0],
    marginTop: 4,
  },
  statusTextSmall: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: COLORS.neutral[0],
    marginTop: 4,
  },
  progressText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: COLORS.warning[400],
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: COLORS.neutral[500],
    marginTop: 4,
  },
  genProgressBar: {
    width: 180,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  genProgressFill: {
    height: '100%',
    backgroundColor: COLORS.warning[400],
    borderRadius: 3,
  },
  errorDetail: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.neutral[400],
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.neutral[0],
  },
  scrubber: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: COLORS.neutral[300],
  },
  scrubberTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: COLORS.primary[400],
    borderRadius: 2,
  },
});

const pulsingDotsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary[400],
  },
});
