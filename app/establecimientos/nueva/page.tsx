import { EstablishmentForm } from "@/app/establecimientos/_components/establishment-form";
import { createEstablishmentAction } from "@/app/establecimientos/actions";
import { requireRole } from "@/lib/auth/require-role";

export default async function NewEstablishmentPage() {
  const { supabase } = await requireRole(["admin", "editor"]);

  const [{ data: routes }, { data: products }] = await Promise.all([
    supabase
      .from("route")
      .select("route_id, nombre, is_active")
      .order("nombre", { ascending: true }),
    supabase
      .from("product")
      .select("product_id, sku, name, is_active, company:company_id(name)")
      .order("name", { ascending: true }),
  ]);

  const normalizedProducts = (products ?? []).map((product) => {
    const companyData = product.company as
      | { name?: string }
      | Array<{ name?: string }>
      | null;

    const companyName = Array.isArray(companyData)
      ? companyData[0]?.name ?? null
      : companyData?.name ?? null;

    return {
      product_id: product.product_id,
      sku: product.sku,
      name: product.name,
      is_active: product.is_active,
      company_name: companyName,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Operacion / Establecimientos</p>
        <h1 className="text-[20px] font-semibold text-foreground">Crear establecimiento</h1>
      </header>

      <EstablishmentForm
        mode="create"
        action={createEstablishmentAction}
        routeOptions={routes ?? []}
        productOptions={normalizedProducts}
        initialSelectedProducts={[]}
      />
    </div>
  );
}
