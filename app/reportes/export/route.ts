import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isReportType, reportsForRole, type ReportType } from "@/lib/reports/types";

export const runtime = "nodejs";

type CompanyRef = { name?: string } | Array<{ name?: string }> | null;

type RawRow = {
  record_id: number;
  system_inventory: number | null;
  real_inventory: number | null;
  evidence_num: number | null;
  comments: string | null;
  time_date: string;
  product:
    | {
        product_id?: number;
        sku?: string;
        name?: string;
        company_id?: number;
        company?: CompanyRef;
      }
    | Array<{
        product_id?: number;
        sku?: string;
        name?: string;
        company_id?: number;
        company?: CompanyRef;
      }>
    | null;
  establishment:
    | {
        establishment_id?: number;
        name?: string;
        route_id?: number;
      }
    | Array<{
        establishment_id?: number;
        name?: string;
        route_id?: number;
      }>
    | null;
  reporter:
    | { user_id?: number; name?: string }
    | Array<{ user_id?: number; name?: string }>
    | null;
};

type FlatRow = {
  recordId: number;
  systemInventory: number | null;
  realInventory: number | null;
  evidenceNum: number | null;
  comments: string | null;
  timeDate: string;
  productId: number | null;
  productSku: string | null;
  productName: string | null;
  companyId: number | null;
  companyName: string | null;
  establishmentId: number | null;
  establishmentName: string | null;
  routeId: number | null;
  routeName: string | null;
  userId: number | null;
  userName: string | null;
};

