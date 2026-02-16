"use client";

import { useActionState } from "react";
import {
  toggleUserStatusAction,
  type ToggleUserStatusState,
} from "@/app/usuarios/actions";

type UserStatusButtonProps = {
  userId: number;
  isActive: boolean;
};

const INITIAL_STATE: ToggleUserStatusState = {
  error: null,
  success: false,
};

export function UserStatusButton({ userId, isActive }: UserStatusButtonProps) {
  const [state, formAction, isPending] = useActionState(
    toggleUserStatusAction,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="nextStatus" value={isActive ? "inactive" : "active"} />
      <button
        type="submit"
        disabled={isPending}
        className="text-[12px] font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "..." : isActive ? "Pausar" : "Activar"}
      </button>
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}
