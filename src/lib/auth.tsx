import { Session } from "@supabase/supabase-js";
import { router, useSegments } from "expo-router";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import {
  getCurrentProfile,
  getDashboardPath,
  getRoleSegment,
  normalizeRole,
  Profile,
  supabase,
} from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  loadingMessage: string;
  refreshProfile: () => Promise<Profile | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUpOwner: (email: string, password: string) => Promise<void>;
  signUpStaff: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function browserUrl(path: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return null;
}

const AUTH_CALLBACK_REDIRECT_URL =
  process.env.EXPO_PUBLIC_AUTH_CALLBACK_URL ??
  browserUrl("/auth/callback") ??
  "dms://auth/callback";

const PASSWORD_RESET_REDIRECT_URL =
  process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ??
  browserUrl("/auth/reset-password") ??
  "dms://auth/reset-password";

function isRoleGroup(segment?: string) {
  return segment === "(head)" || segment === "(doctor)" || segment === "(reception)";
}

async function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms)),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Opening CapDent...");

  async function refreshProfile() {
    try {
      setLoadingMessage("Loading clinic profile...");
      const current = await withTimeout(getCurrentProfile(), 12000);
      setProfile(current);
      return current;
    } catch (error) {
      console.warn("refreshProfile error:", error);
      setProfile(null);
      return null;
    }
  }

  async function loadSession(nextSession: Session | null) {
    setLoadingMessage("Checking login...");
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      return;
    }
    await refreshProfile();
  }

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        setLoadingMessage("Opening CapDent...");
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await loadSession(data.session);
      } catch (error) {
        console.warn("Initial auth load failed:", error);
        if (!mounted) return;
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        return;
      }
      try {
        setLoading(true);
        setLoadingMessage("Restoring clinic session...");
        await loadSession(nextSession);
      } catch (error) {
        console.warn("Auth state load failed:", error);
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const firstSegment = segments[0];
    const secondSegment = segments[1];
    const isAuthScreen = firstSegment === "auth";
    const isSettingsPasswordScreen = firstSegment === "settings" && secondSegment === "change-password";

    if (!session) {
      if (firstSegment !== "login" && !isAuthScreen) router.replace("/login");
      return;
    }

    if (isAuthScreen || isSettingsPasswordScreen) return;

    if (session && !profile) {
      if (firstSegment !== "onboarding") router.replace("/onboarding");
      return;
    }

    if (session && profile) {
      const normalizedRole = normalizeRole(profile.role);
      if (!profile.clinic_id) {
        if (normalizedRole === "head_doctor") {
          if (firstSegment !== "onboarding") router.replace("/onboarding");
          return;
        }
        if (firstSegment !== "clinic" || secondSegment !== "contact-admin") {
          router.replace("/clinic/contact-admin" as never);
        }
        return;
      }

      const correctPath = getDashboardPath(profile.role);
      const correctSegment = getRoleSegment(profile.role);
      if (firstSegment === "login" || firstSegment === "onboarding" || firstSegment === undefined) {
        router.replace(correctPath as never);
        return;
      }
      if (isRoleGroup(firstSegment) && firstSegment !== correctSegment) {
        router.replace(correctPath as never);
      }
    }
  }, [loading, session, profile, segments]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      loadingMessage,
      refreshProfile,
      async signIn(email, password) {
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
          10000
        );
        if (error) throw error;
        if (data.user && !data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          throw new Error("Please verify your email before logging in.");
        }
      },
      async signUpOwner(email, password) {
        const { error } = await withTimeout(
          supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: { emailRedirectTo: AUTH_CALLBACK_REDIRECT_URL },
          }),
          10000
        );
        if (error) throw error;
      },
      async signUpStaff(email, password) {
        const { error } = await withTimeout(
          supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: { emailRedirectTo: AUTH_CALLBACK_REDIRECT_URL },
          }),
          10000
        );
        if (error) throw error;
      },
      async resetPassword(email) {
        const { error } = await withTimeout(
          supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: PASSWORD_RESET_REDIRECT_URL,
          }),
          10000
        );
        if (error) throw error;
        Alert.alert(
          "Check your email",
          Platform.OS === "web"
            ? "Open the reset link in this browser to set a new password."
            : "Open the reset link from the same phone to set a new password."
        );
      },
      async updatePassword(password) {
        const { error } = await withTimeout(supabase.auth.updateUser({ password }), 10000);
        if (error) throw error;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
        setProfile(null);
        router.replace("/login");
      },
    }),
    [loading, loadingMessage, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
