"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteRecordAction,
  type DeleteRecordActionState,
} from "@/app/registros/actions";

const INITIAL_STATE: DeleteRecordActionState = { error: null, success: false };

export function RecordDeleteButton({ recordId }: { recordId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteRecordAction, INITIAL_STATE);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-[8px] border border-[#D6A7A7] bg-white px-4 py-2 text-[13px] font-semibold text-[#9B1C1C]"
      >
        Eliminar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[12px] border border-[var(--border)] bg-white p-4">
            <h3 className="text-[16px] font-semibold text-foreground">Eliminar registro</h3>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              Esta accion elimina el registro y sus evidencias. No se puede deshacer.
            </p>

            <form action={formAction} className="mt-3 space-y-3">
              <input type="hidden" name="recordId" value={recordId} />
              {state.error ? <p className="text-[13px] font-medium text-[#9B1C1C]">{state.error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-[8px] bg-[#9B1C1C] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Eliminando..." : "Confirmar eliminacion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
