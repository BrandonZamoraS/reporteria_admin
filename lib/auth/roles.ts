export const APP_ROLES = ["admin", "editor", "visitante", "rutero"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_COOKIE = "app_role";
export const APP_SESSION_LOG_COOKIE = "app_session_log_id";

export function isAppRole(value: string | undefined): value is AppRole {
  return APP_ROLES.some((role) => role === value);
}

export function roleHomePath(role: AppRole): `/home/${AppRole}` {
  return `/home/${role}`;
}
