"use client";

import { useState } from "react";

export type ProductEstablishmentOption = {
  establishment_id: number;
  name: string;
  route_name: string | null;
  is_active: boolean;
};

type ProductEstablishmentsPickerProps = {
  options: ProductEstablishmentOption[];
  selectedIds: number[];
  onSelectedIdsChange: (nextIds: number[]) => void;
};

function matchesSearch(option: ProductEstablishmentOption, query: string) {
  if (!query) return true;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [option.name, option.route_name ?? "", option.is_active ? "activo" : "inactivo"]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function ProductEstablishmentsPicker({
  options,
  selectedIds,
  onSelectedIdsChange,
}: ProductEstablishmentsPickerProps) {
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selectedIds);
  const filteredOptions = options.filter((option) => matchesSearch(option, query));

  const toggleOption = (establishmentId: number, checked: boolean) => {
    if (checked) {
      if (selectedSet.has(establishmentId)) return;
      onSelectedIdsChange([...selectedIds, establishmentId]);
      return;
    }

    onSelectedIdsChange(selectedIds.filter((value) => value !== establishmentId));
  };

  return (
    <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] bg-[#5A7A84] p-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[16px] font-semibold">Establecimientos</p>
            <p className="text-[12px] text-[#DDE2DD]">Asigna este producto a varios establecimientos.</p>
          </div>

          <p data-testid="product-establishments-count" className="text-[12px] font-semibold text-[#DDE2DD]">
            {selectedIds.length} seleccionados
          </p>
        </div>

        <label className="mt-3 block max-w-[360px]">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#DDE2DD]">Filtrar por nombre</span>
          <input
            data-testid="product-establishments-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del establecimiento"
            className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-foreground outline-none focus:border-foreground"
          />
        </label>
      </div>

      <div data-testid="product-establishments-picker" className="p-3">
        {options.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">No hay establecimientos disponibles para asignar.</p>
        ) : filteredOptions.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">No hay establecimientos que coincidan con el filtro.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filteredOptions.map((option) => (
              <label
                key={option.establishment_id}
                data-testid="product-establishments-option"
                data-establishment-id={option.establishment_id}
                data-establishment-name={option.name}
                className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-[var(--border)] px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.establishment_id)}
                  onChange={(event) => toggleOption(option.establishment_id, event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border border-[var(--border)]"
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[#5A7984]">{option.name}</span>
                  <span className="block text-[12px] text-[var(--muted)]">
                    {option.route_name ? `Ruta: ${option.route_name}` : "Sin ruta asignada"}
                    {option.is_active ? "" : " • Inactivo"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
