import Link from "next/link";

type RouteTabsProps = {
  active: "list" | "detail" | "form";
  canManage: boolean;
  routeId?: number | null;
};

function tabClass(isActive: boolean) {
  return [
    "rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition-colors",
    isActive
      ? "border-transparent bg-[#5A7A84] text-white"
      : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[#F6F7F6]",
  ].join(" ");
}

export function RouteTabs({ active, canManage, routeId }: RouteTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/rutas" className={tabClass(active === "list")}>
        Listado
      </Link>

      {routeId ? (
        <Link href={`/rutas/${routeId}`} className={tabClass(active === "detail")}>
          Detalle
        </Link>
      ) : (
        <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
          Detalle
        </span>
      )}

      {canManage ? (
        routeId ? (
          <Link href={`/rutas/${routeId}/editar`} className={tabClass(active === "form")}>
            Crear/Editar
          </Link>
        ) : (
          <Link href="/rutas/nueva" className={tabClass(active === "form")}>
            Crear/Editar
          </Link>
        )
      ) : null}
    </div>
  );
}
