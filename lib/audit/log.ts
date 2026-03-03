import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "EXPORT_PDF"
  | "EXPORT_EXCEL";

export type LogAuditParams = {
  action: AuditAction;
  tableName?: string;
  recordId?: number;
  description?: string;
};

/**
 * Insert a row into audit_log from the application layer.
 * Uses the request-scoped supabase client so RLS resolves auth.uid() automatically.
 * Fire-and-forget — errors are swallowed to avoid breaking the main flow.
 */
export async function logAuditAction(
  supabase: SupabaseClient,
  params: LogAuditParams
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("audit_log").insert({
      auth_user_id: user.id,
      action: params.action,
      table_name: params.tableName ?? null,
      record_id: params.recordId ?? null,
      description: params.description ?? null,
    });
  } catch {
    // Silently ignore — audit logging must never break the main action.
  }
}
