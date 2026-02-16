import { MyProfileForm } from "@/app/usuarios/_components/my-profile-form";
import { requireRole } from "@/lib/auth/require-role";

export default async function MyProfilePage() {
  const { supabase, user } = await requireRole([
    "admin",
    "editor",
    "visitante",
    "rutero",
  ]);

  const { data: profile, error } = await supabase
    .from("user_profile")
    .select("name, role, company:company_id(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const companyData = profile?.company as { name?: string } | Array<{ name?: string }> | null;
  const companyName = Array.isArray(companyData)
    ? companyData[0]?.name ?? null
    : companyData?.name ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Operacion/Usuarios</p>
        <h1 className="text-[34px] font-semibold leading-none text-foreground">
          Perfil de usuario
        </h1>
      </header>

      {error || !profile ? (
        <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[13px] font-medium text-[#9B1C1C]">
            No se pudo cargar tu perfil.
          </p>
        </section>
      ) : (
        <MyProfileForm
          name={profile.name}
          role={profile.role}
          companyName={companyName}
        />
      )}
    </div>
  );
}
