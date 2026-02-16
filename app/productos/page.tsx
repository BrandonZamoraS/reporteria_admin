import Link from "next/link";
import { ProductDeleteButton } from "@/app/productos/_components/product-delete-button";
import { ProductFilters } from "@/app/productos/_components/product-filters";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    company?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 10;

function parsePage(page: string | undefined) {
  const parsed = Number(page ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function buildPageHref(
  page: number,
  query: string | undefined,
  status: "all" | "active" | "inactive",
  company: string | undefined
) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (status !== "all") {
    params.set("status", status);
  }

  if (company?.trim()) {
    params.set("company", company.trim());
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/productos?${queryString}` : "/productos";
}

export default async function ProductsListPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "visitante"]);
  const { q, status, company, page } = await searchParams;
  const currentStatus = status === "active" || status === "inactive" ? status : "all";
  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const canManage = role === "admin" || role === "editor";
  const showCompanyFilter = canManage;
  const selectedCompany = showCompanyFilter ? (company ?? "") : "";

  const [{ data: companies }, { data: ownProfile }] = await Promise.all([
    canManage
      ? supabase
          .from("company")
          .select("company_id, name")
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ company_id: number; name: string }> }),
    role === "visitante"
      ? supabase
          .from("user_profile")
          .select("company_id, company:company_id(name)")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const visitanteCompanyId =
    role === "visitante" && ownProfile ? (ownProfile.company_id as number | null) : null;
  const visitanteCompanyData = role === "visitante" ? (ownProfile?.company as { name?: string } | Array<{ name?: string }> | null) : null;
  const visitanteCompanyName = Array.isArray(visitanteCompanyData)
    ? visitanteCompanyData[0]?.name ?? null
    : visitanteCompanyData?.name ?? null;

  let dataQuery = supabase
    .from("product")
    .select("product_id, sku, name, is_active, company:company_id(name)")
    .order("product_id", { ascending: false });

  let countQuery = supabase.from("product").select("product_id", { count: "exact", head: true });

  if (q?.trim()) {
    const search = `%${q.trim()}%`;
    dataQuery = dataQuery.or(`name.ilike.${search},sku.ilike.${search}`);
    countQuery = countQuery.or(`name.ilike.${search},sku.ilike.${search}`);
  }

  if (currentStatus === "active") {
    dataQuery = dataQuery.eq("is_active", true);
    countQuery = countQuery.eq("is_active", true);
  }

  if (currentStatus === "inactive") {
    dataQuery = dataQuery.eq("is_active", false);
    countQuery = countQuery.eq("is_active", false);
  }

  if (showCompanyFilter && selectedCompany) {
    const selectedCompanyId = Number(selectedCompany);
    if (Number.isInteger(selectedCompanyId) && selectedCompanyId > 0) {
      dataQuery = dataQuery.eq("company_id", selectedCompanyId);
      countQuery = countQuery.eq("company_id", selectedCompanyId);
    }
  }

  if (role === "visitante") {
    if (visitanteCompanyId) {
      dataQuery = dataQuery.eq("company_id", visitanteCompanyId);
      countQuery = countQuery.eq("company_id", visitanteCompanyId);
    } else {
      dataQuery = dataQuery.eq("company_id", -1);
      countQuery = countQuery.eq("company_id", -1);
    }
  }

  const [{ data: products, error }, { count, error: countError }] = await Promise.all([
    dataQuery.range(from, to),
    countQuery,
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
        <div>
          <p className="text-[12px] text-[#5A7984]">Productos</p>
          <h1 className="text-[20px] font-semibold text-foreground">Productos</h1>
        </div>
        {canManage ? (
          <Link
            href="/productos/nueva"
            className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
          >
            Agregar producto
          </Link>
        ) : null}
      </header>

      {role === "visitante" ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--muted)]">
          {visitanteCompanyId
            ? `Mostrando productos de tu empresa: ${visitanteCompanyName ?? "Empresa asignada"}.`
            : "No tienes una empresa asignada. Contacta al administrador."}
        </div>
      ) : null}

      <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
        <ProductFilters
          initialQuery={q ?? ""}
          initialStatus={currentStatus}
          initialCompany={selectedCompany}
          companies={companies ?? []}
          showCompanyFilter={showCompanyFilter}
        />
      </div>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[0.8fr_1.2fr_1.2fr_0.7fr_0.8fr] md:gap-3">
          <p>SKU</p>
          <p>Nombre</p>
          <p>Empresa</p>
          <p>Estado</p>
          <p>Acciones</p>
        </div>

        {error || countError ? (
          <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
            No se pudieron cargar los productos.
          </p>
        ) : null}

        {!error && !countError && (!products || products.length === 0) ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">No hay productos para mostrar.</p>
        ) : null}

        {!error && !countError && products?.length
          ? products.map((product) => {
              const companyData = product.company as
                | { name?: string }
                | Array<{ name?: string }>
                | null;
              const companyName = Array.isArray(companyData)
                ? companyData[0]?.name ?? "-"
                : companyData?.name ?? "-";

              return (
                <article
                  key={product.product_id}
                  className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[0.8fr_1.2fr_1.2fr_0.7fr_0.8fr] md:items-center md:gap-3"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">SKU</p>
                    <p className="text-[13px] text-[#5A7984]">{product.sku}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Nombre</p>
                    <p className="text-[13px] text-[#5A7984]">{product.name}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                      Empresa
                    </p>
                    <p className="text-[13px] text-[#5A7984]">{companyName}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Estado</p>
                    <p className="text-[13px] text-[#5A7984]">
                      {product.is_active ? "Activo" : "Inactivo"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1 text-[12px] md:mt-0">
                    {canManage ? (
                      <>
                        <Link
                          href={`/productos/${product.product_id}/editar`}
                          className="font-semibold text-[#5A7984]"
                        >
                          Editar
                        </Link>
                        {role === "admin" ? (
                          <>
                            <span className="text-[#5A7984]">-</span>
                            <ProductDeleteButton productId={product.product_id} plain />
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[#5A7984]">Sin acciones</span>
                    )}
                  </div>
                </article>
              );
            })
          : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--muted)]">
          Mostrando {totalCount === 0 ? 0 : from + 1}-{Math.min(totalCount, to + 1)} de{" "}
          {totalCount}
        </p>

        <div className="flex items-center gap-2">
          {canGoPrev ? (
            <Link
              href={buildPageHref(currentPage - 1, q, currentStatus, selectedCompany)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
            >
              Anterior
            </Link>
          ) : (
            <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
              Anterior
            </span>
          )}

          <span className="text-[12px] font-semibold text-[var(--muted)]">
            Pagina {Math.min(currentPage, totalPages)} de {totalPages}
          </span>

          {canGoNext ? (
            <Link
              href={buildPageHref(currentPage + 1, q, currentStatus, selectedCompany)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
            >
              Siguiente
            </Link>
          ) : (
            <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
              Siguiente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
