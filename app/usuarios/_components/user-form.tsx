"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useState } from "react";
import type { UserFormState } from "@/app/usuarios/actions";
import { APP_ROLES } from "@/lib/auth/roles";

type UserProfile = {
  user_id: number;
  name: string;
  role: "admin" | "editor" | "visitante" | "rutero";
  email: string | null;
  is_active: boolean;
  company_id?: number | null;
};

type CompanyOption = {
  company_id: number;
  name: string;
  is_active: boolean;
};

type UserFormProps = {
  mode: "create" | "edit";
  userProfile?: UserProfile;
  companies?: CompanyOption[];
  showCancel?: boolean;
  canManageRoleStatus?: boolean;
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
};

const INITIAL_STATE: UserFormState = { error: null };

export function UserForm({
  mode,
  userProfile,
  companies = [],
  showCancel = true,
  canManageRoleStatus = true,
  action,
}: UserFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedRole, setSelectedRole] = useState<UserProfile["role"]>(
    userProfile?.role ?? "visitante"
  );
  const shouldShowCompanyField = selectedRole === "visitante";

  return (
    <form
      action={formAction}
      className="rounded-[12px] border border-[var(--border)] bg-white p-4"
    >
      {mode === "edit" ? (
        <input type="hidden" name="userId" value={userProfile?.user_id} />
      ) : null}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Correo
            </span>
            <input
              name="email"
              type="email"
              defaultValue={userProfile?.email ?? ""}
              placeholder="usuario@correo.com"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          {mode === "create" ? (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Contrasena
              </span>
              <input
                name="password"
                type="password"
                placeholder="********"
                required
                minLength={8}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_250px]">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre
            </span>
            <input
              name="name"
              defaultValue={userProfile?.name ?? ""}
              placeholder="Nombre completo"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Rol
            </span>
            {canManageRoleStatus ? (
              <select
                name="role"
                defaultValue={userProfile?.role ?? "visitante"}
                onChange={(event) =>
                  setSelectedRole(event.target.value as UserProfile["role"])
                }
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              >
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="role" value={userProfile?.role ?? "visitante"} />
                <div className="flex h-10 items-center rounded-[8px] border border-[var(--border)] bg-[#F8FAF8] px-3 text-[13px] text-[var(--muted)]">
                  {userProfile?.role ?? "visitante"}
                </div>
              </>
            )}
          </label>
        </div>

        {shouldShowCompanyField ? (
          <label className="block max-w-[420px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Empresa
            </span>
            <select
              name="companyId"
              defaultValue={userProfile?.company_id ? String(userProfile.company_id) : ""}
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="">Seleccionar empresa</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>
                  {company.name}
                  {company.is_active ? "" : " (Inactiva)"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="companyId" value="" />
        )}

        <label className="block max-w-[260px]">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Estado
          </span>
          {canManageRoleStatus ? (
            <select
              name="status"
              defaultValue={userProfile?.is_active === false ? "inactive" : "active"}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="active">Activo</option>
              <option value="inactive">Pausado</option>
            </select>
          ) : (
            <>
              <input
                type="hidden"
                name="status"
                value={userProfile?.is_active === false ? "inactive" : "active"}
              />
              <div className="flex h-10 items-center rounded-[8px] border border-[var(--border)] bg-[#F8FAF8] px-3 text-[13px] text-[var(--muted)]">
                {userProfile?.is_active === false ? "Pausado" : "Activo"}
              </div>
            </>
          )}
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {showCancel ? (
          <Link
            href="/usuarios"
            className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            Cancelar
          </Link>
        ) : null}
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
