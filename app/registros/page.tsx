import Link from "next/link";
import { RecordFilters } from "@/app/registros/_components/record-filters";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    company?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

type ReportRow = {
  record_id: number;
  system_inventory: number | null;
  real_inventory: number | null;
  evidence_num: number | null;
  comments: string | null;
  time_date: string;
  product?:
    | {
        product_id?: number;
        sku?: string;
        name?: string;
        company_id?: number;
        company?: { name?: string } | Array<{ name?: string }> | null;
      }
    | Array<{
        product_id?: number;
        sku?: string;
        name?: string;
        company_id?: number;
        company?: { name?: string } | Array<{ name?: string }> | null;
      }>
    | null;
  establishment?:
    | { establishment_id?: number; name?: string }
    | Array<{ establishment_id?: number; name?: string }>
    | null;
  reporter?:
    | { user_id?: number; name?: string }
    | Array<{ user_id?: number; name?: string }>
    | null;
};

type CompanyOption = {
  company_id: number;
  name: string;
};

type UserOption = {
  user_id: number;
  name: string;
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
  company: string,
  userId: string,
  dateFrom: string,
  dateTo: string
) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (company) {
    params.set("company", company);
  }

  if (userId) {
    params.set("user", userId);
  }

  if (dateFrom) {
    params.set("from", dateFrom);
  }

  if (dateTo) {
    params.set("to", dateTo);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/registros?${queryString}` : "/registros";
}

function toExclusiveEndDate(value: string) {
  const base = new Date(`${value}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function takeFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function RecordsPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "rutero", "visitante"]);
  const { q, company, user: selectedUser, from: dateFromParam, to: dateToParam, page } =
    await searchParams;

  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const currentUserProfile = await getCurrentUserProfile(user.id);
  if (!currentUserProfile) {
    return (
      <p className="mx-auto w-full max-w-6xl text-[13px] font-medium text-[#9B1C1C]">
        No se encontro un perfil activo para el usuario autenticado.
      </p>
    );
  }

  const canSeeAll = role === "admin" || role === "editor";

  const [{ data: companies }, { data: users }, { data: ownVisitanteProfile }] = await Promise.all([
    canSeeAll
      ? supabase.from("company").select("company_id, name").order("name", { ascending: true })
      : Promise.resolve({ data: [] as CompanyOption[] }),
    canSeeAll
      ? supabase
          .from("user_profile")
          .select("user_id, name")
          .eq("is_active", true)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as UserOption[] }),
    role === "visitante"
      ? supabase
          .from("user_profile")
          .select("company_id, company:company_id(name)")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const visitanteCompanyId =
    role === "visitante" && ownVisitanteProfile
      ? (ownVisitanteProfile.company_id as number | null)
      : null;
  const visitanteCompanyData =
    role === "visitante"
      ? ((ownVisitanteProfile?.company as { name?: string } | Array<{ name?: string }> | null) ?? null)
      : null;
  const visitanteCompanyName = Array.isArray(visitanteCompanyData)
    ? visitanteCompanyData[0]?.name ?? null
    : visitanteCompanyData?.name ?? null;

  const selectedCompany = canSeeAll ? company ?? "" : "";
  const selectedUserId = canSeeAll ? selectedUser ?? "" : "";
  const dateFrom = dateFromParam ?? "";
  const dateTo = dateToParam ?? "";

  let dataQuery = supabase
    .from("check_record")
    .select(
      "record_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name, company_id, company:company_id(name)), establishment:establishment_id(establishment_id, name), reporter:user_id(user_id, name)"
    )
    .order("time_date", { ascending: false });

  let countQuery = supabase.from("check_record").select("record_id", { count: "exact", head: true });

  if (role === "rutero") {
    dataQuery = dataQuery.eq("user_id", currentUserProfile.userId);
    countQuery = countQuery.eq("user_id", currentUserProfile.userId);
  }

  if (role === "visitante") {
    if (!visitanteCompanyId) {
      dataQuery = dataQuery.in("product_id", [-1]);
      countQuery = countQuery.in("product_id", [-1]);
    } else {
      const { data: companyProducts } = await supabase
        .from("product")
        .select("product_id")
        .eq("company_id", visitanteCompanyId);
      const visitorProductIds = (companyProducts ?? []).map((productRow) => productRow.product_id);

      if (visitorProductIds.length === 0) {
        dataQuery = dataQuery.in("product_id", [-1]);
        countQuery = countQuery.in("product_id", [-1]);
      } else {
        dataQuery = dataQuery.in("product_id", visitorProductIds);
        countQuery = countQuery.in("product_id", visitorProductIds);
      }
    }
  }

  if (canSeeAll && selectedCompany) {
    const parsedCompanyId = Number(selectedCompany);
    if (Number.isInteger(parsedCompanyId) && parsedCompanyId > 0) {
      const { data: companyProducts } = await supabase
        .from("product")
        .select("product_id")
        .eq("company_id", parsedCompanyId);
      const companyProductIds = (companyProducts ?? []).map((productRow) => productRow.product_id);

      if (companyProductIds.length === 0) {
        dataQuery = dataQuery.in("product_id", [-1]);
        countQuery = countQuery.in("product_id", [-1]);
      } else {
        dataQuery = dataQuery.in("product_id", companyProductIds);
        countQuery = countQuery.in("product_id", companyProductIds);
      }
    }
  }

  if (canSeeAll && selectedUserId) {
    const parsedUserId = Number(selectedUserId);
    if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
      dataQuery = dataQuery.eq("user_id", parsedUserId);
      countQuery = countQuery.eq("user_id", parsedUserId);
    }
  }

  if (dateFrom) {
    dataQuery = dataQuery.gte("time_date", `${dateFrom}T00:00:00`);
    countQuery = countQuery.gte("time_date", `${dateFrom}T00:00:00`);
  }

  if (dateTo) {
    const exclusiveEndDate = toExclusiveEndDate(dateTo);
    if (exclusiveEndDate) {
      dataQuery = dataQuery.lt("time_date", `${exclusiveEndDate}T00:00:00`);
      countQuery = countQuery.lt("time_date", `${exclusiveEndDate}T00:00:00`);
    }
  }

  if (q?.trim()) {
    const normalizedQuery = q.trim().replace(/,/g, " ");
    const search = `%${normalizedQuery}%`;
    const [{ data: matchedProducts }, { data: matchedEstablishments }, { data: matchedUsers }] =
      await Promise.all([
        supabase
          .from("product")
          .select("product_id")
          .or(`name.ilike.${search},sku.ilike.${search}`),
        supabase.from("establishment").select("establishment_id").ilike("name", search),
        canSeeAll ? supabase.from("user_profile").select("user_id").ilike("name", search) : Promise.resolve({ data: [] }),
      ]);

    const productIds = (matchedProducts ?? []).map((productRow) => productRow.product_id);
    const establishmentIds = (matchedEstablishments ?? []).map(
      (establishmentRow) => establishmentRow.establishment_id
    );
    const userIds = (matchedUsers ?? []).map((userRow: { user_id: number }) => userRow.user_id);

    const orParts: string[] = [`comments.ilike.${search}`];

    if (productIds.length > 0) {
      orParts.push(`product_id.in.(${productIds.join(",")})`);
    }

    if (establishmentIds.length > 0) {
      orParts.push(`establishment_id.in.(${establishmentIds.join(",")})`);
    }

    if (userIds.length > 0) {
      orParts.push(`user_id.in.(${userIds.join(",")})`);
    }

    if (/^\d+$/.test(normalizedQuery)) {
      orParts.push(`record_id.eq.${normalizedQuery}`);
    }

    dataQuery = dataQuery.or(orParts.join(","));
    countQuery = countQuery.or(orParts.join(","));
  }

  const [{ data: reports, error }, { count, error: countError }] = await Promise.all([
    dataQuery.range(from, to),
    countQuery,
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div>
          <p className="text-[12px] text-[#5A7984]">Operacion/Registros</p>
          <h1 className="text-[20px] font-semibold text-foreground">Registros</h1>
        </div>
      </header>

      {role === "rutero" ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--muted)]">
          Mostrando unicamente registros creados por tu usuario.
        </div>
      ) : null}

      {role === "visitante" ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--muted)]">
          {visitanteCompanyId
            ? `Mostrando registros de productos de tu empresa: ${visitanteCompanyName ?? "Empresa asignada"}.`
            : "No tienes una empresa asignada. Contacta al administrador."}
        </div>
      ) : null}

      <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
        <RecordFilters
          initialQuery={q ?? ""}
          initialCompany={selectedCompany}
          initialUser={selectedUserId}
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
          companies={companies ?? []}
          users={users ?? []}
          showCompanyFilter={canSeeAll}
          showUserFilter={canSeeAll}
        />
      </div>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1fr_1.4fr] md:gap-3">
          <p>Fecha</p>
          <p>Producto</p>
          <p>Empresa</p>
          <p>Establecimiento</p>
          <p>Usuario</p>
          <p>Inventario</p>
          <p>Evidencias</p>
          <p>Comentarios</p>
        </div>

        {error || countError ? (
          <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
            No se pudieron cargar los registros.
          </p>
        ) : null}

        {!error && !countError && (!reports || reports.length === 0) ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">No hay registros para mostrar.</p>
        ) : null}

        {!error && !countError && reports?.length
          ? (reports as ReportRow[]).map((report) => {
              const productData = takeFirst(report.product);
              const establishmentData = takeFirst(report.establishment);
              const reporterData = takeFirst(report.reporter);
              const companyData = takeFirst(productData?.company);

              const inventoryDelta =
                report.system_inventory != null && report.real_inventory != null
                  ? report.real_inventory - report.system_inventory
                  : null;

              return (
                <article
                  key={report.record_id}
                  className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1fr_1.4fr] md:items-center md:gap-3"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Fecha</p>
                    <p className="text-[13px] text-[#5A7984]">{formatDateTime(report.time_date)}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Producto</p>
                    <p className="text-[13px] text-[#5A7984]">
                      {productData?.name ?? "-"}
                      {productData?.sku ? ` (${productData.sku})` : ""}
                    </p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Empresa</p>
                    <p className="text-[13px] text-[#5A7984]">{companyData?.name ?? "-"}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                      Establecimiento
                    </p>
                    <p className="text-[13px] text-[#5A7984]">{establishmentData?.name ?? "-"}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Usuario</p>
                    <p className="text-[13px] text-[#5A7984]">{reporterData?.name ?? "-"}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Inventario</p>
                    <p className="text-[13px] text-[#5A7984]">
                      {report.system_inventory ?? "-"}/{report.real_inventory ?? "-"}
                      {inventoryDelta != null ? ` (${inventoryDelta >= 0 ? "+" : ""}${inventoryDelta})` : ""}
                    </p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Evidencias</p>
                    <p className="text-[13px] text-[#5A7984]">{report.evidence_num ?? 0}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Comentarios</p>
                    <p className="text-[13px] text-[#5A7984]">{report.comments || "-"}</p>
                  </div>
                </article>
              );
            })
          : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--muted)]">
          Mostrando {totalCount === 0 ? 0 : from + 1}-{Math.min(totalCount, to + 1)} de {totalCount}
        </p>

        <div className="flex items-center gap-2">
          {canGoPrev ? (
            <Link
              href={buildPageHref(currentPage - 1, q, selectedCompany, selectedUserId, dateFrom, dateTo)}
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
              href={buildPageHref(currentPage + 1, q, selectedCompany, selectedUserId, dateFrom, dateTo)}
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
