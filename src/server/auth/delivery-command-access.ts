import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccessRole, AccessStatus, AccessUser } from "@/lib/access-control";

type AppUserRow = {
  user_id?: string | null;
  email: string;
  role: AccessRole;
  active: boolean;
  status?: AccessStatus;
  created_at?: string;
  updated_at?: string;
};

export class DeliveryCommandAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function createDeliveryCommandClient(request: Request): Promise<{
  client: SupabaseClient;
  accessUser: AccessUser;
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new DeliveryCommandAccessError("Auth provider is not configured.", 503);
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new DeliveryCommandAccessError("Missing user session.", 401);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user?.email) {
    throw new DeliveryCommandAccessError("Invalid user session.", 401);
  }

  const { data: accessData, error: accessError } = await client.rpc("accept_current_app_access").maybeSingle();
  if (accessError || !accessData) {
    throw new DeliveryCommandAccessError("Access not authorized.", 403);
  }

  const accessUser = fromAppUserRow(accessData as AppUserRow);
  if (!accessUser.active || (accessUser.role !== "editor" && accessUser.role !== "admin")) {
    throw new DeliveryCommandAccessError("Delivery write access denied.", 403);
  }

  return { client, accessUser };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
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
