"use client";

import { useActionState } from "react";
import { updateMyProfileAction, type MyProfileFormState } from "@/app/usuarios/actions";

type MyProfileFormProps = {
  name: string;
  role: "admin" | "editor" | "visitante" | "rutero";
  companyName: string | null;
};

const INITIAL_STATE: MyProfileFormState = {
  error: null,
  success: null,
};

export function MyProfileForm({ name, role, companyName }: MyProfileFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateMyProfileAction,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <p className="text-[24px] font-semibold leading-none text-foreground">Mi perfil</p>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Nombre</span>
        <input
          name="name"
          defaultValue={name}
          placeholder="Nombre completo"
          required
          className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      {role === "visitante" ? (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Empresa</span>
          <div className="flex h-10 w-full items-center rounded-[8px] border border-[var(--border)] bg-[#F8FAF8] px-3 text-[13px] text-[var(--muted)]">
            {companyName ?? "Sin empresa asignada"}
          </div>
        </label>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Contrasena actual
          </span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Nueva contrasena
          </span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="********"
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Confirmar contrasena
          </span>
          <input
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            placeholder="********"
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="reset"
          className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
        >
          Cancelar
        </button>
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
      {state.success ? (
        <p className="mt-3 text-[13px] font-medium text-[#1F6B45]">{state.success}</p>
      ) : null}
    </form>
  );
}
