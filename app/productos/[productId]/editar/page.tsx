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

  const [productResult, companiesResult, establishmentsResult, selectedRowsResult] = await Promise.all([
    supabase
      .from("product")
      .select("product_id, sku, name, company_id, is_active")
      .eq("product_id", parsedProductId)
      .maybeSingle(),
    supabase
      .from("company")
      .select("company_id, name, is_active")
      .order("name", { ascending: true }),
    supabase
      .from("establishment")
      .select("establishment_id, name, is_active, route:route_id(nombre)")
      .order("name", { ascending: true }),
    supabase
      .from("products_establishment")
      .select("establishment_id")
      .eq("product_id", parsedProductId),
  ]);

  const loadedProduct = productResult.data;
  const productError = productResult.error;
  const companiesError = companiesResult.error;
  const establishmentsError = establishmentsResult.error;
  const selectedRowsError = selectedRowsResult.error;

  if (productError || companiesError || establishmentsError || selectedRowsError || !loadedProduct) {
    notFound();
  }

  const companiesData = companiesResult.data ?? [];
  const establishmentsData = establishmentsResult.data ?? [];
  const selectedRows = selectedRowsResult.data ?? [];

  const establishmentOptions = establishmentsData.map((establishment) => {
    const routeData = establishment.route as { nombre?: string } | Array<{ nombre?: string }> | null;
    const routeName = Array.isArray(routeData)
      ? routeData[0]?.nombre ?? null
      : routeData?.nombre ?? null;

    return {
      establishment_id: establishment.establishment_id,
      name: establishment.name,
      route_name: routeName,
      is_active: establishment.is_active,
    };
  });

  const initialSelectedEstablishmentIds = selectedRows
    .map((row) => row.establishment_id)
    .filter((value): value is number => Number.isInteger(value));

  const uniqueInitialSelectedEstablishmentIds = Array.from(new Set(initialSelectedEstablishmentIds));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Productos</p>
        <h1 className="text-[20px] font-semibold text-foreground">Editar producto</h1>
      </header>

      <ProductForm
        mode="edit"
        product={loadedProduct}
        action={updateProductAction}
        companies={companiesData}
        establishmentOptions={establishmentOptions}
        initialSelectedEstablishmentIds={uniqueInitialSelectedEstablishmentIds}
      />
    </div>
  );
}
