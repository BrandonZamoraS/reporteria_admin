"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import {
  decomposeEvidenceStorageReference,
  normalizeEvidenceCount,
} from "@/lib/reports/evidence-storage";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RecordActionState = { error: string | null };
export type DeleteRecordActionState = { error: string | null; success: boolean };

type AuthenticatedAdminContext =
  | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { error: string };

function parsePositiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInventory(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : raw;
}

function evidenceBucket() {
  return (process.env.NEXT_PUBLIC_EVIDENCE_BUCKET ?? process.env.EVIDENCE_BUCKET ?? "check-evidences").trim();
}

function createStorageAdminClient() {
  const { url } = getSupabaseEnv();
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAdminContext(): Promise<AuthenticatedAdminContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };

  const role = await getUserRoleFromProfile(user.id);
  if (role !== "admin") return { error: "Solo admin puede administrar registros." };

  return { supabase };
}

async function synchronizeEvidenceCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  recordId: number
) {
  const { count, error: countError } = await supabase
    .from("evidence")
    .select("evidence_id", { count: "exact", head: true })
    .eq("record_id", recordId);

  if (countError) return false;

  const normalized = normalizeEvidenceCount(count ?? 0);
  if (normalized == null) return false;

  const { error: updateError } = await supabase
    .from("check_record")
    .update({ evidence_num: normalized })
    .eq("record_id", recordId);

  return !updateError;
}

async function removeStorageReferences(urls: string[]) {
  const references = urls
    .map((url) => decomposeEvidenceStorageReference(url))
    .filter((value): value is NonNullable<typeof value> => value !== null);

  const byBucket = new Map<string, string[]>();
  for (const reference of references) {
    const current = byBucket.get(reference.bucket) ?? [];
    current.push(reference.objectPath);
    byBucket.set(reference.bucket, current);
  }

  if (byBucket.size === 0) return true;

  const storage = createStorageAdminClient();
  for (const [bucket, paths] of byBucket) {
    const { error } = await storage.storage.from(bucket).remove(paths);
    if (error) return false;
  }

  return true;
}

export async function updateRecordAction(
  _prevState: RecordActionState,
  formData: FormData
): Promise<RecordActionState> {
  const recordId = parsePositiveInteger(formData.get("recordId"));
  const systemInventory = parseOptionalInventory(formData.get("systemInventory"));
  const realInventory = parseOptionalInventory(formData.get("realInventory"));
  const timeDate = parseDateTime(formData.get("timeDate"));
  const comments = String(formData.get("comments") ?? "").trim();

  if (!recordId) return { error: "Registro invalido." };
  if (systemInventory === undefined || realInventory === undefined) {
    return { error: "Los inventarios deben ser enteros mayores o iguales a cero." };
  }
  if (timeDate === undefined) return { error: "La fecha del registro es invalida." };

  const context = await getAdminContext();
  if ("error" in context) return { error: context.error };

  const { error } = await context.supabase
    .from("check_record")
    .update({
      system_inventory: systemInventory,
      real_inventory: realInventory,
      time_date: timeDate,
      comments: comments || null,
    })
    .eq("record_id", recordId);

  if (error) return { error: "No se pudo actualizar el registro. (REG-UPD-01)" };

  revalidatePath(`/registros/${recordId}`);
  redirect(`/registros/${recordId}`);
}

