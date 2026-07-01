"use client";

import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { AccessUser } from "@/lib/access-control";

interface AccessContextValue {
  user: User | null;
  accessUser: AccessUser | null;
  loadingAccess: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  refreshAccess: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue>({
  user: null,
  accessUser: null,
  loadingAccess: false,
  isAdmin: false,
  canEdit: false,
  refreshAccess: async () => undefined,
});

export function AccessContextProvider({
  value,
  children,
}: {
  value: AccessContextValue;
  children: React.ReactNode;
}) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}
