import { requireRole } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DynamicReportForm } from "./_components/dynamic-report-form";

export default async function DynamicReportPage() {
  const { supabase } = await requireRole(["admin"]);

  const { data: companies } = await supabase
    .from("company")
    .select("company_id, name")
    .order("name", { ascending: true });

  const companyOptions = (companies ?? []).map((c) => ({
    id: c.company_id as number,
    label: c.name as string,
  }));

  return <DynamicReportForm companies={companyOptions} />;
}
