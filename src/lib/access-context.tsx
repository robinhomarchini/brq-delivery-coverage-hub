"use client";

import { createContext, useContext } from "react";
import type { AccessUser } from "@/lib/access-control";
import type { AuthenticatedUser } from "@/lib/auth/auth-service";

interface AccessContextValue {
  user: AuthenticatedUser | null;
  realAccessUser: AccessUser | null;
  accessUser: AccessUser | null;
  loadingAccess: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  accessSimulationActive: boolean;
  setAccessSimulation: (user: AccessUser) => void;
  clearAccessSimulation: () => void;
  refreshAccess: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue>({
  user: null,
  realAccessUser: null,
  accessUser: null,
  loadingAccess: false,
  isAdmin: false,
  canEdit: false,
  accessSimulationActive: false,
  setAccessSimulation: () => undefined,
  clearAccessSimulation: () => undefined,
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
