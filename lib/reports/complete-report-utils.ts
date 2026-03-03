export type CompleteReportRecord = {
  recordId: number;
  timeDate: string;
  establishmentName: string | null;
  realInventory: number | null;
  systemInventory: number | null;
  comments: string | null;
};

export type CompleteReportEvidence = {
  evidenceId: number;
  rawUrl: string;
  geoInfo: string | null;
  exif?: {
    latitude: number;
    longitude: number;
  } | null;
};

export type GeoSummary = {
  source: "geo_info" | "exif" | "none";
  value: string;
};

export type CompleteReportRow = {
  recordId: number;
  timeDate: string;
  establishmentName: string;
  realInventory: number | null;
  systemInventory: number | null;
  comments: string;
  didAdjust: boolean;
  nextArrival: "Pendiente";
  detailUrl: string;
  evidences: CompleteReportEvidence[];
};

type ResolveGeoSummaryInput = {
  geoInfo: string | null;
  exif: {
    latitude: number;
    longitude: number;
  } | null;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function formatExifCoord(value: number) {
  return value.toFixed(6);
}

export function resolveGeoSummary(input: ResolveGeoSummaryInput): GeoSummary {
  const trimmedGeoInfo = input.geoInfo?.trim() ?? "";
  if (trimmedGeoInfo.length > 0) {
    return {
      source: "geo_info",
      value: trimmedGeoInfo,
    };
  }

  if (input.exif && Number.isFinite(input.exif.latitude) && Number.isFinite(input.exif.longitude)) {
    return {
      source: "exif",
      value: `${formatExifCoord(input.exif.latitude)}, ${formatExifCoord(input.exif.longitude)}`,
    };
  }

  return {
    source: "none",
    value: "Sin geo",
  };
}

export function buildCompleteReportRows(
  records: CompleteReportRecord[],
  evidencesByRecordId: Map<number, CompleteReportEvidence[]>,
  appBaseUrl: string
): CompleteReportRow[] {
  const baseUrl = normalizeBaseUrl(appBaseUrl);

  return records.map((record) => {
    const systemInventory = record.systemInventory;
    const realInventory = record.realInventory;
    const didAdjust =
      typeof systemInventory === "number" &&
      typeof realInventory === "number" &&
      realInventory !== systemInventory;

    return {
      recordId: record.recordId,
      timeDate: record.timeDate,
      establishmentName: record.establishmentName ?? "-",
      realInventory,
      systemInventory,
      comments: record.comments ?? "-",
      didAdjust,
      nextArrival: "Pendiente",
      detailUrl: `${baseUrl}/registros/${record.recordId}`,
      evidences: evidencesByRecordId.get(record.recordId) ?? [],
    };
  });
}
