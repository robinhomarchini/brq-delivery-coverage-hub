import type { SupabaseClient } from "@supabase/supabase-js";
import { isBrqEmail, normalizeAccessEmail, type AccessRole, type AccessStatus, type AccessUser } from "@/lib/access-control";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { productionConfigurationError } from "./provider";

export interface AccessRepository {
  fetchCurrentAccessUser(): Promise<AccessUser | null>;
  listAccessUsers(): Promise<AccessUser[]>;
  saveAccessUser(user: Pick<AccessUser, "email" | "role" | "active">): Promise<AccessUser>;
  deactivateAccessUser(email: string, role?: AccessRole): Promise<AccessUser>;
  approveAccessUser(user: Pick<AccessUser, "email" | "role">): Promise<AccessUser>;
  deleteAccessUser(email: string): Promise<void>;
}

export type AccessRepositoryProvider = "supabase" | "unavailable";

export interface AccessRepositorySelection {
  provider: AccessRepositoryProvider;
  repository: AccessRepository | null;
  configured: boolean;
  reason?: string;
}

interface AppUserRow {
  user_id?: string | null;
  email: string;
  role: AccessRole;
  active: boolean;
  status?: AccessStatus;
  created_at?: string;
  updated_at?: string;
}

export function createAccessRepositorySelection(): AccessRepositorySelection {
  if (!isSupabaseConfigured()) {
    return {
      provider: "unavailable",
      repository: null,
      configured: false,
      reason: productionConfigurationError,
    };
  }

  const client = getSupabaseBrowserClient();
  return {
    provider: client ? "supabase" : "unavailable",
    repository: client ? createSupabaseAccessRepository(client) : null,
    configured: Boolean(client),
    reason: client ? undefined : productionConfigurationError,
  };
}

export function createSupabaseAccessRepository(client: SupabaseClient): AccessRepository {
  return {
    async fetchCurrentAccessUser() {
      const { data, error } = await client.rpc("accept_current_app_access").maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return fromAppUserRow(data as AppUserRow);
    },
    async listAccessUsers() {
      const { data, error } = await client.rpc("list_app_access");
      if (error) throw error;

      return ((data ?? []) as AppUserRow[])
        .map(fromAppUserRow)
        .sort((first, second) => first.email.localeCompare(second.email, "pt-BR"));
    },
    async saveAccessUser(user) {
      const email = normalizeAndValidateCorporateEmail(user.email);
      const { data, error } = await client
        .rpc("upsert_app_access", {
          p_email: email,
          p_role: user.role,
          p_active: user.active,
        })
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Acesso não retornado pelo Supabase.");

      return fromAppUserRow(data as AppUserRow);
    },
    async deactivateAccessUser(email, role = "viewer") {
      return this.saveAccessUser({
        email,
        role,
        active: false,
      });
    },
    async approveAccessUser(user) {
      return this.saveAccessUser({
        email: user.email,
        role: user.role,
        active: true,
      });
    },
    async deleteAccessUser(email) {
      const normalizedEmail = normalizeAndValidateCorporateEmail(email);
      const { error } = await client.rpc("delete_app_access", {
        p_email: normalizedEmail,
      });

      if (error) throw error;
    },
  };
}

function normalizeAndValidateCorporateEmail(email: string) {
  const normalizedEmail = normalizeAccessEmail(email);
  if (!isBrqEmail(normalizedEmail)) {
    throw new Error("Informe um e-mail corporativo @brq.com.");
  }
  return normalizedEmail;
}

function fromAppUserRow(row: AppUserRow): AccessUser {
  return {
    userId: row.user_id ?? undefined,
    email: row.email,
    role: row.role,
    active: row.active,
    status: row.status ?? (row.active ? "active" : "blocked"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
