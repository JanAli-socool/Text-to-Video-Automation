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
import { Sparkles, Mail, Lock, User, AtSign, ArrowRight } from 'lucide-react-native';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password || !username.trim()) {
      setError('Please fill in email, username, and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signUp(
      email.trim(),
      password,
      username.trim(),
      fullName.trim()
    );
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      router.replace('/(tabs)');
    }
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
          <Text style={styles.tagline}>Create your account and start generating</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.subtitle}>Join the AI video creation community</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrap}>
            <AtSign size={20} color={COLORS.neutral[400]} strokeWidth={2} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={COLORS.neutral[500]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <User size={20} color={COLORS.neutral[400]} strokeWidth={2} />
            <TextInput
              style={styles.input}
              placeholder="Full name (optional)"
              placeholderTextColor={COLORS.neutral[500]}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

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
              placeholder="Password (min 6 characters)"
              placeholderTextColor={COLORS.neutral[500]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.neutral[950]} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Create Account</Text>
                <ArrowRight size={20} color={COLORS.neutral[950]} strokeWidth={2} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" style={styles.link}>
              <Text style={styles.linkText}>Sign in</Text>
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
    marginBottom: 36,
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
