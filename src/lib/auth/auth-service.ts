import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { isBrqEmail, normalizeAccessEmail, type AccessUser } from "@/lib/access-control";
import { createSupabaseAccessRepository } from "@/lib/repositories/accessRepository";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AuthChangeEvent = "PASSWORD_RECOVERY" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED" | "INITIAL_SESSION" | string;
export type AuthProvider = "supabase" | "corporate-sso" | "unavailable";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export interface AuthService {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  getAccessToken(): Promise<string | null>;
  onAuthStateChange(callback: (event: AuthChangeEvent, user: AuthenticatedUser | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  createPasswordAccess(email: string, password: string, redirectTo: string): Promise<{ hasSession: boolean }>;
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  fetchCurrentAccessUserWithRetry(): Promise<AccessUser | null>;
}

export interface AuthServiceSelection {
  provider: AuthProvider;
  service: AuthService | null;
  configured: boolean;
  reason?: string;
}

export function createAuthServiceSelection(): AuthServiceSelection {
  const provider = resolveAuthProvider();
  if (provider === "supabase") {
    const client = getSupabaseBrowserClient();
    return {
      provider,
      service: client ? createSupabaseAuthService(client) : null,
      configured: isSupabaseConfigured(),
      reason: client ? undefined : "Supabase Auth não está configurado.",
    };
  }

  if (provider === "corporate-sso") {
    return {
      provider,
      service: null,
      configured: false,
      reason: "SSO corporativo ainda não foi conectado a este ambiente.",
    };
  }

  return {
    provider,
    service: null,
    configured: false,
    reason: "Nenhum provedor de autenticação configurado.",
  };
}

export function resolveAuthProvider(): AuthProvider {
  const configuredProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER?.trim().toLowerCase();
  if (configuredProvider === "corporate-sso") return "corporate-sso";
  if (configuredProvider === "supabase") return "supabase";
  if (isSupabaseConfigured()) return "supabase";
  return "unavailable";
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  const accessRepository = createSupabaseAccessRepository(client);

  return {
    async getCurrentUser() {
      const { data } = await client.auth.getSession();
      return data.session?.user ? toAuthenticatedUser(data.session.user) : null;
    },
    async getAccessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange((event, session: Session | null) => {
        callback(event, session?.user ? toAuthenticatedUser(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },
    async signInWithPassword(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email: normalizeAccessEmail(email),
        password,
      });
      if (error) throw error;
    },
    async createPasswordAccess(email, password, redirectTo) {
      const { data, error } = await client.auth.signUp({
        email: normalizeAccessEmail(email),
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      return { hasSession: Boolean(data.session) };
    },
    async sendPasswordReset(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(normalizeAccessEmail(email), {
        redirectTo,
      });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },
    async signOut() {
      await client.auth.signOut();
    },
    async fetchCurrentAccessUserWithRetry() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const profile = await accessRepository.fetchCurrentAccessUser();
        if (profile) return profile;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      return null;
    },
  };
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export function normalizeLoginEmail(email: FormDataEntryValue | null) {
  return normalizeAccessEmail(String(email ?? ""));
}

export function validateCorporateEmail(email: string) {
  return isBrqEmail(email);
}
