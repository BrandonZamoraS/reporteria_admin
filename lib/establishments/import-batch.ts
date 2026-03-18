export type ImportDuplicateCandidate = {
  rowNumber: number;
  routeId: number;
  routeName: string;
  name: string;
};

export type ExistingEstablishmentDuplicate = {
  routeId: number;
  name: string;
};

function normalizeForDuplicateCheck(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function buildDuplicateKey(routeId: number, name: string) {
  return `${routeId}:${normalizeForDuplicateCheck(name)}`;
}

export function filterImportedEstablishmentDuplicates(input: {
  rows: ImportDuplicateCandidate[];
  existingRows: ExistingEstablishmentDuplicate[];
}) {
  const existingKeys = new Set(
    input.existingRows.map((row) => buildDuplicateKey(row.routeId, row.name))
  );
  const seenKeys = new Set<string>();
  const rowsToImport: ImportDuplicateCandidate[] = [];
  const errors: string[] = [];

  for (const row of input.rows) {
    const duplicateKey = buildDuplicateKey(row.routeId, row.name);

    if (seenKeys.has(duplicateKey)) {
      errors.push(
        `Fila ${row.rowNumber}: establecimiento repetido en el archivo para la ruta "${row.routeName}".`
      );
      continue;
    }

    if (existingKeys.has(duplicateKey)) {
      errors.push(
        `Fila ${row.rowNumber}: el establecimiento "${row.name.trim()}" ya existe en la ruta "${row.routeName}".`
      );
      continue;
    }

    seenKeys.add(duplicateKey);
    rowsToImport.push(row);
  }

  return { rowsToImport, errors };
}

export function chunkItems<T>(items: T[], size: number) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Chunk size must be a positive integer.");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
