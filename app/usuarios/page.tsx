import Link from "next/link";
import { UserDeleteButton } from "@/app/usuarios/_components/user-delete-button";
import { UserForm } from "@/app/usuarios/_components/user-form";
import { UserStatusButton } from "@/app/usuarios/_components/user-status-button";
import { createUserAction } from "@/app/usuarios/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

const PAGE_SIZE = 10;

function parsePage(page: string | undefined) {
  const parsed = Number(page ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function formatLastAccess(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function UsersListPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor"]);
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: users, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("user_profile")
      .select("user_id, auth_user_id, name, email, role, is_active, company:company_id(name)")
      .order("user_id", { ascending: false })
      .range(from, to),
    supabase.from("user_profile").select("user_id", { count: "exact", head: true }),
  ]);
  const companyOptions =
    role === "admin"
      ? (
          await supabase
            .from("company")
            .select("company_id, name, is_active")
            .order("name", { ascending: true })
        ).data ?? []
      : [];

  const userIds = (users ?? []).map((row) => row.user_id);
  const { data: sessionLogs } =
    userIds.length > 0
      ? await supabase
          .from("user_session_log")
          .select("user_id, login_at")
          .in("user_id", userIds)
          .order("login_at", { ascending: false })
      : { data: [] };

  const lastAccessByUserId = new Map<number, string>();
  (sessionLogs ?? []).forEach((row) => {
    if (!lastAccessByUserId.has(row.user_id)) {
      lastAccessByUserId.set(row.user_id, row.login_at);
    }
  });

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Operacion/Usuarios</p>
        <h1 className="text-[34px] font-semibold leading-none text-foreground">Usuarios</h1>
      </header>

      {role === "admin" ? (
        <>
          <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
            <p className="text-[24px] font-semibold leading-none text-foreground">Crear usuario</p>
            <div className="mt-3">
              <UserForm
                mode="create"
                action={createUserAction}
                showCancel={false}
                canManageRoleStatus
                companies={companyOptions}
              />
            </div>
          </section>
        </>
      ) : null}

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1fr_1.1fr_0.7fr_1fr_0.9fr_0.6fr_1fr] md:gap-3">
          <p>Nombre</p>
          <p>Correo</p>
          <p>Rol</p>
          <p>Empresa</p>
          <p>Ultimo acceso</p>
          <p>Estado</p>
          <p>Acciones</p>
        </div>

        {error || countError ? (
          <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
            No se pudieron cargar los usuarios.
          </p>
        ) : null}

        {!error && !countError && (!users || users.length === 0) ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">No hay usuarios para mostrar.</p>
        ) : null}

        {!error && !countError && users?.length
          ? users.map((item) => {
              const isCurrentSessionUser = item.auth_user_id === user.id;
              const companyData = item.company as
                | { name?: string }
                | Array<{ name?: string }>
                | null;
              const companyName = Array.isArray(companyData)
                ? companyData[0]?.name ?? "-"
                : companyData?.name ?? "-";
              return (
              <article
                key={item.user_id}
                className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1fr_1.1fr_0.7fr_1fr_0.9fr_0.6fr_1fr] md:items-center md:gap-3"
              >
                <div>
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                    Nombre
                  </p>
                  <p className="text-[13px] text-[var(--muted)]">{item.name}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                    Correo
                  </p>
                  <p className="text-[13px] text-[var(--muted)]">{item.email || "-"}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Rol</p>
                  <p className="text-[13px] text-[var(--muted)]">{item.role}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Empresa</p>
                  <p className="text-[13px] text-[var(--muted)]">{companyName}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                    Ultimo acceso
                  </p>
                  <p className="text-[13px] text-[var(--muted)]">
                    {formatLastAccess(lastAccessByUserId.get(item.user_id))}
                  </p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                    Estado
                  </p>
                  <p className="text-[13px] text-[var(--muted)]">
                    {item.is_active ? "Activo" : "Pausado"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1 text-[12px] md:mt-0">
                  {isCurrentSessionUser ? (
                    <span className="rounded-[8px] bg-[#E9EDE9] px-2 py-1 text-[12px] font-semibold text-[#405C62]">
                      Tu usuario
                    </span>
                  ) : (
                    <>
                      <Link
                        href={`/usuarios/${item.user_id}/editar`}
                        className="font-semibold text-[var(--muted)]"
                      >
                        Editar
                      </Link>
                      {role === "admin" ? (
                        <>
                          <span className="text-[var(--muted)]">-</span>
                          <UserStatusButton userId={item.user_id} isActive={item.is_active} />
                          <span className="text-[var(--muted)]">-</span>
                          <UserDeleteButton userId={item.user_id} userName={item.name} plain />
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
              );
            })
          : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--muted)]">
          Mostrando {totalCount === 0 ? 0 : from + 1}-{Math.min(totalCount, to + 1)} de{" "}
          {totalCount}
        </p>

        <div className="flex items-center gap-2">
          {canGoPrev ? (
            <Link
              href={`/usuarios?page=${currentPage - 1}`}
              className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
            >
              Anterior
            </Link>
          ) : (
            <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
              Anterior
            </span>
          )}

          <span className="text-[12px] font-semibold text-[var(--muted)]">
            Pagina {Math.min(currentPage, totalPages)} de {totalPages}
          </span>

          {canGoNext ? (
            <Link
              href={`/usuarios?page=${currentPage + 1}`}
              className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
            >
              Siguiente
            </Link>
          ) : (
            <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
              Siguiente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
