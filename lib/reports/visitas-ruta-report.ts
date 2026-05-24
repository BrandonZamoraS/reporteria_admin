export type CompletionStatus = "all" | "completed" | "incomplete";

export type VisitasRutaStore = {
  establishmentId: number;
  establishmentName: string;
  routeId: number;
  routeName: string;
};

export type VisitasRutaProduct = {
  establishmentId: number;
  productId: number;
  productName: string;
  productSku: string | null;
};

export type VisitasRutaRecord = {
  recordId: number;
  establishmentId: number;
  productId: number;
};

export type VisitasRutaStoreSummary = VisitasRutaStore & {
  status: "Completado" | "Incompleto";
  activeProducts: number;
  registeredProducts: number;
  missingProducts: VisitasRutaProduct[];
  recordCount: number;
  note: string | null;
};

export type VisitasRutaSummary = {
  totalStores: number;
  completedStores: number;
  incompleteStores: number;
  completionRate: number;
  stores: VisitasRutaStoreSummary[];
};

export type VisitasRutaReportData = {
  stores: VisitasRutaStore[];
  products: VisitasRutaProduct[];
  records: VisitasRutaRecord[];
  productId: number | null;
  completionStatus: CompletionStatus;
  from: string;
  to: string;
  companyLabel: string;
  productLabel: string;
};

export function parseCompletionStatus(value: string | null): CompletionStatus | null {
  if (!value) return "all";
  if (value === "all" || value === "completed" || value === "incomplete") return value;
  return null;
}

export function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getVisitasRutaValidationError(params: {
  from: string | null;
  to: string | null;
  completionStatus: string | null;
}): string | null {
  if (!params.from || !params.to) {
    return "El reporte de visitas por ruta requiere Desde y Hasta.";
  }
  if (!isIsoDate(params.from) || !isIsoDate(params.to) || params.from > params.to) {
    return "El rango de fechas de visitas por ruta es invalido.";
  }
  if (!parseCompletionStatus(params.completionStatus)) {
    return "El estado de completitud es invalido.";
  }
  return null;
}

export function buildVisitasRutaSummary(data: {
  stores: VisitasRutaStore[];
  products: VisitasRutaProduct[];
  records: VisitasRutaRecord[];
  productId: number | null;
  completionStatus: CompletionStatus;
}): VisitasRutaSummary {
  const productsByStore = new Map<number, VisitasRutaProduct[]>();
  for (const product of data.products) {
    if (data.productId != null && product.productId !== data.productId) continue;
    const products = productsByStore.get(product.establishmentId) ?? [];
    if (!products.some((existing) => existing.productId === product.productId)) {
      products.push(product);
      productsByStore.set(product.establishmentId, products);
    }
  }

  const recordCountByStore = new Map<number, number>();
  const registeredByStore = new Map<number, Set<number>>();
  for (const record of data.records) {
    if (data.productId != null && record.productId !== data.productId) continue;
    recordCountByStore.set(record.establishmentId, (recordCountByStore.get(record.establishmentId) ?? 0) + 1);
    const productIds = registeredByStore.get(record.establishmentId) ?? new Set<number>();
    productIds.add(record.productId);
    registeredByStore.set(record.establishmentId, productIds);
  }

  const scopedStores = data.productId == null
    ? data.stores
    : data.stores.filter((store) => (productsByStore.get(store.establishmentId)?.length ?? 0) > 0);

  const classified = scopedStores.map<VisitasRutaStoreSummary>((store) => {
    const products = productsByStore.get(store.establishmentId) ?? [];
    const registeredIds = registeredByStore.get(store.establishmentId) ?? new Set<number>();
    const registeredProducts = products.filter((product) => registeredIds.has(product.productId));
    const missingProducts = products.filter((product) => !registeredIds.has(product.productId));
    const completed = products.length > 0 && missingProducts.length === 0;

    return {
      ...store,
      status: completed ? "Completado" : "Incompleto",
      activeProducts: products.length,
      registeredProducts: registeredProducts.length,
      missingProducts,
      recordCount: recordCountByStore.get(store.establishmentId) ?? 0,
      note: products.length === 0 ? "Sin productos activos" : null,
    };
  });

  const stores = classified
    .filter((store) => {
      if (data.completionStatus === "completed") return store.status === "Completado";
      if (data.completionStatus === "incomplete") return store.status === "Incompleto";
      return true;
    })
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "Incompleto" ? -1 : 1;
      return left.establishmentName.localeCompare(right.establishmentName, "es");
    });
  const completedStores = stores.filter((store) => store.status === "Completado").length;

  return {
    totalStores: stores.length,
    completedStores,
    incompleteStores: stores.length - completedStores,
    completionRate: stores.length ? (completedStores / stores.length) * 100 : 0,
    stores,
  };
}
