import { notFound } from "next/navigation";
import { ProductForm } from "@/app/productos/_components/product-form";
import { updateProductAction } from "@/app/productos/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function EditProductPage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin", "editor"]);
  const { productId } = await params;
  const parsedProductId = Number(productId);

  if (!parsedProductId || Number.isNaN(parsedProductId)) {
    notFound();
  }

  const [{ data: product, error }, { data: companies }] = await Promise.all([
    supabase
      .from("product")
      .select("product_id, sku, name, company_id, is_active")
      .eq("product_id", parsedProductId)
      .maybeSingle(),
    supabase.from("company").select("company_id, name, is_active").order("name", { ascending: true }),
  ]);

  if (error || !product) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Productos</p>
        <h1 className="text-[20px] font-semibold text-foreground">Editar producto</h1>
      </header>

      <ProductForm
        mode="edit"
        product={product}
        action={updateProductAction}
        companies={companies ?? []}
      />
    </div>
  );
}
