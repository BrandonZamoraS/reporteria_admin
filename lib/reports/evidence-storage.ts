import { getSupabaseEnv } from "../supabase/env.ts";
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

export type EvidenceStorageReference = {
  bucket: string;
  objectPath: string;
};

export function normalizeEvidenceCount(totalRows: number): number | null {
  return Number.isInteger(totalRows) && totalRows >= 0 ? totalRows : null;
}

export function decomposeEvidenceStorageReference(
  rawUrl: string
): EvidenceStorageReference | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }

    const marker = "/storage/v1/object/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const remainder = parsed.pathname.slice(markerIndex + marker.length);
    const [visibility, bucket, ...pathParts] = remainder.split("/").filter(Boolean);
    if (!visibility || !bucket || pathParts.length === 0) return null;

    return {
      bucket,
      objectPath: decodeURIComponent(pathParts.join("/")),
    };
  }

  const normalized = trimmed.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/")) {
    const remainder = normalized.slice("storage/v1/object/".length);
    const [visibility, bucket, ...pathParts] = remainder.split("/").filter(Boolean);
    if (!visibility || !bucket || pathParts.length === 0) return null;

    return {
      bucket,
      objectPath: decodeURIComponent(pathParts.join("/")),
    };
  }

  const [bucket, ...pathParts] = normalized.split("/").filter(Boolean);
  if (!bucket || pathParts.length === 0) return null;

  return {
    bucket,
    objectPath: pathParts.join("/"),
  };
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
