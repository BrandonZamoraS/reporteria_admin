import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { logAuditAction } from "@/lib/audit/log";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  buildCompleteReportRows,
  resolveGeoSummary,
  type CompleteReportEvidence,
  type CompleteReportRecord,
} from "@/lib/reports/complete-report-utils";
import {
  fetchEvidenceRows,
  fetchReportRows,
  formatDateTime,
  parseReportFilters,
  reportTitle,
  xlsxName,
} from "@/lib/reports/export-core";
import { resolveEvidenceUrl } from "@/lib/reports/evidence-storage";
import { isReportType, reportsForRole } from "@/lib/reports/types";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeValue = url.searchParams.get("type");

  if (!isReportType(typeValue)) {
    return new Response("Tipo de reporte invalido", { status: 400 });
  }

  if (typeValue !== "completo") {
    return new Response("Solo el reporte completo admite exportacion Excel.", { status: 400 });
  }

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
  if (!allowedTypes.includes(typeValue)) {
    return new Response("No autorizado para este reporte", { status: 403 });
  }

  const filters = parseReportFilters(url.searchParams);

  try {
    const { rows } = await fetchReportRows({
      supabase,
      role: profile.role,
      authUserId: user.id,
      filters,
    });

    const recordIds = rows.map((row) => row.recordId);
    const evidenceRowsByRecord = await fetchEvidenceRows(supabase, recordIds);
    const { url: supabaseUrl } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const signerClient = serviceRoleKey
      ? createClient(supabaseUrl, getSupabaseServiceRoleKey(), {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : supabase;

    const evidencesByRecord = new Map<number, CompleteReportEvidence[]>();
    for (const recordId of recordIds) {
      const bucket = evidenceRowsByRecord.get(recordId) ?? [];
      const resolved = await Promise.all(
        bucket.map(async (item) => {
          const resolvedUrl = await resolveEvidenceUrl(signerClient, item.url);
          if (!resolvedUrl) return null;
          return {
            evidenceId: item.evidence_id,
            rawUrl: resolvedUrl,
            geoInfo: item.geo_info ?? null,
          } satisfies CompleteReportEvidence;
        })
      );
      evidencesByRecord.set(
        recordId,
        resolved.filter((value): value is CompleteReportEvidence => value !== null)
      );
    }

    const records: CompleteReportRecord[] = rows.map((row) => ({
      recordId: row.recordId,
      timeDate: row.timeDate,
      establishmentName: row.establishmentName,
      realInventory: row.realInventory,
      systemInventory: row.systemInventory,
      comments: row.comments,
    }));

    const completeRows = buildCompleteReportRows(records, evidencesByRecord, url.origin);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "reporteria_admin";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Reporte completo");

    sheet.columns = [
      { header: "Registro", key: "recordId", width: 12 },
      { header: "Marca temporal", key: "timeDate", width: 22 },
      { header: "Establecimiento", key: "establishmentName", width: 26 },
      { header: "Inventario fisico", key: "realInventory", width: 16 },
      { header: "Inventario sistema", key: "systemInventory", width: 16 },
      { header: "Se hizo ajuste", key: "didAdjust", width: 14 },
      { header: "Proxima llegada", key: "nextArrival", width: 16 },
      { header: "Comentarios", key: "comments", width: 30 },
      { header: "Fotografias", key: "photoUrls", width: 40 },
      { header: "Geo fotos", key: "geoSummary", width: 36 },
      { header: "Link registro", key: "detailUrl", width: 40 },
    ];

    completeRows.forEach((row) => {
      const photoUrls = row.evidences.map((item) => item.rawUrl).join("\n");
      const geoSummary = row.evidences
        .map((item, index) => {
          const geo = resolveGeoSummary({ geoInfo: item.geoInfo ?? null, exif: null });
          return `Foto ${index + 1}: ${geo.value}`;
        })
        .join("\n");

      sheet.addRow({
        recordId: row.recordId,
        timeDate: formatDateTime(row.timeDate),
        establishmentName: row.establishmentName,
        realInventory: row.realInventory ?? "-",
        systemInventory: row.systemInventory ?? "-",
        didAdjust: row.didAdjust ? "Si" : "No",
        nextArrival: row.nextArrival,
        comments: row.comments,
        photoUrls: photoUrls || "-",
        geoSummary: geoSummary || "Sin geo",
        detailUrl: row.detailUrl,
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: "top", wrapText: true };
      if (rowNumber > 1) {
        row.height = 40;
      }
    });

    const linkColumn = sheet.getColumn("detailUrl").number;
    for (let i = 2; i <= sheet.rowCount; i += 1) {
      const cell = sheet.getRow(i).getCell(linkColumn);
      if (typeof cell.value === "string" && cell.value.length > 0) {
        cell.value = { text: "Abrir registro", hyperlink: cell.value };
        cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
      }
    }

    const title = reportTitle(typeValue);
    sheet.spliceRows(1, 0, [title], [`Generado: ${formatDateTime(new Date().toISOString())}`], []);
    sheet.mergeCells("A1:K1");
    sheet.mergeCells("A2:K2");
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A2").font = { size: 10, color: { argb: "FF475569" } };

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    await logAuditAction(supabase, {
      action: "EXPORT_EXCEL",
      description: `Exporto Excel: ${title}`,
    });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${xlsxName(typeValue)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el Excel.";
    return new Response(message, { status: 500 });
  }
}
