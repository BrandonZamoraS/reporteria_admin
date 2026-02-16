"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { RouteFormState } from "@/app/rutas/actions";

type RouteRecord = {
  route_id: number;
  nombre: string;
  visit_period: string | null;
  day: string | null;
  assigned_user: number | null;
  is_active: boolean;
};

type RuteroOption = {
  user_id: number;
  name: string;
};

type EstablishmentOption = {
  establishment_id: number;
  name: string;
  direction: string | null;
};

type RouteFormProps = {
  mode: "create" | "edit";
  route?: RouteRecord;
  dayOptions: string[];
  ruteroOptions: RuteroOption[];
  availableEstablishments: EstablishmentOption[];
  initialAssignedEstablishments?: EstablishmentOption[];
  action: (
    prevState: RouteFormState,
    formData: FormData,
  ) => Promise<RouteFormState>;
};

const INITIAL_STATE: RouteFormState = { error: null };

export function RouteForm({
  mode,
  route,
  dayOptions,
  ruteroOptions,
  availableEstablishments,
  initialAssignedEstablishments = [],
  action,
}: RouteFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [searchValue, setSearchValue] = useState("");
  const [selectedEstablishments, setSelectedEstablishments] = useState<
    EstablishmentOption[]
  >(initialAssignedEstablishments);

  const establishmentPool = useMemo(() => {
    const byId = new Map<number, EstablishmentOption>();

    availableEstablishments.forEach((item) => {
      byId.set(item.establishment_id, item);
    });

    initialAssignedEstablishments.forEach((item) => {
      if (!byId.has(item.establishment_id)) {
        byId.set(item.establishment_id, item);
      }
    });

    return Array.from(byId.values());
  }, [availableEstablishments, initialAssignedEstablishments]);

  const availableToAdd = useMemo(() => {
    const selectedIds = new Set(
      selectedEstablishments.map((item) => item.establishment_id),
    );

    const filtered = establishmentPool.filter(
      (item) => !selectedIds.has(item.establishment_id),
    );

    const query = searchValue.trim().toLowerCase();
    if (!query) return filtered.slice(0, 8);

    return filtered
      .filter((item) => {
        const name = item.name.toLowerCase();
        const direction = (item.direction ?? "").toLowerCase();
        return name.includes(query) || direction.includes(query);
      })
      .slice(0, 8);
  }, [establishmentPool, searchValue, selectedEstablishments]);
  const shouldShowAvailableList = searchValue.trim().length > 0;

  const addEstablishment = (establishment: EstablishmentOption) => {
    setSelectedEstablishments((prev) => {
      if (
        prev.some(
          (item) => item.establishment_id === establishment.establishment_id,
        )
      ) {
        return prev;
      }

      return [...prev, establishment];
    });

    setSearchValue("");
  };

  const removeEstablishment = (establishmentId: number) => {
    setSelectedEstablishments((prev) =>
      prev.filter((item) => item.establishment_id !== establishmentId),
    );
  };

  return (
    <form action={formAction} className="space-y-3">
      {mode === "edit" ? (
        <input type="hidden" name="routeId" value={route?.route_id} />
      ) : null}

      {selectedEstablishments.map((establishment) => (
        <input
          key={establishment.establishment_id}
          type="hidden"
          name="establishmentIds"
          value={establishment.establishment_id}
        />
      ))}

      <input
        type="hidden"
        name="status"
        value={route?.is_active === false ? "inactive" : "active"}
      />

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.55fr_0.9fr_1fr]">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre de ruta
            </span>
            <input
              name="nombre"
              defaultValue={route?.nombre ?? ""}
              placeholder="Ruta Norte"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Lapso de visita
            </span>
            <input
              name="visitPeriod"
              defaultValue={route?.visit_period ?? ""}
              placeholder="7"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Dia de ruta
            </span>
            <select
              name="day"
              defaultValue={route?.day ?? ""}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="">Sin dia asignado</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[14px] font-semibold text-foreground">
            Asignar usuario
          </p>

          <label className="block max-w-[360px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Usuario asignado
            </span>
            <select
              name="assignedUserId"
              defaultValue={
                route?.assigned_user ? String(route.assigned_user) : ""
              }
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="">Sin asignar</option>
              {ruteroOptions.map((rutero) => (
                <option key={rutero.user_id} value={rutero.user_id}>
                  {rutero.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="bg-[#5A7A84] p-3">
          <p className="text-[16px] font-semibold text-white">Establecimientos</p>

          <label className="mt-2 block max-w-[360px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
              Agregar establecimiento
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
                  placeholder="Buscar por nombre"
                  className="h-full w-full bg-transparent text-[13px] text-[#5A7984] outline-none placeholder:text-[#8A9BA7]"
                />
              </div>
            </div>
          </label>

          {shouldShowAvailableList ? (
            <div className="mt-2 max-w-[360px] rounded-[8px] border border-[var(--border)] bg-white">
              {availableToAdd.length > 0 ? (
                <div className="max-h-[180px] overflow-y-auto rounded-[8px]">
                  {availableToAdd.map((establishment) => (
                    <button
                      key={establishment.establishment_id}
                      type="button"
                      onClick={() => addEstablishment(establishment)}
                      className="flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[#F5F7F5]"
                    >
                      <span className="text-[13px] text-[#5A7984]">
                        {establishment.name}
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
          {selectedEstablishments.length === 0 ? (
            <p className="text-[12px] text-[var(--muted)]">
              No hay establecimientos agregados a la ruta.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {selectedEstablishments.map((establishment, index) => (
                <div
                  key={establishment.establishment_id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-4 text-[13px] text-[#5A7984]">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-[#5A7984]">
                        {establishment.name}
                      </p>
                      <p className="truncate text-[12px] text-[var(--muted)]">
                        {establishment.direction || "-"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeEstablishment(establishment.establishment_id)
                    }
                    className="flex h-6 w-6 items-center justify-center text-[16px] leading-none text-[var(--muted)]"
                    aria-label={`Quitar ${establishment.name}`}
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
          href="/rutas"
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
        <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
