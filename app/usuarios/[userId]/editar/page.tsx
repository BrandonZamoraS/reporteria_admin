import { notFound, redirect } from "next/navigation";
import { UserForm } from "@/app/usuarios/_components/user-form";
import { updateUserAction } from "@/app/usuarios/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function EditUserPage({ params }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor"]);
  const { userId } = await params;
  const parsedUserId = Number(userId);

  if (!parsedUserId || Number.isNaN(parsedUserId)) {
    notFound();
  }

  const [{ data: userProfile, error }, { data: companies }] = await Promise.all([
    supabase
      .from("user_profile")
      .select("user_id, auth_user_id, name, role, email, is_active, company_id")
      .eq("user_id", parsedUserId)
      .maybeSingle(),
    supabase.from("company").select("company_id, name, is_active").order("name", { ascending: true }),
  ]);

  if (error || !userProfile) {
    notFound();
  }

  if (userProfile.auth_user_id && userProfile.auth_user_id === user.id) {
    redirect("/mi-perfil");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Usuarios</p>
        <h1 className="text-[20px] font-semibold text-foreground">Editar usuario</h1>
      </header>

      <UserForm
        mode="edit"
        userProfile={userProfile}
        action={updateUserAction}
        canManageRoleStatus={role === "admin"}
        companies={companies ?? []}
      />
    </div>
  );
}
