import { ExportReportButton } from "@/app/reportes/_components/export-report-button";
import { requireRole } from "@/lib/auth/require-role";
import { REPORT_DEFINITIONS, reportsForRole } from "@/lib/reports/types";

type Option = {
  id: number;
  label: string;
};

function mapCompanyOptions(rows: Array<{ company_id: number; name: string }> | null): Option[] {
  return (rows ?? []).map((row) => ({ id: row.company_id, label: row.name }));
}

function mapUserOptions(rows: Array<{ user_id: number; name: string }> | null): Option[] {
  return (rows ?? []).map((row) => ({ id: row.user_id, label: row.name }));
}

function mapRouteOptions(rows: Array<{ route_id: number; nombre: string }> | null): Option[] {
  return (rows ?? []).map((row) => ({ id: row.route_id, label: row.nombre }));
}

function mapEstablishmentOptions(
  rows: Array<{ establishment_id: number; name: string }> | null
): Option[] {
  return (rows ?? []).map((row) => ({ id: row.establishment_id, label: row.name }));
}

function mapProductOptions(rows: Array<{ product_id: number; name: string; sku: string }> | null): Option[] {
  return (rows ?? []).map((row) => ({ id: row.product_id, label: `${row.name} (${row.sku})` }));
}

export default async function ReportsPage() {
  const { supabase, role, user } = await requireRole(["admin", "editor", "visitante"]);

  const canSeeAll = role === "admin" || role === "editor";
  const availableReports = reportsForRole(role);

  const ownVisitanteProfile =
    role === "visitante"
      ? await supabase
          .from("user_profile")
          .select("company_id, company:company_id(name)")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : { data: null };

  const visitanteCompanyId =
    role === "visitante" && ownVisitanteProfile.data
      ? (ownVisitanteProfile.data.company_id as number | null)
      : null;

  const visitanteCompanyData =
    role === "visitante"
      ? ((ownVisitanteProfile.data?.company as { name?: string } | Array<{ name?: string }> | null) ??
        null)
      : null;

  const visitanteCompanyName = Array.isArray(visitanteCompanyData)
    ? visitanteCompanyData[0]?.name ?? null
    : visitanteCompanyData?.name ?? null;

  const [companiesRes, usersRes, routesRes, establishmentsRes, productsRes] = await Promise.all([
    canSeeAll
      ? supabase.from("company").select("company_id, name").order("name", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ company_id: number; name: string }> }),
    canSeeAll
      ? supabase
          .from("user_profile")
          .select("user_id, name")
          .eq("is_active", true)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ user_id: number; name: string }> }),
    canSeeAll
      ? supabase
          .from("route")
          .select("route_id, nombre")
          .eq("is_active", true)
          .order("nombre", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ route_id: number; nombre: string }> }),
    supabase
      .from("establishment")
      .select("establishment_id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("product")
      .select("product_id, name, sku")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const companyOptions = mapCompanyOptions(companiesRes.data ?? null);
  const userOptions = mapUserOptions(usersRes.data ?? null);
  const routeOptions = mapRouteOptions(routesRes.data ?? null);
  const establishmentOptions = mapEstablishmentOptions(establishmentsRes.data ?? null);
  const productOptions = mapProductOptions(productsRes.data ?? null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div>
          <p className="text-[12px] text-[#5A7984]">Reportes</p>
          <h1 className="text-[20px] font-semibold text-foreground">Reporteria</h1>
        </div>
      </header>

      {role === "visitante" ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--muted)]">
          {visitanteCompanyId
            ? `Acceso limitado a reportes de tu empresa: ${visitanteCompanyName ?? "Empresa asignada"}.`
            : "No tienes una empresa asignada. Contacta al administrador para habilitar reportes."}
        </div>
      ) : null}

      {availableReports.map((reportType) => {
        const definition = REPORT_DEFINITIONS[reportType];

        return (
          <section
            key={definition.type}
            className="rounded-[12px] border border-[var(--border)] bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold text-foreground">{definition.title}</h2>
                  <details className="group">
                    <summary className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--border)] text-[11px] font-bold text-[var(--muted)]">
                      i
                    </summary>
                    <p className="mt-2 max-w-xl rounded-[8px] bg-[#F6F7F6] px-3 py-2 text-[12px] text-[var(--muted)]">
                      {definition.info}
                    </p>
                  </details>
                </div>
                <p className="mt-1 text-[13px] text-[var(--muted)]">{definition.summary}</p>
              </div>

              <ExportReportButton
                role={role}
                reportType={definition.type}
                reportTitle={definition.title}
                defaultCompanyId={visitanteCompanyId}
                companies={companyOptions}
                users={userOptions}
                routes={routeOptions}
                establishments={establishmentOptions}
                products={productOptions}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
