import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { logAuditAction } from "@/lib/audit/log";
import { buildDynamicReportPdf, type DynamicReportSectionInput } from "@/lib/reports/dynamic-report-pdf";
import { MAX_DYNAMIC_REPORT_PHOTOS } from "@/lib/reports/dynamic-report-types";

export const runtime = "nodejs";

/* ── Helper: format current date ──────────────────────────── */
function formatNow(): string {
  const now = new Date();
  return now.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ── Helper: safe integer parse ───────────────────────────── */
function safeParseInt(value: FormDataEntryValue | null): number | null {
  if (value === null || typeof value !== "string") return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
}

export async function POST(request: NextRequest) {
  /* ── Auth check (admin only) ─────────────────────────── */
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  /* ── Parse FormData ──────────────────────────────────── */
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalido" }, { status: 400 });
  }

  const companyId = safeParseInt(formData.get("companyId"));
  const companyName = (formData.get("companyName") as string) ?? "Sin empresa";
  const description = (formData.get("description") as string) ?? "";
  const sectionCount = safeParseInt(formData.get("sectionCount")) ?? 0;

  if (!companyId) {
    return NextResponse.json({ error: "Empresa requerida" }, { status: 400 });
  }

  if (sectionCount === 0) {
    return NextResponse.json(
      { error: "Se requiere al menos un establecimiento" },
      { status: 400 }
    );
  }

  /* ── Parse sections ──────────────────────────────────── */
  const sections: DynamicReportSectionInput[] = [];

  for (let i = 0; i < sectionCount; i++) {
    const establishmentId = safeParseInt(formData.get(`section.${i}.establishmentId`));
    const establishmentName =
      (formData.get(`section.${i}.establishmentName`) as string) ?? `Establecimiento sin nombre`;
    const sectionDesc = (formData.get(`section.${i}.description`) as string) ?? "";

    if (!establishmentId) {
      continue;
    }

    // Collect photo files for this section
    const photoBuffers: Buffer[] = [];
    for (let j = 0; j < MAX_DYNAMIC_REPORT_PHOTOS; j++) {
      const photo = formData.get(`section.${i}.photo.${j}`);
      if (photo && photo instanceof File && photo.size > 0) {
        const arrayBuffer = await photo.arrayBuffer();
        photoBuffers.push(Buffer.from(arrayBuffer));
      }
    }

    sections.push({
      establishmentId,
      establishmentName,
      description: sectionDesc,
      photoBuffers,
    });
  }

  if (sections.length === 0) {
    return NextResponse.json(
      { error: "Se requiere al menos un establecimiento" },
      { status: 400 }
    );
  }

  /* ── Generate PDF ────────────────────────────────────── */
  try {
    const pdfBuffer = await buildDynamicReportPdf({
      title: "Reporte Dinamico",
      companyName,
      description,
      generatedAt: formatNow(),
      sections,
    });

    await logAuditAction(supabase, {
      action: "EXPORT_PDF",
      description: `Exporto PDF: Reporte Dinamico - ${companyName}`,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte_dinamico_${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo generar el reporte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
