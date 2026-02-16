import { ProductForm } from "@/app/productos/_components/product-form";
import { createProductAction } from "@/app/productos/actions";
import { requireRole } from "@/lib/auth/require-role";

export default async function NewProductPage() {
  const { supabase } = await requireRole(["admin", "editor"]);
  const { data: companies } = await supabase
    .from("company")
    .select("company_id, name, is_active")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Productos</p>
        <h1 className="text-[20px] font-semibold text-foreground">Crear producto</h1>
      </header>

      <ProductForm mode="create" action={createProductAction} companies={companies ?? []} />
    </div>
  );
}
