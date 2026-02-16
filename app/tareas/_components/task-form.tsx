"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { TaskFormState } from "@/app/tareas/actions";

type Task = {
  task_id: number;
  title: string;
  description: string | null;
  priority: "baja" | "media" | "alta" | "crítica";
  due_to: string | null;
};

type AssignableUser = {
  user_id: number;
  name: string;
};

type TaskFormProps = {
  mode: "create" | "edit";
  task?: Task;
  users: AssignableUser[];
  selectedUserIds: number[];
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
};

const INITIAL_STATE: TaskFormState = { error: null };

function toInputDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function TaskForm({
  mode,
  task,
  users,
  selectedUserIds,
  action,
}: TaskFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [userSearch, setUserSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(selectedUserIds);
  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    if (!search) return users;
    return users.filter((user) => user.name.toLowerCase().includes(search));
  }, [userSearch, users]);

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user.user_id)),
    [selectedIds, users]
  );

  return (
    <form action={formAction} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      {mode === "edit" ? <input type="hidden" name="taskId" value={task?.task_id} /> : null}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Titulo
          </span>
          <input
            name="title"
            defaultValue={task?.title ?? ""}
            placeholder="Titulo de la tarea"
            required
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Descripcion
          </span>
          <textarea
            name="description"
            defaultValue={task?.description ?? ""}
            placeholder="Detalles de la tarea"
            rows={3}
            className="w-full resize-y rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] outline-none focus:border-foreground"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Prioridad
            </span>
            <select
              name="priority"
              defaultValue={task?.priority ?? "media"}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="crítica">Critica</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Fecha limite
            </span>
            <input
              name="due_to"
              type="date"
              defaultValue={toInputDate(task?.due_to)}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>

        <div className="rounded-[12px] border border-[var(--border)] bg-white">
          <div className="rounded-t-[12px] bg-[#5A7A84] p-3">
            <p className="text-[16px] font-semibold text-white">Asignar usuarios</p>

            <label className="mt-1 block max-w-[360px]">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
                Usuarios
              </span>
              <div className="flex h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3">
                <span className="text-[14px] text-[#405C62]">⌕</span>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Seleccionar usuarios"
                  className="w-full bg-transparent text-[13px] text-[var(--muted)] outline-none placeholder:text-[#8A9BA7]"
                />
              </div>
            </label>
          </div>

          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="assigned_user_ids" value={id} />
          ))}

          <div className="px-3">
            {users.length === 0 ? (
              <p className="py-3 text-[13px] text-[var(--muted)]">No hay ruteros disponibles.</p>
            ) : null}

            {users.length > 0 && filteredUsers.length === 0 ? (
              <p className="py-3 text-[13px] text-[var(--muted)]">
                No hay usuarios que coincidan con la busqueda.
              </p>
            ) : null}

            {filteredUsers.map((user, index) => {
              const isSelected = selectedIds.includes(user.user_id);
              const isLast = index === filteredUsers.length - 1;

              return (
                <div
                  key={user.user_id}
                  className={`flex h-10 items-center justify-between ${
                    isLast ? "" : "border-b border-[var(--border)]"
                  }`}
                >
                  <p className="text-[13px] text-[var(--muted)]">{user.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== user.user_id)
                          : [...prev, user.user_id]
                      );
                    }}
                    className="text-[12px] font-semibold text-[var(--muted)]"
                  >
                    {isSelected ? "Quitar" : "Agregar"}
                  </button>
                </div>
              );
            })}
          </div>

          {selectedUsers.length > 0 ? (
            <div className="border-t border-[var(--border)] bg-[#F8FAF8] px-3 py-2">
              <p className="text-[12px] font-semibold text-[var(--muted)]">
                Seleccionados: {selectedUsers.map((user) => user.name).join(", ")}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/tareas"
          className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
        >
          Cancelar
        </Link>
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
