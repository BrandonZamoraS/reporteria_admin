"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type UserFiltersProps = {
  initialQuery: string;
  initialRole: "all" | "admin" | "editor" | "visitante" | "rutero";
};

export function UserFilters({ initialQuery, initialRole }: UserFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [role, setRole] = useState(initialRole);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  const paramsBase = useMemo(() => new URLSearchParams(), []);

  const navigateWithFilters = (nextQuery: string, nextRole: string) => {
    const params = new URLSearchParams(paramsBase);
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    if (nextRole !== "all") {
      params.set("role", nextRole);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      navigateWithFilters(query, role);
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="w-full max-w-[360px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Buscar usuario
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre del usuario"
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      <label className="w-full max-w-[220px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Rol
        </span>
        <select
          value={role}
          onChange={(event) =>
            setRole(
              event.target.value as "all" | "admin" | "editor" | "visitante" | "rutero"
            )
          }
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        >
          <option value="all">Todos</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="visitante">Visitante</option>
          <option value="rutero">Rutero</option>
        </select>
      </label>
    </div>
  );
}
