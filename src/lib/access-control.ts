import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessRole = "viewer" | "hunter_viewer" | "editor" | "admin";

export interface AccessUser {
  userId?: string;
  email: string;
  role: AccessRole;
  active: boolean;
  status: AccessStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type AccessStatus = "active" | "invited" | "approval_pending" | "blocked" | "pending";

interface AppUserRow {
  user_id?: string | null;
  email: string;
  role: AccessRole;
  active: boolean;
  status?: AccessStatus;
  created_at?: string;
  updated_at?: string;
}

export const accessRoles: AccessRole[] = ["viewer", "hunter_viewer", "editor", "admin"];

export function translateAccessRole(role: AccessRole) {
  const labels: Record<AccessRole, string> = {
    viewer: "Leitura",
    hunter_viewer: "Consulta Hunter",
    editor: "Editor",
    admin: "Administrador",
  };

  return labels[role];
}

export function normalizeAccessEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isBrqEmail(email: string) {
  return normalizeAccessEmail(email).endsWith("@brq.com");
}

export function isHunterConsultAccess(user: Pick<AccessUser, "role" | "active"> | null | undefined) {
  return user?.active === true && user.role === "hunter_viewer";
}

export async function fetchCurrentAccessUser(client: SupabaseClient): Promise<AccessUser | null> {
  const { data, error } = await client.rpc("accept_current_app_access").maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return fromAppUserRow(data as AppUserRow);
}

export async function listAccessUsers(client: SupabaseClient): Promise<AccessUser[]> {
  const { data, error } = await client.rpc("list_app_access");
  if (error) throw error;

  return ((data ?? []) as AppUserRow[])
    .map(fromAppUserRow)
    .sort((first, second) => first.email.localeCompare(second.email, "pt-BR"));
}

export async function saveAccessUser(
  client: SupabaseClient,
  user: Pick<AccessUser, "email" | "role" | "active">,
): Promise<AccessUser> {
  const email = normalizeAccessEmail(user.email);
  if (!isBrqEmail(email)) {
    throw new Error("Informe um e-mail corporativo @brq.com.");
  }

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
}

export async function deactivateAccessUser(client: SupabaseClient, email: string, role: AccessRole = "viewer") {
  return saveAccessUser(client, {
    email,
    role,
    active: false,
  });
}

export async function approveAccessUser(client: SupabaseClient, user: Pick<AccessUser, "email" | "role">) {
  return saveAccessUser(client, {
    email: user.email,
    role: user.role,
    active: true,
  });
}

export async function deleteAccessUser(client: SupabaseClient, email: string) {
  const normalizedEmail = normalizeAccessEmail(email);
  if (!isBrqEmail(normalizedEmail)) {
    throw new Error("Informe um e-mail corporativo @brq.com.");
  }

  const { error } = await client.rpc("delete_app_access", {
    p_email: normalizedEmail,
  });

  if (error) throw error;
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
