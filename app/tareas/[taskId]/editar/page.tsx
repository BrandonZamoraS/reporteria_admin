import { notFound } from "next/navigation";
import { TaskForm } from "@/app/tareas/_components/task-form";
import { updateTaskAction } from "@/app/tareas/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function EditTaskPage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin", "editor"]);
  const { taskId } = await params;
  const parsedTaskId = Number(taskId);

  if (!parsedTaskId || Number.isNaN(parsedTaskId)) {
    notFound();
  }

  const { data: task, error } = await supabase
    .from("task")
    .select("task_id, title, description, priority, due_to")
    .eq("task_id", parsedTaskId)
    .maybeSingle();

  if (error || !task) {
    notFound();
  }

  const [{ data: users }, { data: assignedRows }] = await Promise.all([
    supabase
      .from("user_profile")
      .select("user_id, name")
      .eq("role", "rutero")
      .order("name", { ascending: true }),
    supabase.from("user_tasks").select("user_id").eq("task_id", parsedTaskId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Tareas</p>
        <h1 className="text-[20px] font-semibold text-foreground">Editar tarea</h1>
      </header>
      <TaskForm
        mode="edit"
        task={task}
        users={users ?? []}
        selectedUserIds={(assignedRows ?? []).map((row) => row.user_id)}
        action={updateTaskAction}
      />
    </div>
  );
}
