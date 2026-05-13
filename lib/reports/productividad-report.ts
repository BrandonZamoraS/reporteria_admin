import type { FlatRow } from "@/lib/reports/export-core";

export type ProductividadAssignedStore = {
  establishmentId: number;
  establishmentName: string;
  routeId: number;
  routeName: string;
  direction: string | null;
  zone: string | null;
  format: string | null;
};

export type ProductividadStoreProduct = {
  establishmentId: number;
  productId: number;
  productName: string;
  productSku: string | null;
};

export type ProductividadStoreRecord = Pick<
  FlatRow,
  | "recordId"
  | "systemInventory"
  | "realInventory"
  | "evidenceNum"
  | "comments"
  | "timeDate"
  | "productId"
  | "productSku"
  | "productName"
  | "establishmentId"
  | "establishmentName"
  | "routeId"
  | "userId"
  | "userName"
>;

export type ProductividadUserStoreSummary = ProductividadAssignedStore & {
  status: "Realizada" | "No realizada";
  activeProducts: number;
  registeredProducts: number;
  missingProducts: ProductividadStoreProduct[];
  records: ProductividadStoreRecord[];
  note: string | null;
};

export type ProductividadSummary = {
  userId: number;
  userName: string;
  assignedActiveStores: number;
  completedStores: number;
  incompleteStores: number;
  completionRate: number;
  expectedProducts: number;
  registeredProducts: number;
  totalRecords: number;
  stores: ProductividadUserStoreSummary[];
};

export type ProductividadReportData = {
  userId: number;
  userName: string;
  assignedStores: ProductividadAssignedStore[];
  storeProducts: ProductividadStoreProduct[];
  records: ProductividadStoreRecord[];
};

function productLabel(product: ProductividadStoreProduct) {
  return product.productSku ? `${product.productName} (${product.productSku})` : product.productName;
}

export function buildProductividadSummary(data: ProductividadReportData): ProductividadSummary {
  const productsByStore = new Map<number, ProductividadStoreProduct[]>();
  for (const product of data.storeProducts) {
    const bucket = productsByStore.get(product.establishmentId) ?? [];
    if (!bucket.some((item) => item.productId === product.productId)) {
      bucket.push(product);
    }
    productsByStore.set(product.establishmentId, bucket);
  }

  const recordsByStore = new Map<number, ProductividadStoreRecord[]>();
  for (const record of data.records) {
    if (record.establishmentId == null) continue;
    const bucket = recordsByStore.get(record.establishmentId) ?? [];
    bucket.push(record);
    recordsByStore.set(record.establishmentId, bucket);
  }

  const stores = data.assignedStores
    .map<ProductividadUserStoreSummary>((store) => {
      const activeProducts = productsByStore.get(store.establishmentId) ?? [];
      const records = (recordsByStore.get(store.establishmentId) ?? []).sort((left, right) =>
        right.timeDate.localeCompare(left.timeDate)
      );
      const registeredProductIds = new Set(
        records.map((record) => record.productId).filter((value): value is number => typeof value === "number")
      );
      const registeredProducts = activeProducts.filter((product) => registeredProductIds.has(product.productId));
      const missingProducts = activeProducts
        .filter((product) => !registeredProductIds.has(product.productId))
        .sort((left, right) => productLabel(left).localeCompare(productLabel(right), "es"));
      const isCompleted = activeProducts.length > 0 && missingProducts.length === 0;

      return {
        ...store,
        status: isCompleted ? "Realizada" : "No realizada",
        activeProducts: activeProducts.length,
        registeredProducts: registeredProducts.length,
        missingProducts,
        records,
        note: activeProducts.length === 0 ? "Sin productos activos" : null,
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "No realizada" ? -1 : 1;
      return left.establishmentName.localeCompare(right.establishmentName, "es");
    });

  const completedStores = stores.filter((store) => store.status === "Realizada").length;
  const expectedProducts = stores.reduce((sum, store) => sum + store.activeProducts, 0);
  const registeredProducts = stores.reduce((sum, store) => sum + store.registeredProducts, 0);

  return {
    userId: data.userId,
    userName: data.userName,
    assignedActiveStores: stores.length,
    completedStores,
    incompleteStores: stores.length - completedStores,
    completionRate: stores.length > 0 ? (completedStores / stores.length) * 100 : 0,
    expectedProducts,
    registeredProducts,
    totalRecords: data.records.length,
    stores,
  };
}

export function formatProductividadCompletion(
  summary: Pick<ProductividadSummary, "completionRate" | "completedStores" | "assignedActiveStores">
) {
  return `${summary.completionRate.toFixed(1)}% (${summary.completedStores}/${summary.assignedActiveStores})`;
}
