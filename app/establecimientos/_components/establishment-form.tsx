"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { EstablishmentFormState } from "@/app/establecimientos/actions";

type EstablishmentRecord = {
  establishment_id: number;
  name: string;
  route_id: number | null;
  direction: string | null;
  lat: number | string | null;
  lng: number | string | null;
  is_active: boolean;
};

type RouteOption = {
  route_id: number;
  nombre: string;
  is_active: boolean;
};

type ProductOption = {
  product_id: number;
  sku: string;
  name: string;
  company_name: string | null;
  is_active: boolean;
};

type EstablishmentFormProps = {
  mode: "create" | "edit";
  establishment?: EstablishmentRecord;
  routeOptions: RouteOption[];
  productOptions: ProductOption[];
  initialSelectedProducts?: ProductOption[];
  action: (
    prevState: EstablishmentFormState,
    formData: FormData
  ) => Promise<EstablishmentFormState>;
};

const INITIAL_STATE: EstablishmentFormState = { error: null };

function toInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return String(parsed);
}

export function EstablishmentForm({
  mode,
  establishment,
  routeOptions,
  productOptions,
  initialSelectedProducts = [],
  action,
}: EstablishmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [searchValue, setSearchValue] = useState("");
  const [selectedProducts, setSelectedProducts] =
    useState<ProductOption[]>(initialSelectedProducts);

  const productPool = useMemo(() => {
    const byId = new Map<number, ProductOption>();

    productOptions.forEach((item) => {
      byId.set(item.product_id, item);
    });

    initialSelectedProducts.forEach((item) => {
      if (!byId.has(item.product_id)) {
        byId.set(item.product_id, item);
      }
    });

    return Array.from(byId.values());
  }, [initialSelectedProducts, productOptions]);

  const availableProducts = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map((item) => item.product_id));
    const query = searchValue.trim().toLowerCase();

    const filtered = productPool.filter((item) => !selectedIds.has(item.product_id));

    if (!query) {
      return filtered.slice(0, 8);
    }

    return filtered
      .filter((item) => {
        const sku = item.sku.toLowerCase();
        const name = item.name.toLowerCase();
        const company = (item.company_name ?? "").toLowerCase();
        return sku.includes(query) || name.includes(query) || company.includes(query);
      })
      .slice(0, 8);
  }, [productPool, searchValue, selectedProducts]);

  const shouldShowAvailableProducts = searchValue.trim().length > 0;

  const addProduct = (product: ProductOption) => {
    setSelectedProducts((prev) => {
      if (prev.some((item) => item.product_id === product.product_id)) {
        return prev;
      }

      return [...prev, product];
    });

    setSearchValue("");
  };

  const removeProduct = (productId: number) => {
    setSelectedProducts((prev) => prev.filter((item) => item.product_id !== productId));
  };

  return (
    <form action={formAction} className="space-y-3">
      {mode === "edit" ? (
        <input
          type="hidden"
          name="establishmentId"
          value={establishment?.establishment_id}
        />
      ) : null}

      {selectedProducts.map((product) => (
        <input
          key={product.product_id}
          type="hidden"
          name="productIds"
          value={product.product_id}
        />
      ))}

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre
            </span>
            <input
              name="name"
              defaultValue={establishment?.name ?? ""}
              placeholder="Nombre del establecimiento"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Ruta
            </span>
            <select
              name="routeId"
              defaultValue={establishment?.route_id ? String(establishment.route_id) : ""}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="">Sin ruta asignada</option>
              {routeOptions.map((route) => (
                <option key={route.route_id} value={route.route_id}>
                  {route.nombre}
                  {route.is_active ? "" : " (Inactiva)"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Direccion
            </span>
            <input
              name="direction"
              defaultValue={establishment?.direction ?? ""}
              placeholder="Direccion"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Latitud
              </span>
              <input
                name="lat"
                inputMode="decimal"
                defaultValue={toInputValue(establishment?.lat)}
                placeholder="19.4326"
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Longitud
              </span>
              <input
                name="lng"
                inputMode="decimal"
                defaultValue={toInputValue(establishment?.lng)}
                placeholder="-99.1332"
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Estado
              </span>
              <select
                name="status"
                defaultValue={establishment?.is_active === false ? "inactive" : "active"}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="bg-[#5A7A84] p-3">
          <p className="text-[16px] font-semibold text-white">Productos</p>

          <label className="mt-2 block max-w-[360px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
              Agregar producto
            </span>

            <div className="rounded-[8px] border border-[var(--border)] bg-white p-2">
              <div className="flex h-9 items-center gap-2 rounded-[8px] border border-[var(--border)] px-2">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-[#405C62]"
                >
                  <path
                    d="M11 4a7 7 0 105.29 11.59l3.56 3.56a1 1 0 001.41-1.41l-3.56-3.56A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z"
                    fill="currentColor"
                  />
                </svg>

                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="SKU o nombre"
                  className="h-full w-full bg-transparent text-[13px] text-[#5A7984] outline-none placeholder:text-[#8A9BA7]"
                />
              </div>
            </div>
          </label>

          {shouldShowAvailableProducts ? (
            <div className="mt-2 max-w-[560px] rounded-[8px] border border-[var(--border)] bg-white">
              {availableProducts.length > 0 ? (
                <div className="max-h-[180px] overflow-y-auto rounded-[8px]">
                  {availableProducts.map((product) => (
                    <button
                      key={product.product_id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[#F5F7F5]"
                    >
                      <span className="text-[13px] text-[#5A7984]">
                        {product.sku} - {product.name}
                      </span>
                      <span className="text-[11px] text-[var(--muted)]">Agregar</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-2 text-[12px] text-[#8A9BA7]">
                  Sin resultados disponibles
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="p-3">
          {selectedProducts.length === 0 ? (
            <p className="text-[12px] text-[var(--muted)]">
              No hay productos asociados al establecimiento.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {selectedProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[#5A7984]">
                      {product.sku} - {product.name}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {product.company_name ?? "Sin empresa"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeProduct(product.product_id)}
                    className="flex h-6 w-6 items-center justify-center text-[16px] leading-none text-[var(--muted)]"
                    aria-label={`Quitar ${product.name}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/establecimientos"
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

      {state.error ? (
        <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p>
      ) : null}
    </form>
  );
}
