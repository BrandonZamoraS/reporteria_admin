import { UserForm } from "@/app/usuarios/_components/user-form";
import { createUserAction } from "@/app/usuarios/actions";
import { requireRole } from "@/lib/auth/require-role";

export default async function NewUserPage() {
  const { supabase } = await requireRole(["admin"]);
  const { data: companies } = await supabase
    .from("company")
    .select("company_id, name, is_active")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Usuarios</p>
        <h1 className="text-[20px] font-semibold text-foreground">Crear usuario</h1>
      </header>

      <UserForm mode="create" action={createUserAction} companies={companies ?? []} />
    </div>
  );
}
