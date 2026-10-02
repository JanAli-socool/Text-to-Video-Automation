import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Supabase email sending is rate-limited. Wait before retrying, or disable Confirm email for development in Supabase → Authentication → Providers → Email. For production, configure custom SMTP.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in, or disable Confirm email in Supabase for development.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) return data as Profile;

    // Older accounts may exist in auth.users without a profile row (for
    // example when the profile trigger was not installed). Repair that state
    // on first login so the credit balance can be loaded normally.
    if (!error || error.code === 'PGRST116') {
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: `creator_${userId.slice(0, 8)}`,
          full_name: '',
          avatar_url: '',
          bio: '',
          plan: 'free',
          credits: 10,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (created) return created as Profile;
      if (createError) console.warn('Failed to create missing profile:', createError.message);
    } else {
      console.warn('Failed to fetch profile:', error.message);
    }
    return null;
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setState({ session: null, user: null, profile: null, loading: false, error: 'Supabase is not configured.' });
      return () => { mounted = false; };
    }

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;
        setState({ session, user: session.user, profile, loading: false, error: null });
      } else {
        setState({ session: null, user: null, profile: null, loading: false, error: null });
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({ session, user: session.user, profile, loading: false, error: null });
        } else {
          setState({ session: null, user: null, profile: null, loading: false, error: null });
        }
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured. Add your environment variables and restart Expo.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string, fullName: string) => {
      if (!isSupabaseConfigured) return { error: 'Supabase is not configured. Add your environment variables and restart Expo.' };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: fullName },
        },
      });

      if (error) return { error: friendlyAuthError(error.message) };
      if (!data.user) return { error: 'Sign-up failed. Please try again.' };

      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ session: null, user: null, profile: null, loading: false, error: null });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.id);
    if (profile) setState((prev) => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!state.user) return { error: 'Not authenticated' };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id);

      if (error) return { error: error.message };

      setState((prev) => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, ...updates } : prev.profile,
      }));
      return { error: null };
    },
    [state.user]
  );

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
