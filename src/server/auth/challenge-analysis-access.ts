import { createClient } from "@supabase/supabase-js";
import { canManageCompensation } from "@/lib/compensation-access";
import type { AccessUser } from "@/lib/access-control";
import type { Person } from "@/data/mockData";

type AppUserRow = {
  user_id?: string | null;
  email: string;
  role: AccessUser["role"];
  active: boolean;
  status?: AccessUser["status"];
  created_at?: string;
  updated_at?: string;
};

type PersonAccessRow = {
  id: string;
  name: string;
  email: string | null;
  job_title: string;
  role_type: Person["roleType"];
  active: boolean;
  is_manager: boolean;
  hierarchy_level: Person["hierarchyLevel"];
};

export async function assertCanUseChallengeAnalysis(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new ChallengeAccessError("Auth provider is not configured.", 503);
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new ChallengeAccessError("Missing user session.", 401);
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
    throw new ChallengeAccessError("Invalid user session.", 401);
  }

  const { data: accessData, error: accessError } = await client.rpc("accept_current_app_access").maybeSingle();
  if (accessError || !accessData) {
    throw new ChallengeAccessError("Access not authorized.", 403);
  }

  const accessUser = fromAppUserRow(accessData as AppUserRow);
  const { data: peopleData, error: peopleError } = await client
    .from("people")
    .select("id, name, email, job_title, role_type, active, is_manager, hierarchy_level")
    .ilike("email", accessUser.email)
    .limit(1);

  if (peopleError) {
    throw new ChallengeAccessError("Unable to verify compensation access.", 403);
  }

  const matchingPerson = peopleData?.[0] ? fromPersonAccessRow(peopleData[0] as PersonAccessRow) : null;
  if (!canManageCompensation(accessUser, matchingPerson ? [matchingPerson] : [])) {
    throw new ChallengeAccessError("Compensation analysis access denied.", 403);
  }
}

export class ChallengeAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
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

function fromPersonAccessRow(row: PersonAccessRow): Person {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    jobTitle: row.job_title,
    directorId: undefined,
    managerId: undefined,
    roleType: row.role_type,
    areaId: undefined,
    clientIds: [],
    active: row.active,
    lifecycleStatus: row.active ? "active" : "inactive",
    isManager: row.is_manager,
    hierarchyLevel: row.hierarchy_level,
  };
}
