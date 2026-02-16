import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteDeleteButton } from "@/app/rutas/_components/route-delete-button";
import { RouteMap } from "@/app/rutas/_components/route-map";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ routeId: string }>;
};

export default async function RouteDetailPage({ params }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "rutero"]);
  const { routeId } = await params;
  const parsedRouteId = Number(routeId);
  const canManage = role === "admin" || role === "editor";

  if (!parsedRouteId || Number.isNaN(parsedRouteId)) {
    notFound();
  }

  const profile = await getCurrentUserProfile(user.id);
  const currentUserId = profile?.userId ?? null;

  let routeQuery = supabase
    .from("route")
    .select("route_id, nombre, visit_period, day, is_active, assigned_user, assignee:user_profile(name)")
    .eq("route_id", parsedRouteId);

  if (role === "rutero" && currentUserId) {
    routeQuery = routeQuery.eq("assigned_user", currentUserId);
  }

  const { data: route, error } = await routeQuery.maybeSingle();
  if (error || !route) {
    notFound();
  }

  const assigneeData = route.assignee as { name?: string } | Array<{ name?: string }> | null;
  const assigneeName = Array.isArray(assigneeData) ? assigneeData[0]?.name ?? "-" : assigneeData?.name ?? "-";

  const { data: establishments } = await supabase
    .from("establishment")
    .select("establishment_id, name, direction, lat, lng:long, is_active")
    .eq("route_id", route.route_id)
    .order("establishment_id", { ascending: true });

  const mapPoints = (establishments ?? []).map((establishment) => {
    const parsedLat =
      typeof establishment.lat === "number"
        ? establishment.lat
        : typeof establishment.lat === "string"
          ? Number(establishment.lat)
          : null;
    const parsedLng =
      typeof establishment.lng === "number"
        ? establishment.lng
        : typeof establishment.lng === "string"
          ? Number(establishment.lng)
          : null;

    return {
      establishmentId: establishment.establishment_id,
      name: establishment.name,
      lat: typeof parsedLat === "number" && Number.isFinite(parsedLat) ? parsedLat : null,
      lng: typeof parsedLng === "number" && Number.isFinite(parsedLng) ? parsedLng : null,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Operacion/Rutas</p>
            <h1 className="text-[34px] font-semibold leading-none text-foreground">{route.nombre}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/rutas"
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Volver
            </Link>
            {canManage ? (
              <>
              <Link
                href={`/rutas/${route.route_id}/editar`}
                className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
              >
                Editar
              </Link>
              {role === "admin" ? <RouteDeleteButton routeId={route.route_id} /> : null}
              </>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <p className="text-[16px] font-semibold text-foreground">Mapa de ruta</p>
        <div className="mt-3">
          <RouteMap points={mapPoints} />
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Responsable</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{assigneeName}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Dia</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{route.day || "-"}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Lapso de visita</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{route.visit_period || "-"}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Estado</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {route.is_active ? "Activa" : "Inactiva"}
            </p>
          </article>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1.1fr_1.5fr_0.7fr] md:gap-3">
          <p>Establecimiento</p>
          <p>Direccion</p>
          <p>Estado</p>
        </div>

        {!establishments || establishments.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">
            Esta ruta no tiene establecimientos asignados.
          </p>
        ) : (
          establishments.map((establishment) => (
            <article
              key={establishment.establishment_id}
              className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1.1fr_1.5fr_0.7fr] md:items-center md:gap-3"
            >
              <div>
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                  Establecimiento
                </p>
                <p className="text-[13px] text-[#5A7984]">{establishment.name}</p>
              </div>
              <div className="mt-2 md:mt-0">
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Direccion</p>
                <p className="text-[13px] text-[#5A7984]">{establishment.direction || "-"}</p>
              </div>
              <div className="mt-2 md:mt-0">
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Estado</p>
                <p className="text-[13px] text-[#5A7984]">
                  {establishment.is_active ? "Activo" : "Inactivo"}
                </p>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
