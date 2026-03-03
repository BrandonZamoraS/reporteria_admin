"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logAuditAction } from "@/lib/audit/log";
import { APP_ROLE_COOKIE, APP_SESSION_LOG_COOKIE } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const sessionLogId = Number(cookieStore.get(APP_SESSION_LOG_COOKIE)?.value);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && Number.isFinite(sessionLogId) && sessionLogId > 0) {
    await supabase
      .from("user_session_log")
      .update({
        logout_at: new Date().toISOString(),
      })
      .eq("session_log_id", sessionLogId)
      .eq("auth_user_id", user.id)
      .is("logout_at", null);
  }

  await logAuditAction(supabase, {
    action: "LOGOUT",
    description: "Cierre de sesion",
  });

  await supabase.auth.signOut();
  cookieStore.delete(APP_ROLE_COOKIE);
  cookieStore.delete(APP_SESSION_LOG_COOKIE);

  redirect("/login");
}
