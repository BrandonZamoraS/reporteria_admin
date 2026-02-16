import { TaskForm } from "@/app/tareas/_components/task-form";
import { createTaskAction } from "@/app/tareas/actions";
import { requireRole } from "@/lib/auth/require-role";

export default async function NewTaskPage() {
  const { supabase } = await requireRole(["admin"]);
  const { data: users } = await supabase
    .from("user_profile")
    .select("user_id, name")
    .eq("role", "rutero")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Tareas</p>
        <h1 className="text-[20px] font-semibold text-foreground">Crear tarea</h1>
      </header>
      <TaskForm
        mode="create"
        users={users ?? []}
        selectedUserIds={[]}
        action={createTaskAction}
      />
    </div>
  );
}
