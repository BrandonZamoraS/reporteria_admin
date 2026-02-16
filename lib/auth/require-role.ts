import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { roleHomePath, type AppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireRole(allowedRoles: AppRole[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getUserRoleFromProfile(user.id);
  if (!role) {
    redirect("/login");
  }

  if (!allowedRoles.includes(role)) {
    redirect(roleHomePath(role));
  }

  return { supabase, user, role };
}
