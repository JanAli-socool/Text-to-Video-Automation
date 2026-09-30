import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/lib/colors';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react-native';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      router.replace('/(tabs)');
    }
  };

  const fillDemo = () => {
    setEmail('neural_artist@mock.ai');
    setPassword('mockpass123');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Sparkles size={32} color={COLORS.primary[400]} strokeWidth={2} />
          </View>
          <Text style={styles.appName}>NeuraMotion</Text>
          <Text style={styles.tagline}>Turn your words into cinematic video</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue creating</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrap}>
            <Mail size={20} color={COLORS.neutral[400]} strokeWidth={2} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={COLORS.neutral[500]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.inputWrap}>
            <Lock size={20} color={COLORS.neutral[400]} strokeWidth={2} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.neutral[500]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.neutral[950]} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <ArrowRight size={20} color={COLORS.neutral[950]} strokeWidth={2} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.demoBtn} onPress={fillDemo} activeOpacity={0.7}>
            <Text style={styles.demoText}>Use demo account</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/register" style={styles.link}>
              <Text style={styles.linkText}>Sign up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[950],
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.primary[800],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: COLORS.neutral[0],
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.neutral[400],
    marginTop: 8,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 22,
    color: COLORS.neutral[0],
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.neutral[400],
    marginBottom: 28,
  },
  errorBox: {
    backgroundColor: COLORS.error[500] + '20',
    borderWidth: 1,
    borderColor: COLORS.error[500] + '40',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: COLORS.error[400],
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral[900],
    borderWidth: 1,
    borderColor: COLORS.neutral[800],
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 14,
    gap: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: COLORS.neutral[0],
    height: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[400],
    borderRadius: 12,
    height: 54,
    marginTop: 6,
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: COLORS.neutral[950],
  },
  demoBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
  },
  demoText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: COLORS.primary[300],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.neutral[400],
  },
  link: {
    paddingVertical: 2,
  },
  linkText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: COLORS.primary[400],
  },
});
