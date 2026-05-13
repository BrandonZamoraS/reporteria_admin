import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  RecordEvidenceManager,
  RecordOperationsForm,
} from "@/app/registros/[recordId]/_components/record-edit-forms";
import { requireRole } from "@/lib/auth/require-role";
import { resolveEvidenceUrl } from "@/lib/reports/evidence-storage";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

type PageProps = {
  params: Promise<{ recordId: string }>;
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditRecordPage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin"]);
  const { recordId } = await params;
  const parsedRecordId = Number(recordId);

  if (!Number.isInteger(parsedRecordId) || parsedRecordId <= 0) notFound();

  const [{ data: record, error: recordError }, { data: evidences, error: evidenceError }] =
    await Promise.all([
      supabase
        .from("check_record")
        .select(
          "record_id, system_inventory, real_inventory, comments, time_date, product:product_id(name, sku), establishment:establishment_id(name), reporter:user_id(name)"
        )
        .eq("record_id", parsedRecordId)
        .maybeSingle(),
      supabase
        .from("evidence")
        .select("evidence_id, url, geo_info")
        .eq("record_id", parsedRecordId)
        .order("evidence_id", { ascending: true }),
    ]);

  if (recordError || evidenceError || !record) notFound();

  const { url: supabaseUrl } = getSupabaseEnv();
  const signerClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, getSupabaseServiceRoleKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

  const evidenceItems = await Promise.all(
    (evidences ?? []).map(async (evidence) => ({
      evidenceId: evidence.evidence_id,
      previewUrl: await resolveEvidenceUrl(signerClient, evidence.url),
      geoInfo: evidence.geo_info ?? null,
    }))
  );

  const product = Array.isArray(record.product) ? record.product[0] : record.product;
  const establishment = Array.isArray(record.establishment) ? record.establishment[0] : record.establishment;
  const reporter = Array.isArray(record.reporter) ? record.reporter[0] : record.reporter;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Operacion / Registros</p>
            <h1 className="text-[20px] font-semibold text-foreground">Editar registro #{record.record_id}</h1>
          </div>
          <Link
            href={`/registros/${record.record_id}`}
            className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            Volver al detalle
          </Link>
        </div>
      </header>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <p className="text-[16px] font-semibold text-foreground">Datos fijos</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Producto</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {product?.name ?? "-"}{product?.sku ? ` (${product.sku})` : ""}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Establecimiento</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{establishment?.name ?? "-"}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Usuario reportante</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{reporter?.name ?? "-"}</p>
          </article>
        </div>
      </section>

      <RecordOperationsForm
        record={{
          recordId: record.record_id,
          systemInventory: record.system_inventory,
          realInventory: record.real_inventory,
          comments: record.comments,
          timeDateInput: toDateTimeLocal(record.time_date),
        }}
      />
      <RecordEvidenceManager recordId={record.record_id} evidences={evidenceItems} />
    </div>
  );
}
