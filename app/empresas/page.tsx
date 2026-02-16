import Link from "next/link";
import { CompanyDeleteButton } from "@/app/empresas/_components/company-delete-button";
import { CompanyFilters } from "@/app/empresas/_components/company-filters";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
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
  status: "all" | "active" | "inactive"
) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (status !== "all") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/empresas?${queryString}` : "/empresas";
}

export default async function CompaniesListPage({ searchParams }: PageProps) {
  const { supabase, role } = await requireRole(["admin", "editor"]);
  const { q, status, page } = await searchParams;
  const currentStatus =
    status === "active" || status === "inactive" ? status : "all";
  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let dataQuery = supabase
    .from("company")
    .select("company_id, name, direction, is_active")
    .order("company_id", { ascending: false });

  let countQuery = supabase
    .from("company")
    .select("company_id", { count: "exact", head: true });

  if (q?.trim()) {
    const search = `%${q.trim()}%`;
    dataQuery = dataQuery.ilike("name", search);
    countQuery = countQuery.ilike("name", search);
  }

  if (currentStatus === "active") {
    dataQuery = dataQuery.eq("is_active", true);
    countQuery = countQuery.eq("is_active", true);
  }

  if (currentStatus === "inactive") {
    dataQuery = dataQuery.eq("is_active", false);
    countQuery = countQuery.eq("is_active", false);
  }

  const [{ data: companies, error }, { count, error: countError }] = await Promise.all([
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
              <p className="text-[12px] text-[#5A7984]">Empresas</p>
              <h1 className="text-[20px] font-semibold text-foreground">Empresas</h1>
            </div>
            <Link
              href="/empresas/nueva"
              className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
            >
              Agregar empresa
            </Link>
          </header>

          <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
            <CompanyFilters initialQuery={q ?? ""} initialStatus={currentStatus} />
          </div>

          <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
            <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1.2fr_1.4fr_0.7fr_0.8fr] md:gap-3">
              <p>Nombre</p>
              <p>Direccion</p>
              <p>Estado</p>
              <p>Acciones</p>
            </div>

            {error || countError ? (
              <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
                No se pudieron cargar las empresas.
              </p>
            ) : null}

            {!error && !countError && (!companies || companies.length === 0) ? (
              <p className="px-4 py-4 text-[13px] text-[var(--muted)]">
                No hay empresas para mostrar.
              </p>
            ) : null}

            {!error && !countError && companies?.length
              ? companies.map((company) => (
                  <article
                    key={company.company_id}
                    className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1.2fr_1.4fr_0.7fr_0.8fr] md:items-center md:gap-3"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Nombre
                      </p>
                      <p className="text-[13px] text-[#5A7984]">{company.name}</p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Direccion
                      </p>
                      <p className="text-[13px] text-[#5A7984]">
                        {company.direction || "-"}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Estado
                      </p>
                      <p className="text-[13px] text-[#5A7984]">
                        {company.is_active ? "Activo" : "Inactivo"}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1 text-[12px] md:mt-0">
                      <Link
                        href={`/empresas/${company.company_id}/editar`}
                        className="font-semibold text-[#5A7984]"
                      >
                        Editar
                      </Link>
                      {role === "admin" ? (
                        <>
                          <span className="text-[#5A7984]">-</span>
                          <CompanyDeleteButton
                            companyId={company.company_id}
                            companyName={company.name}
                            plain
                          />
                        </>
                      ) : null}
                    </div>
                  </article>
                ))
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
                  href={buildPageHref(currentPage - 1, q, currentStatus)}
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
                  href={buildPageHref(currentPage + 1, q, currentStatus)}
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
