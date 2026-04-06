import type { FlatRow } from "@/lib/reports/export-core";

export type CompanyProductividadScopeEstablishment = {
  companyId: number | null;
  companyName: string;
  routeId: number;
  establishmentId: number;
};

export type CompanyProductividadCompanySummary = {
  companyId: number | null;
  companyName: string;
  totalRecords: number;
  activeDays: number;
  averagePerDay: number;
  visitedEstablishments: number;
  routeCount: number;
  scopedEstablishments: number;
  completedRouteEstablishments: number;
  completionRate: number | null;
};

export type CompanyProductividadSummary = {
  totalRecords: number;
  totalCompanies: number;
  totalActiveDays: number;
  averagePerDay: number;
  totalVisitedEstablishments: number;
  totalRoutesInScope: number;
  totalScopedEstablishments: number;
  totalGeneralEstablishments: number;
  totalCompletedRouteEstablishments: number;
  overallCompletionRate: number | null;
  companies: CompanyProductividadCompanySummary[];
};

type CompanyAccumulator = {
  companyId: number | null;
  companyName: string;
  totalRecords: number;
  days: Set<string>;
  visitedEstablishments: Set<number>;
};

function buildCompanyKey(companyId: number | null, companyName: string | null) {
  return `${companyId ?? "none"}::${companyName ?? "Sin empresa"}`;
}

function createCompanyAccumulator(companyId: number | null, companyName: string | null): CompanyAccumulator {
  return {
    companyId,
    companyName: companyName ?? "Sin empresa",
    totalRecords: 0,
    days: new Set<string>(),
    visitedEstablishments: new Set<number>(),
  };
}

export function buildCompanyProductividadSummary(
  rows: FlatRow[],
  scopedEstablishments: CompanyProductividadScopeEstablishment[]
): CompanyProductividadSummary {
  const byCompany = new Map<string, CompanyAccumulator>();
  const globalDays = new Set<string>();
  const globalVisitedEstablishments = new Set<number>();
  const globalRoutes = new Set<number>();
  const globalScopedEstablishments = new Set<string>();
  const routeIdsByCompany = new Map<string, Set<number>>();
  const establishmentIdsByCompany = new Map<string, Set<number>>();

  for (const item of scopedEstablishments) {
    const key = buildCompanyKey(item.companyId, item.companyName);
    if (!byCompany.has(key)) {
      byCompany.set(key, createCompanyAccumulator(item.companyId, item.companyName));
    }

    const routes = routeIdsByCompany.get(key) ?? new Set<number>();
    routes.add(item.routeId);
    routeIdsByCompany.set(key, routes);

    const establishments = establishmentIdsByCompany.get(key) ?? new Set<number>();
    establishments.add(item.establishmentId);
    establishmentIdsByCompany.set(key, establishments);

    globalRoutes.add(item.routeId);
    globalScopedEstablishments.add(`${item.companyId ?? "none"}:${item.establishmentId}`);
  }

  for (const row of rows) {
    const key = buildCompanyKey(row.companyId, row.companyName);
    const current = byCompany.get(key) ?? createCompanyAccumulator(row.companyId, row.companyName);
    const day = row.timeDate.slice(0, 10);

    current.totalRecords += 1;
    current.days.add(day);
    globalDays.add(day);

    if (typeof row.establishmentId === "number") {
      current.visitedEstablishments.add(row.establishmentId);
      globalVisitedEstablishments.add(row.establishmentId);
    }

    byCompany.set(key, current);
  }

  const companies = [...byCompany.entries()]
    .map<CompanyProductividadCompanySummary>(([key, item]) => {
      const companyRoutes = routeIdsByCompany.get(key) ?? new Set<number>();
      const companyEstablishments = establishmentIdsByCompany.get(key) ?? new Set<number>();

      let completedRouteEstablishments = 0;
      for (const establishmentId of companyEstablishments) {
        if (item.visitedEstablishments.has(establishmentId)) {
          completedRouteEstablishments += 1;
        }
      }

      const scopedCount = companyEstablishments.size;
      const completionRate =
        scopedCount > 0 ? (completedRouteEstablishments / scopedCount) * 100 : null;

      return {
        companyId: item.companyId,
        companyName: item.companyName,
        totalRecords: item.totalRecords,
        activeDays: item.days.size,
        averagePerDay: item.days.size > 0 ? item.totalRecords / item.days.size : 0,
        visitedEstablishments: item.visitedEstablishments.size,
        routeCount: companyRoutes.size,
        scopedEstablishments: scopedCount,
        completedRouteEstablishments,
        completionRate,
      };
    })
    .sort((left, right) => {
      if (right.totalRecords !== left.totalRecords) {
        return right.totalRecords - left.totalRecords;
      }

      if (right.visitedEstablishments !== left.visitedEstablishments) {
        return right.visitedEstablishments - left.visitedEstablishments;
      }

      return left.companyName.localeCompare(right.companyName, "es");
    });

  const totalScopedEstablishments = companies.reduce((sum, item) => sum + item.scopedEstablishments, 0);
  const totalCompletedRouteEstablishments = companies.reduce(
    (sum, item) => sum + item.completedRouteEstablishments,
    0
  );

  return {
    totalRecords: rows.length,
    totalCompanies: companies.length,
    totalActiveDays: globalDays.size,
    averagePerDay: globalDays.size > 0 ? rows.length / globalDays.size : 0,
    totalVisitedEstablishments: globalVisitedEstablishments.size,
    totalRoutesInScope: globalRoutes.size,
    totalScopedEstablishments,
    totalGeneralEstablishments: globalScopedEstablishments.size,
    totalCompletedRouteEstablishments,
    overallCompletionRate:
      totalScopedEstablishments > 0
        ? (totalCompletedRouteEstablishments / totalScopedEstablishments) * 100
        : null,
    companies,
  };
}

export function formatCompanyProductividadCompletion(
  company: Pick<
    CompanyProductividadCompanySummary,
    "completionRate" | "completedRouteEstablishments" | "scopedEstablishments"
  >
) {
  if (company.completionRate == null) return "N/D";
  return `${company.completionRate.toFixed(1)}% (${company.completedRouteEstablishments}/${company.scopedEstablishments})`;
}
