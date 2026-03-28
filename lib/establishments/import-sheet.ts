import type ExcelJS from "exceljs";

const TEMPLATE_HEADER_ALIASES = {
  routeId: ["id de ruta", "id ruta", "route id", "id"],
  route: ["nombre de ruta", "ruta asignada", "route name", "ruta", "route"],
  name: [
    "nombre del establecimiento",
    "nombre establecimiento",
    "establecimiento",
    "nombre",
  ],
  format: ["tipo de formato", "formato", "canal"],
  zone: ["zona", "region", "sector"],
  direction: ["direccion exacta", "direccion detallada", "direccion"],
  province: ["provincia"],
  canton: ["canton"],
  district: ["distrito"],
  coordinates: [
    "latitud y longitud",
    "latitud / longitud",
    "latitud,longitud",
    "lat,long",
    "coordenadas",
    "coordenada",
  ],
  status: ["estado", "activo", "estatus"],
} as const;

export type EstablishmentTemplateColumnKey = Exclude<
  keyof typeof TEMPLATE_HEADER_ALIASES,
  "routeId"
>;

export type EstablishmentTemplateColumnMap = Record<EstablishmentTemplateColumnKey, number>;

type TemplateHeaderMatch = {
  key: keyof typeof TEMPLATE_HEADER_ALIASES;
  score: number;
};

export const ESTABLISHMENT_TEMPLATE_COLUMNS = [
  { header: "id", key: "routeId", width: 14 },
  { header: "nombre de ruta", key: "route", width: 28 },
  { header: "nombre(establecimiento)", key: "name", width: 32 },
  { header: "formato", key: "format", width: 20 },
  { header: "zona", key: "zone", width: 18 },
  { header: "direccion", key: "direction", width: 40 },
  { header: "provincia", key: "province", width: 20 },
  { header: "canton", key: "canton", width: 20 },
  { header: "distrito", key: "district", width: 20 },
  { header: "coordenadas", key: "coordinates", width: 40 },
  { header: "estado", key: "status", width: 14 },
] as const;

export function normalizeTemplateHeaderCell(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .replace(/[.:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTemplateHeaderMatch(normalizedValue: string): TemplateHeaderMatch | null {
  let bestMatch: TemplateHeaderMatch | null = null;

  for (const [key, aliases] of Object.entries(TEMPLATE_HEADER_ALIASES) as Array<
    [keyof typeof TEMPLATE_HEADER_ALIASES, readonly string[]]
  >) {
    for (const alias of aliases) {
      let score = -1;

      if (normalizedValue === alias) {
        score = 1000 + alias.length;
      } else if (normalizedValue.includes(alias)) {
        score = alias.length;
      }

      if (score < 0) continue;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key, score };
      }
    }
  }

  return bestMatch;
}

export function findEstablishmentTemplateHeaderRow(sheet: ExcelJS.Worksheet) {
  const requiredKeys = Object.keys(TEMPLATE_HEADER_ALIASES).filter(
    (key): key is EstablishmentTemplateColumnKey => key !== "routeId"
  );

  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const headerMap = {} as Partial<EstablishmentTemplateColumnMap>;

    for (let cellNumber = 1; cellNumber <= row.cellCount; cellNumber += 1) {
      const normalizedValue = normalizeTemplateHeaderCell(row.getCell(cellNumber).text);
      if (!normalizedValue) continue;

      const match = resolveTemplateHeaderMatch(normalizedValue);
      if (!match || match.key === "routeId") {
        continue;
      }

      if (!headerMap[match.key]) {
        headerMap[match.key] = cellNumber;
      }
    }

    if (requiredKeys.every((key) => headerMap[key])) {
      return { rowNumber, columns: headerMap as EstablishmentTemplateColumnMap };
    }
  }

  return null;
}
