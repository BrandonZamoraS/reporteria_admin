"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type TaskFiltersProps = {
  initialQuery: string;
  initialPriority: "all" | "baja" | "media" | "alta" | "crítica";
};

export function TaskFilters({ initialQuery, initialPriority }: TaskFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [priority, setPriority] = useState(initialPriority);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setPriority(initialPriority);
  }, [initialPriority]);

  const paramsBase = useMemo(() => new URLSearchParams(), []);

  const navigateWithFilters = (nextQuery: string, nextPriority: string) => {
    const params = new URLSearchParams(paramsBase);
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) params.set("q", normalizedQuery);
    if (nextPriority !== "all") params.set("priority", nextPriority);

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      navigateWithFilters(query, priority);
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, priority]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="w-full max-w-[360px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Buscar tarea
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titulo de la tarea"
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      <label className="w-full max-w-[220px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Prioridad
        </span>
        <select
          value={priority}
          onChange={(event) =>
            setPriority(
              event.target.value as "all" | "baja" | "media" | "alta" | "crítica"
            )
          }
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        >
          <option value="all">Todas</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="crítica">Critica</option>
        </select>
      </label>
    </div>
  );
}
