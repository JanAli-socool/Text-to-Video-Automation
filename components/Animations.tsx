import { useEffect, useRef, ReactNode } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { PressableProps, ViewStyle, StyleProp } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 0.8 };
const TIMING_CONFIG = { duration: 350, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

export function FadeIn({ children, delay = 0, duration = 350, style }: FadeInProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.cubic) }));
  }, [delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle;
}

export function ScaleIn({ children, delay = 0, style }: ScaleInProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
    opacity.value = withDelay(delay, withTiming(1, { duration: 250 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

interface SlideInProps {
  children: ReactNode;
  delay?: number;
  from?: 'left' | 'right' | 'bottom';
  distance?: number;
  style?: ViewStyle;
}

export function SlideIn({ children, delay = 0, from = 'bottom', distance = 30, style }: SlideInProps) {
  const translateX = useSharedValue(from === 'left' ? -distance : from === 'right' ? distance : 0);
  const translateY = useSharedValue(from === 'bottom' ? distance : 0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay, withTiming(0, TIMING_CONFIG));
    translateY.value = withDelay(delay, withTiming(0, TIMING_CONFIG));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay, from, distance]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

interface PressableScaleProps extends Omit<PressableProps, 'onPress'> {
  children: ReactNode;
  onPress?: () => void;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({ children, onPress, scaleTo = 0.96, style, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const tap = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(scaleTo, { damping: 20, stiffness: 300 });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_CONFIG);
    })
    .onEnd(() => {
      if (onPress) runOnJS(onPress)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[animatedStyle, style]} {...(rest as any)}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

interface ShimmerProps {
  width: number;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Shimmer({ width, height, borderRadius = 8, style }: ShimmerProps) {
  const translateX = useSharedValue(-width);

  useEffect(() => {
    translateX.value = withTiming(width, { duration: 1200, easing: Easing.inOut(Easing.ease) }, () => {
      translateX.value = -width;
    });
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#1f2937',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: width * 0.5,
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.06)',
          },
          animatedStyle,
        ]}
      />
    </Animated.View>
  );
}

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
}

export function ProgressBar({ progress, height = 6, color = '#2dd4bf', trackColor = '#1f2937', style }: ProgressBarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(progress, { damping: 20, stiffness: 120 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <Animated.View
      style={[
        { height, backgroundColor: trackColor, borderRadius: height / 2, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[{ height: '100%', backgroundColor: color, borderRadius: height / 2 }, animatedStyle]}
      />
    </Animated.View>
  );
}

interface PulseProps {
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
  duration?: number;
  style?: ViewStyle;
}

export function Pulse({ children, minScale = 0.97, maxScale = 1.03, duration = 1400, style }: PulseProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(maxScale, { damping: 10, stiffness: 80 }, () => {
      scale.value = withSpring(minScale, { damping: 10, stiffness: 80 });
    });
  }, [minScale, maxScale, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
