"use client";

import { useActionState } from "react";
import Image from "next/image";
import { loginAction, type LoginActionState } from "@/app/login/actions";

const INITIAL_STATE: LoginActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_STATE
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-[420px] rounded-[12px] border border-[var(--border)] bg-surface p-6">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="Instavista Logo"
            width={120}
            height={120}
            className="rounded-[12px]"
          />
          <h1 className="text-center text-[20px] font-semibold text-foreground">
            Instavista Admin
          </h1>
        </div>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              Correo
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@instavista.com"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              Contraseña
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 h-11 w-full rounded-[8px] bg-foreground text-[14px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {state.error ? (
          <p className="mt-4 text-center text-[13px] font-medium text-[#9B1C1C]">
            {state.error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