const MAX_ROWS = 2000;

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toFlatRow(row: RawRow): FlatRow {
  const product = first(row.product);
  const establishment = first(row.establishment);
  const reporter = first(row.reporter);
  const company = first(product?.company);

  return {
    recordId: row.record_id,
    systemInventory: row.system_inventory,
    realInventory: row.real_inventory,
    evidenceNum: row.evidence_num,
    comments: row.comments,
    timeDate: row.time_date,
    productId: product?.product_id ?? null,
    productSku: product?.sku ?? null,
    productName: product?.name ?? null,
    companyId: product?.company_id ?? null,
    companyName: company?.name ?? null,
    establishmentId: establishment?.establishment_id ?? null,
    establishmentName: establishment?.name ?? null,
    routeId: establishment?.route_id ?? null,
    routeName: null,
    userId: reporter?.user_id ?? null,
    userName: reporter?.name ?? null,
  };
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function toExclusiveEndDate(value: string | null): string | null {
  if (!value) return null;
  const base = new Date(`${value}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

function buildSimplePdf(title: string, lines: string[]): ArrayBuffer {
  const maxContentLines = 46;
  const pickedLines = lines.slice(0, maxContentLines);

  if (lines.length > maxContentLines) {
    pickedLines[maxContentLines - 1] = "... listado truncado, refine los filtros para ver mas detalle.";
  }

  const streamCommands: string[] = ["BT", "/F1 11 Tf", "40 800 Td"];
  pickedLines.forEach((line, index) => {
    if (index > 0) {
      streamCommands.push("0 -15 Td");
    }
    streamCommands.push(`(${escapePdfText(line.slice(0, 140))}) Tj`);
  });
  streamCommands.push("ET");

  const content = streamCommands.join("\n");
  const contentLength = Buffer.byteLength(content);

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  const header = "%PDF-1.4\n";
  let currentOffset = Buffer.byteLength(header);
  const offsets = [0];
  let body = "";

  objects.forEach((obj) => {
    offsets.push(currentOffset);
    body += obj;
    currentOffset += Buffer.byteLength(obj);
  });

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new TextEncoder().encode(`${header}${body}${xref}${trailer}`);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function reportTitle(type: ReportType): string {
  if (type === "completo") return "Reporte completo";
  if (type === "eficiencia") return "Eficiencia operativa";
  if (type === "ajustes") return "Ajustes de inventario";
  if (type === "auditoria") return "Auditoria de usuarios";
  return "Productividad";
}

function csvName(type: ReportType): string {
  return `reporte_${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

function buildLines(type: ReportType, rows: FlatRow[]): string[] {
  const lines: string[] = [];
  lines.push(reportTitle(type));
  lines.push(`Generado: ${formatDateTime(new Date().toISOString())}`);
  lines.push(`Total de registros analizados: ${rows.length}`);
  lines.push("");

  if (type === "completo") {
    lines.push("Detalle de registros:");
    rows.forEach((row) => {
      const delta =
        row.systemInventory != null && row.realInventory != null
          ? row.realInventory - row.systemInventory
          : null;
      lines.push(
        `${formatDateTime(row.timeDate)} | ${row.companyName ?? "-"} | ${row.productName ?? "-"} (${row.productSku ?? "-"}) | ${row.establishmentName ?? "-"} | sis:${row.systemInventory ?? "-"} real:${row.realInventory ?? "-"} delta:${delta ?? "-"} | usr:${row.userName ?? "-"}`
      );
    });
    return lines;
  }

  if (type === "eficiencia") {
    type Eff = { total: number; compared: number; matches: number };
    const byUser = new Map<string, Eff>();

    rows.forEach((row) => {
      const key = row.userName ?? "Sin usuario";
      const current = byUser.get(key) ?? { total: 0, compared: 0, matches: 0 };
      current.total += 1;
      if (row.systemInventory != null && row.realInventory != null) {
        current.compared += 1;
        if (row.systemInventory === row.realInventory) {
          current.matches += 1;
        }
      }
      byUser.set(key, current);
    });

    lines.push("Eficiencia por usuario:");
    [...byUser.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([userName, info]) => {
        const efficiency = info.compared > 0 ? (info.matches / info.compared) * 100 : 0;
        lines.push(
          `${userName}: revisiones=${info.total}, comparables=${info.compared}, coincidencias=${info.matches}, eficiencia=${efficiency.toFixed(2)}%`
        );
      });
    return lines;
  }

  if (type === "ajustes") {
    const adjustedRows = rows.filter(
      (row) =>
        row.systemInventory != null &&
        row.realInventory != null &&
        row.systemInventory !== row.realInventory
    );

    lines.push(`Registros con ajuste: ${adjustedRows.length}`);
    adjustedRows.forEach((row) => {
      const delta = (row.realInventory ?? 0) - (row.systemInventory ?? 0);
      lines.push(
        `${formatDateTime(row.timeDate)} | ${row.companyName ?? "-"} | ${row.productName ?? "-"} | ${row.establishmentName ?? "-"} | delta=${delta}`
      );
    });
    return lines;
  }

  if (type === "auditoria") {
    type Audit = { total: number; firstDate: string; lastDate: string };
    const byUser = new Map<string, Audit>();

    rows.forEach((row) => {
      const key = row.userName ?? "Sin usuario";
      const current = byUser.get(key);

      if (!current) {
        byUser.set(key, {
          total: 1,
          firstDate: row.timeDate,
          lastDate: row.timeDate,
        });
        return;
      }

      current.total += 1;
      if (new Date(row.timeDate).getTime() < new Date(current.firstDate).getTime()) {
        current.firstDate = row.timeDate;
      }
      if (new Date(row.timeDate).getTime() > new Date(current.lastDate).getTime()) {
        current.lastDate = row.timeDate;
      }
      byUser.set(key, current);
    });

    lines.push("Actividad por usuario:");
    [...byUser.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([userName, info]) => {
        lines.push(
          `${userName}: registros=${info.total}, primera=${formatDate(info.firstDate)}, ultima=${formatDate(info.lastDate)}`
        );
      });
    return lines;
  }

  type Productivity = { total: number; days: Set<string> };
  const byUser = new Map<string, Productivity>();

  rows.forEach((row) => {
    const key = row.userName ?? "Sin usuario";
    const day = row.timeDate.slice(0, 10);
    const current = byUser.get(key) ?? { total: 0, days: new Set<string>() };
    current.total += 1;
    current.days.add(day);
    byUser.set(key, current);
  });

  lines.push("Productividad por usuario:");
  [...byUser.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([userName, info]) => {
      const avgDaily = info.days.size > 0 ? info.total / info.days.size : 0;
      lines.push(
        `${userName}: registros=${info.total}, dias_activos=${info.days.size}, promedio_diario=${avgDaily.toFixed(2)}`
      );
    });

  return lines;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeValue = url.searchParams.get("type");

  if (!isReportType(typeValue)) {
    return new Response("Tipo de reporte invalido", { status: 400 });
  }

  const reportType = typeValue;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile) {
    return new Response("Perfil no encontrado", { status: 403 });
  }

  const allowedTypes = reportsForRole(profile.role);
  if (!allowedTypes.includes(reportType)) {
    return new Response("No autorizado para este reporte", { status: 403 });
  }

  const requestedCompanyId = parsePositiveInt(url.searchParams.get("companyId"));
  const requestedUserId = parsePositiveInt(url.searchParams.get("userId"));
  const requestedRouteId = parsePositiveInt(url.searchParams.get("routeId"));
  const requestedEstablishmentId = parsePositiveInt(url.searchParams.get("establishmentId"));
  const requestedProductId = parsePositiveInt(url.searchParams.get("productId"));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let dataQuery = supabase
    .from("check_record")
    .select(
      "record_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name, company_id, company:company_id(name)), establishment:establishment_id(establishment_id, name, route_id), reporter:user_id(user_id, name)"
    )
    .order("time_date", { ascending: false })
    .limit(MAX_ROWS);

  if (from) {
    dataQuery = dataQuery.gte("time_date", `${from}T00:00:00`);
  }

  const toExclusive = toExclusiveEndDate(to);
  if (toExclusive) {
    dataQuery = dataQuery.lt("time_date", `${toExclusive}T00:00:00`);
  }

  if (profile.role === "visitante") {
    const ownCompanyRes = await supabase
      .from("user_profile")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const ownCompanyId = ownCompanyRes.data?.company_id ?? null;

    if (!ownCompanyId) {
      const pdf = buildSimplePdf(reportTitle(reportType), ["No hay empresa asignada para este usuario."]);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${csvName(reportType)}"`,
        },
      });
    }

    const { data: companyProducts } = await supabase
      .from("product")
      .select("product_id")
      .eq("company_id", ownCompanyId);

    const visitorProductIds = (companyProducts ?? []).map((row) => row.product_id);

    if (visitorProductIds.length === 0) {
      dataQuery = dataQuery.in("product_id", [-1]);
    } else {
      dataQuery = dataQuery.in("product_id", visitorProductIds);
    }
  }

  if (requestedCompanyId && (profile.role === "admin" || profile.role === "editor")) {
    const { data: companyProducts } = await supabase
      .from("product")
      .select("product_id")
      .eq("company_id", requestedCompanyId);

    const companyProductIds = (companyProducts ?? []).map((row) => row.product_id);

    if (companyProductIds.length === 0) {
      dataQuery = dataQuery.in("product_id", [-1]);
    } else {
      dataQuery = dataQuery.in("product_id", companyProductIds);
    }
  }

  if (requestedUserId && (profile.role === "admin" || profile.role === "editor")) {
    dataQuery = dataQuery.eq("user_id", requestedUserId);
  }

  if (requestedProductId) {
    dataQuery = dataQuery.eq("product_id", requestedProductId);
  }

  if (requestedEstablishmentId) {
    dataQuery = dataQuery.eq("establishment_id", requestedEstablishmentId);
  }

  if (requestedRouteId) {
    const { data: routeEstablishments } = await supabase
      .from("establishment")
      .select("establishment_id")
      .eq("route_id", requestedRouteId);

    const establishmentIds = (routeEstablishments ?? []).map((row) => row.establishment_id);

    if (establishmentIds.length === 0) {
      dataQuery = dataQuery.in("establishment_id", [-1]);
    } else {
      dataQuery = dataQuery.in("establishment_id", establishmentIds);
    }
  }

  const { data, error } = await dataQuery;

  if (error) {
    return new Response(`No se pudo generar el reporte: ${error.message}`, {
      status: 500,
    });
  }

  const rows = ((data ?? []) as RawRow[]).map(toFlatRow);
  const lines = buildLines(reportType, rows);
  const pdf = buildSimplePdf(reportTitle(reportType), lines);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${csvName(reportType)}"`,
      "Cache-Control": "no-store",
    },
  });
}
