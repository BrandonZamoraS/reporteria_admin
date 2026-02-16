import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { roleHomePath } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let role: Awaited<ReturnType<typeof getUserRoleFromProfile>>;
  try {
    role = await getUserRoleFromProfile(user.id);
  } catch {
    redirect("/login");
  }

  if (!role) {
    redirect("/login");
  }

  redirect(roleHomePath(role));
}
