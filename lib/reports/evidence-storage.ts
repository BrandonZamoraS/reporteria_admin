import { getSupabaseEnv } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_EVIDENCE_BUCKET_CANDIDATES = [
  "check-evidences",
  "evidence",
  "record-evidence",
  "records",
] as const;

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export async function resolveEvidenceUrl(
  supabase: SupabaseClient,
  rawUrl: string
): Promise<string | null> {
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

  const pathCandidates = unique([trimmed, firstSegmentPath]);

  for (const bucket of bucketCandidates) {
    for (const objectPath of pathCandidates) {
      if (!bucket || !objectPath) continue;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  return `${supabaseUrl}/storage/v1/object/public/${trimmed}`;
}
