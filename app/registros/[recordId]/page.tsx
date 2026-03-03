import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EvidenceGallery } from "@/app/registros/[recordId]/_components/evidence-gallery";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

type PageProps = {
  params: Promise<{ recordId: string }>;
};

type EvidenceRow = {
  evidence_id?: number;
  url?: string;
  geo_info?: string | null;
} | null;

const DEFAULT_EVIDENCE_BUCKET_CANDIDATES = [
  "check-evidences",
  "evidence",
  "record-evidence",
  "records",
] as const;

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

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

async function resolveEvidenceUrl(
  supabase: SupabaseClient,
  rawUrl: string
) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (isHttpUrl(trimmed)) return trimmed;

  const { url: supabaseUrl } = getSupabaseEnv();

  if (trimmed.startsWith("/storage/")) {
    return `${supabaseUrl}${trimmed}`;
  }

  if (trimmed.startsWith("storage/")) {
    return `${supabaseUrl}/${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const envBucket = (process.env.NEXT_PUBLIC_EVIDENCE_BUCKET ?? process.env.EVIDENCE_BUCKET ?? "").trim();
  const segments = trimmed.split("/").filter(Boolean);
  const firstSegmentBucket = segments.length > 1 ? segments[0] : "";
  const firstSegmentPath = segments.length > 1 ? segments.slice(1).join("/") : "";

  const bucketCandidates = unique([
    envBucket,
    firstSegmentBucket,
    ...DEFAULT_EVIDENCE_BUCKET_CANDIDATES,
  ]);

  const pathCandidates = unique([
    trimmed,
    firstSegmentPath,
  ]);

  for (const bucket of bucketCandidates) {
    for (const objectPath of pathCandidates) {
      if (!bucket || !objectPath) continue;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  // Last fallback for common "bucket/path" persisted in DB.
  return `${supabaseUrl}/storage/v1/object/public/${trimmed}`;
}

export default async function RecordDetailPage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin", "editor", "rutero", "visitante"]);
  const { url: supabaseUrl } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signerClient = serviceRoleKey
    ? createClient(supabaseUrl, getSupabaseServiceRoleKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;
  const { recordId } = await params;
  const parsedRecordId = Number(recordId);

  if (!Number.isInteger(parsedRecordId) || parsedRecordId <= 0) {
    notFound();
  }

  const [recordRes, evidenceRes] = await Promise.all([
    supabase
      .from("check_record")
      .select(
        "*, product:product_id(product_id, sku, name, company_id, company:company_id(name)), establishment:establishment_id(establishment_id, name), reporter:user_id(user_id, name)"
      )
      .eq("record_id", parsedRecordId)
      .maybeSingle(),
    supabase
      .from("evidence")
      .select("evidence_id, url, geo_info")
      .eq("record_id", parsedRecordId)
      .order("evidence_id", { ascending: true }),
  ]);

  if (recordRes.error || !recordRes.data) {
    notFound();
  }

  const record = recordRes.data as {
    record_id: number;
    system_inventory: number | null;
    real_inventory: number | null;
    evidence_num: number | null;
    comments: string | null;
    time_date: string | null;
    created_at?: string | null;
    updated_at?: string | null;
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

  const productData = takeFirst(record.product);
  const establishmentData = takeFirst(record.establishment);
  const reporterData = takeFirst(record.reporter);
  const companyData = takeFirst(productData?.company);

  const inventoryDelta =
    record.system_inventory != null && record.real_inventory != null
      ? record.real_inventory - record.system_inventory
      : null;

  if (evidenceRes.error) {
    console.error("Failed to load evidence for record", {
      recordId: record.record_id,
      error: evidenceRes.error,
    });
  }

  const evidenceRows = (evidenceRes.data ?? []) as EvidenceRow[];
  const evidenceItems = (
    await Promise.all(
      evidenceRows.map(async (row) => {
        if (!row?.url) return null;
        const resolvedUrl = await resolveEvidenceUrl(signerClient, row.url);
        if (!resolvedUrl) return null;
        return { url: resolvedUrl, geoInfo: row.geo_info ?? null };
      })
    )
  ).filter((value): value is { url: string; geoInfo: string | null } => value !== null);

  const declaredEvidence = record.evidence_num ?? 0;
  const actualEvidence = evidenceItems.length;

  const createdAt = record.created_at ?? record.time_date ?? null;
  const updatedAt = record.updated_at ?? null;
  const wasEdited =
    createdAt && updatedAt
      ? new Date(updatedAt).getTime() > new Date(createdAt).getTime()
      : false;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Operacion / Registros</p>
            <h1 className="text-[20px] font-semibold text-foreground">Registro #{record.record_id}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/registros"
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Volver
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <p className="text-[16px] font-semibold text-foreground">Datos</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Fecha</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {formatDateTime(record.time_date)}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Producto</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {productData?.name ?? "-"}
              {productData?.sku ? ` (${productData.sku})` : ""}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Empresa</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{companyData?.name ?? "-"}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Establecimiento</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {establishmentData?.name ?? "-"}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Usuario</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{reporterData?.name ?? "-"}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Inventario</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {record.system_inventory ?? "-"}/{record.real_inventory ?? "-"}
              {inventoryDelta != null ? ` (${inventoryDelta >= 0 ? "+" : ""}${inventoryDelta})` : ""}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Evidencias</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {declaredEvidence} {declaredEvidence === 1 ? "declarada" : "declaradas"}
              {declaredEvidence !== actualEvidence ? ` (cargadas: ${actualEvidence})` : ""}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Ediciones</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {wasEdited ? `Editado: ${formatDateTime(updatedAt)}` : "Sin ediciones registradas"}
            </p>
          </article>
        </div>

        <div className="mt-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Comentarios</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{record.comments || "-"}</p>
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[16px] font-semibold text-foreground">Evidencias</p>
          {actualEvidence > 0 ? (
            <p className="text-[12px] text-[var(--muted)]">Tip: usa ESC para cerrar y flechas para navegar.</p>
          ) : null}
        </div>
        <div className="mt-3">
          <EvidenceGallery items={evidenceItems} />
        </div>
      </section>
    </div>
  );
}
