import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPhotoPlaceholder } from "@/app/productos/_components/product-photo-placeholder";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { supabase, role } = await requireRole(["admin", "editor", "visitante"]);
  const { productId } = await params;
  const parsedProductId = Number(productId);

  if (!parsedProductId || Number.isNaN(parsedProductId)) {
    notFound();
  }

  const { data: product, error } = await supabase
    .from("product")
    .select("product_id, sku, name, is_active, photo_url, company:company_id(name)")
    .eq("product_id", parsedProductId)
    .maybeSingle();

  if (error || !product) {
    notFound();
  }

  const companyData = product.company as
    | { name?: string }
    | Array<{ name?: string }>
    | null;
  const companyName = Array.isArray(companyData)
    ? companyData[0]?.name ?? "-"
    : companyData?.name ?? "-";

  const canManage = role === "admin" || role === "editor";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
        <div>
          <p className="text-[12px] text-[#5A7984]">Productos</p>
          <h1 className="text-[20px] font-semibold text-foreground">{product.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/productos"
            className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            Volver
          </Link>
          {canManage ? (
            <Link
              href={`/productos/${product.product_id}/editar`}
              className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
            >
              Editar
            </Link>
          ) : null}
        </div>
      </header>

      <div className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        {/* Photo section */}
        <div className="mb-4">
          {product.photo_url ? (
            <div
              data-testid="product-photo"
              className="relative h-48 w-full max-w-sm overflow-hidden rounded-[8px] border border-[var(--border)]"
            >
              <Image
                src={product.photo_url}
                alt={`Foto de ${product.name}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 384px"
                priority
              />
            </div>
          ) : (
            <ProductPhotoPlaceholder size="lg" />
          )}
        </div>

        {/* Info section */}
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-semibold text-[var(--muted)]">SKU</p>
              <p className="text-[13px] text-[#5A7984]">{product.sku}</p>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[var(--muted)]">Estado</p>
              <p className="text-[13px] text-[#5A7984]">
                {product.is_active ? "Activo" : "Inactivo"}
              </p>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[var(--muted)]">Empresa</p>
              <p className="text-[13px] text-[#5A7984]">{companyName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
