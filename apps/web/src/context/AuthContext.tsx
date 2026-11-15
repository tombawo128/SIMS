
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@sims/shared';

import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

// ==========================================
// TYPES
// ==========================================

interface SignUpStudentInput {
  email: string;
  password: string;
  fullName: string;
  universityId: string;
  studentId: string;
  program: string;
  year: number;
}

interface SignUpAdminInput {
  email: string;
  password: string;
  fullName: string;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;

  signIn: (email: string, password: string) => Promise<void>;

  signUpStudent: (
    input: SignUpStudentInput
  ) => Promise<{ needsConfirmation: boolean }>;

  signUpAdmin: (
    input: SignUpAdminInput
  ) => Promise<{ needsConfirmation: boolean }>;

  signout: () => Promise<void>;

  requestPasswordReset: (email: string) => Promise<void>;

  updatePassword: (password: string) => Promise<void>;

  refreshProfile: () => Promise<void>;
}

// ==========================================
// AUTH CONTEXT
// ==========================================

const AuthContext = createContext<AuthContextType | null>(null);

// ==========================================
// AUTH PROVIDER
// ==========================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const mounted = useRef(true);
  const sessionRef = useRef<Session | null>(null);
  const profileRequestId = useRef(0);

  // ========================================
  // COMPONENT MOUNT TRACKING
  // ========================================

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  // ========================================
  // FETCH USER PROFILE
  // ========================================

  const fetchProfile = useCallback(async (userId: string): Promise<boolean> => {
    const requestId = ++profileRequestId.current;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            '*, university:universities(id,name), company:companies(id,name)'
          )
          .eq('id', userId)
          .maybeSingle();

        if (requestId !== profileRequestId.current) {
          return false;
        }

        if (!error && data) {
          if (mounted.current) {
            setProfile(data as Profile);
            setProfileError(null);
          }

          return true;
        }

        if (error) {
          console.error('Profile fetch attempt failed:', error);
        }
      } catch (error) {
        console.error('Profile fetch attempt failed:', error);
      }

      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (mounted.current && requestId === profileRequestId.current) {
      setProfile(null);
      setProfileError(
        'We could not load your profile. Contact your administrator.'
      );
    }

    return false;
  }, []);

  // ========================================
  // HANDLE AUTH SESSION
  // ========================================

  useEffect(() => {
    let cancelled = false;
    let sessionRequestId = 0;

    const applySession = async (nextSession: Session | null) => {
      if (cancelled) return;

      const requestId = ++sessionRequestId;

      sessionRef.current = nextSession;
      setSession(nextSession);

      if (!nextSession) {
        ++profileRequestId.current;

        setProfile(null);
        setProfileError(null);
        setLoading(false);

        return;
      }

      setProfile(null);
      setProfileError(null);
      setLoading(true);

      await fetchProfile(nextSession.user.id);

      if (!cancelled && requestId === sessionRequestId) {
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Failed to retrieve session:', error);
      }

      if (!cancelled) {
        void applySession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'TOKEN_REFRESHED') {
        sessionRef.current = nextSession;
        setSession(nextSession);
        return;
      }

      void applySession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ========================================
  // SIGN IN
  // ========================================

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    },
    []
  );

  // ========================================
  // STUDENT SIGN UP
  // ========================================

  const signUpStudent = useCallback(
    async (input: SignUpStudentInput) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            role: 'student',
            full_name: input.fullName,
            university_id: input.universityId,
            student_id: input.studentId,
            program: input.program,
            year: input.year,
          },
        },
      });

      if (error) throw error;

      return {
        needsConfirmation: !data.session,
      };
    },
    []
  );

  // ========================================
  // ADMIN SIGN UP
  // ========================================

  const signUpAdmin = useCallback(
    async (input: SignUpAdminInput) => {
      const { error } = await supabase.functions.invoke('signup-admin', {
        body: {
          email: input.email,
          password: input.password,
          full_name: input.fullName,
        },
      });

      if (error) {
        let message =
          'Could not create the administrator account. Is the signup-admin function deployed?';

        const context = (error as { context?: Response }).context;

        if (context) {
          try {
            const parsed = (await context.json()) as {
              error?: string;
              message?: string;
            };

            message = parsed.error || parsed.message || message;
          } catch {
            // Keep default error message.
          }
        }

        throw new Error(message);
      }

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

      if (signInError) {
        if (signInError.code === 'email_not_confirmed') {
          return { needsConfirmation: true };
        }

        throw signInError;
      }

      return { needsConfirmation: false };
    },
    []
  );

  // ========================================
  // SIGN OUT
  // ========================================

  const signout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    queryClient.clear();
  }, []);

  // ========================================
  // PASSWORD RESET REQUEST
  // ========================================

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  }, []);

  // ========================================
  // UPDATE PASSWORD
  // ========================================

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) throw error;
  }, []);

  // ========================================
  // REFRESH PROFILE
  // ========================================

  const refreshProfile = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    const userId = currentSession.user.id;

    setLoading(true);

    try {
      const loaded = await fetchProfile(userId);
      if (!loaded && sessionRef.current?.user.id === userId) {
        throw new Error('We could not refresh your account profile. Please try again.');
      }
    } finally {
      if (
        mounted.current &&
        sessionRef.current?.user.id === userId
      ) {
        setLoading(false);
      }
    }
  }, [fetchProfile]);

  // ========================================
  // AUTH PROVIDER
  // ========================================

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        profileError,
        signIn,
        signUpStudent,
        signUpAdmin,
        signout,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ==========================================
// USE AUTH HOOK
// ==========================================

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
