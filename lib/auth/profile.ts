import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

export async function getUserRoleFromProfile(
  authUserId: string
): Promise<AppRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_profile")
    .select("role, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data || !isAppRole(data.role) || data.is_active === false) {
    return null;
  }

  return data.role;
}

export async function getCurrentUserProfile(authUserId: string): Promise<{
  userId: number;
  role: AppRole;
  isActive: boolean;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_profile")
    .select("user_id, role, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data || !isAppRole(data.role)) {
    return null;
  }

  return {
    userId: data.user_id,
    role: data.role,
    isActive: data.is_active !== false,
  };
}