export async function addRecordEvidenceAction(
  _prevState: RecordActionState,
  formData: FormData
): Promise<RecordActionState> {
  const recordId = parsePositiveInteger(formData.get("recordId"));
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!recordId) return { error: "Registro invalido." };
  if (files.length === 0) return { error: "Selecciona al menos una imagen." };
  if (files.some((file) => !file.type.startsWith("image/"))) {
    return { error: "Solo se permiten archivos de imagen." };
  }

  const context = await getAdminContext();
  if ("error" in context) return { error: context.error };

  const bucket = evidenceBucket();
  if (!bucket) return { error: "No hay bucket de evidencias configurado." };

  const storage = createStorageAdminClient();
  const uploaded: Array<{ bucket: string; path: string; url: string }> = [];

  for (const file of files) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const safeExtension = String(extension ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const path = `records/${recordId}/${crypto.randomUUID()}.${safeExtension}`;
    const { error } = await storage.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      await removeStorageReferences(uploaded.map((item) => item.url));
      return { error: "No se pudo subir la evidencia a Storage. (REG-EVI-UPL-01)" };
    }

    uploaded.push({ bucket, path, url: `${bucket}/${path}` });
  }

  const { error: insertError } = await context.supabase.from("evidence").insert(
    uploaded.map((item) => ({
      record_id: recordId,
      url: item.url,
    }))
  );

  if (insertError) {
    await removeStorageReferences(uploaded.map((item) => item.url));
    return { error: "No se pudieron registrar las evidencias. (REG-EVI-INS-01)" };
  }

  const synchronized = await synchronizeEvidenceCount(context.supabase, recordId);
  if (!synchronized) return { error: "Las evidencias se guardaron, pero no se sincronizo el conteo." };

  revalidatePath(`/registros/${recordId}`);
  revalidatePath(`/registros/${recordId}/editar`);
  redirect(`/registros/${recordId}/editar`);
}

export async function deleteRecordEvidenceAction(
  _prevState: RecordActionState,
  formData: FormData
): Promise<RecordActionState> {
  const recordId = parsePositiveInteger(formData.get("recordId"));
  const evidenceId = parsePositiveInteger(formData.get("evidenceId"));

  if (!recordId || !evidenceId) return { error: "Evidencia invalida." };

  const context = await getAdminContext();
  if ("error" in context) return { error: context.error };

  const { data: evidence, error: evidenceError } = await context.supabase
    .from("evidence")
    .select("evidence_id, url")
    .eq("evidence_id", evidenceId)
    .eq("record_id", recordId)
    .maybeSingle();

  if (evidenceError || !evidence) return { error: "La evidencia ya no esta disponible." };

  const storageRemoved = await removeStorageReferences([evidence.url]);
  if (!storageRemoved) return { error: "No se pudo limpiar Storage; no se borro la evidencia." };

  const { error: deleteError } = await context.supabase
    .from("evidence")
    .delete()
    .eq("evidence_id", evidenceId)
    .eq("record_id", recordId);

  if (deleteError) return { error: "No se pudo eliminar la evidencia. (REG-EVI-DEL-01)" };

  const synchronized = await synchronizeEvidenceCount(context.supabase, recordId);
  if (!synchronized) return { error: "La evidencia se elimino, pero no se sincronizo el conteo." };

  revalidatePath(`/registros/${recordId}`);
  revalidatePath(`/registros/${recordId}/editar`);
  redirect(`/registros/${recordId}/editar`);
}

export async function deleteRecordAction(
  _prevState: DeleteRecordActionState,
  formData: FormData
): Promise<DeleteRecordActionState> {
  const recordId = parsePositiveInteger(formData.get("recordId"));
  if (!recordId) return { error: "Registro invalido.", success: false };

  const context = await getAdminContext();
  if ("error" in context) return { error: context.error, success: false };

  const { data: evidences, error: evidenceError } = await context.supabase
    .from("evidence")
    .select("url")
    .eq("record_id", recordId);

  if (evidenceError) {
    return { error: "No se pudieron cargar las evidencias del registro.", success: false };
  }

  const storageRemoved = await removeStorageReferences((evidences ?? []).map((item) => item.url));
  if (!storageRemoved) {
    return { error: "No se pudo limpiar Storage; no se borro el registro.", success: false };
  }

  const { error: evidenceDeleteError } = await context.supabase
    .from("evidence")
    .delete()
    .eq("record_id", recordId);

  if (evidenceDeleteError) {
    return { error: "No se pudieron borrar las evidencias del registro. (REG-DEL-EVI-01)", success: false };
  }

  const { error: recordDeleteError } = await context.supabase
    .from("check_record")
    .delete()
    .eq("record_id", recordId);

  if (recordDeleteError) {
    return { error: "No se pudo eliminar el registro. (REG-DEL-01)", success: false };
  }

  revalidatePath("/registros");
  redirect("/registros");
}
