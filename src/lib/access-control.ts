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
