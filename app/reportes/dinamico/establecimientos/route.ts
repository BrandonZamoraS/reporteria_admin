import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { parsePositiveInt } from "@/lib/reports/export-core";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = parsePositiveInt(searchParams.get("companyId"));

  if (!companyId) {
    return Response.json({ establishments: [] });
  }

  // Fetch active products for the selected company
  const { data: productRows, error: productError } = await supabase
    .from("product")
    .select("product_id")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (productError) {
    return Response.json(
      { error: `Error al cargar productos: ${productError.message}` },
      { status: 500 }
    );
  }

  const productIds = (productRows ?? [])
    .map((row) => row.product_id)
    .filter((v): v is number => typeof v === "number");

  if (productIds.length === 0) {
    return Response.json({ establishments: [] });
  }

  // Fetch establishment IDs linked to those products
  const { data: relationRows, error: relationError } = await supabase
    .from("products_establishment")
    .select("establishment_id")
    .in("product_id", productIds);

  if (relationError) {
    return Response.json(
      { error: `Error al cargar relaciones: ${relationError.message}` },
      { status: 500 }
    );
  }

  const establishmentIds = [
    ...new Set(
      (relationRows ?? [])
        .map((row) => row.establishment_id)
        .filter((v): v is number => typeof v === "number")
    ),
  ];

  if (establishmentIds.length === 0) {
    return Response.json({ establishments: [] });
  }

  // Fetch active establishment names
  const { data: establishmentRows, error: establishmentError } = await supabase
    .from("establishment")
    .select("establishment_id, name")
    .in("establishment_id", establishmentIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (establishmentError) {
    return Response.json(
      { error: `Error al cargar establecimientos: ${establishmentError.message}` },
      { status: 500 }
    );
  }

  const establishments = (establishmentRows ?? []).map((row) => ({
    id: row.establishment_id,
    name: row.name ?? `Establecimiento ${row.establishment_id}`,
  }));

  return Response.json({ establishments });
}
