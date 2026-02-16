import { CompanyForm } from "@/app/empresas/_components/company-form";
import { createCompanyAction } from "@/app/empresas/actions";
import { requireRole } from "@/lib/auth/require-role";

export default async function NewCompanyPage() {
  await requireRole(["admin", "editor"]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Empresas</p>
        <h1 className="text-[20px] font-semibold text-foreground">Crear empresa</h1>
      </header>

      <CompanyForm mode="create" action={createCompanyAction} />
    </div>
  );
}
