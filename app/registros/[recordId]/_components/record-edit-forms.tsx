"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  addRecordEvidenceAction,
  deleteRecordEvidenceAction,
  updateRecordAction,
  type RecordActionState,
} from "@/app/registros/actions";

const INITIAL_STATE: RecordActionState = { error: null };

type EditableRecord = {
  recordId: number;
  systemInventory: number | null;
  realInventory: number | null;
  comments: string | null;
  timeDateInput: string;
};

type EditableEvidence = {
  evidenceId: number;
  previewUrl: string | null;
  geoInfo: string | null;
};

function ErrorToast({ state }: { state: RecordActionState }) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  return state.error ? <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p> : null;
}

export function RecordOperationsForm({ record }: { record: EditableRecord }) {
  const [state, formAction, isPending] = useActionState(updateRecordAction, INITIAL_STATE);

  return (
    <form action={formAction} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <input type="hidden" name="recordId" value={record.recordId} />
      <p className="text-[16px] font-semibold text-foreground">Datos operativos</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Fecha</span>
          <input
            type="datetime-local"
            name="timeDate"
            defaultValue={record.timeDateInput}
            required
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Inventario sistema</span>
            <input
              type="number"
              min="0"
              step="1"
              name="systemInventory"
              defaultValue={record.systemInventory ?? ""}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Inventario real</span>
            <input
              type="number"
              min="0"
              step="1"
              name="realInventory"
              defaultValue={record.realInventory ?? ""}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>
      </div>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Comentarios</span>
        <textarea
          name="comments"
          defaultValue={record.comments ?? ""}
          rows={4}
          className="w-full rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] outline-none focus:border-foreground"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Link
          href={`/registros/${record.recordId}`}
          className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>
      <ErrorToast state={state} />
    </form>
  );
}

export function RecordEvidenceManager({
  recordId,
  evidences,
}: {
  recordId: number;
  evidences: EditableEvidence[];
}) {
  const [uploadState, uploadAction, isUploading] = useActionState(addRecordEvidenceAction, INITIAL_STATE);

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[16px] font-semibold text-foreground">Gestion de evidencias</p>
        <p className="text-[12px] text-[var(--muted)]">{evidences.length} cargadas</p>
      </div>

      <form action={uploadAction} className="mt-3 rounded-[10px] border border-dashed border-[var(--border)] bg-[#F8FAF8] p-3">
        <input type="hidden" name="recordId" value={recordId} />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Agregar imagenes</span>
          <input
            type="file"
            name="files"
            accept="image/*"
            multiple
            required
            className="block w-full text-[13px] text-foreground"
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={isUploading}
            className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUploading ? "Subiendo..." : "Subir evidencias"}
          </button>
        </div>
        <ErrorToast state={uploadState} />
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {evidences.map((evidence) => (
          <EvidenceCard key={evidence.evidenceId} recordId={recordId} evidence={evidence} />
        ))}
        {evidences.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Este registro no tiene evidencias cargadas.</p>
        ) : null}
      </div>
    </section>
  );
}

function EvidenceCard({
  recordId,
  evidence,
}: {
  recordId: number;
  evidence: EditableEvidence;
}) {
  const [state, formAction, isPending] = useActionState(deleteRecordEvidenceAction, INITIAL_STATE);

  return (
    <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
      <div className="aspect-[4/3] overflow-hidden rounded-[8px] bg-white">
        {evidence.previewUrl ? (
          <Image
            src={evidence.previewUrl}
            alt=""
            width={640}
            height={480}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-[var(--muted)]">Sin vista previa</div>
        )}
      </div>
      {evidence.geoInfo ? <p className="mt-2 line-clamp-2 text-[12px] text-[var(--muted)]">{evidence.geoInfo}</p> : null}
      <form action={formAction} className="mt-3">
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="evidenceId" value={evidence.evidenceId} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[8px] border border-[#D6A7A7] px-3 py-1.5 text-[12px] font-semibold text-[#9B1C1C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Eliminando..." : "Eliminar evidencia"}
        </button>
        <ErrorToast state={state} />
      </form>
    </article>
  );
}
