"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProductFormState = {
  error: string | null;
};

export type DeleteProductState = {
  error: string | null;
  success: boolean;
};

type AuthorizedProductContext =
  | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; role: "admin" | "editor" }
  | { error: string };

function parseIsActive(value: FormDataEntryValue | null) {
  return String(value ?? "active") === "active";
}

function parseCompanyId(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseEstablishmentIds(formData: FormData) {
  const parsed = formData
    .getAll("establishmentIds")
    .map((value) => Number(String(value ?? "").trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(parsed));
}

async function getAuthorizedProductClient(): Promise<AuthorizedProductContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (!role || (role !== "admin" && role !== "editor")) {
    return { error: "No tienes permisos para administrar productos." };
  }

  return { supabase, role };
}

async function validateCompanyExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: number
) {
  const { data, error } = await supabase
    .from("company")
    .select("company_id")
    .eq("company_id", companyId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function validateEstablishmentsExist(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentIds: number[]
) {
  if (establishmentIds.length === 0) return true;

  const { data, error } = await supabase
    .from("establishment")
    .select("establishment_id")
    .in("establishment_id", establishmentIds);

  if (error || !data) return false;
  return data.length === establishmentIds.length;
}

async function syncProductEstablishments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  productId: number,
  establishmentIds: number[]
) {
  const { data: currentRows, error: currentError } = await supabase
    .from("products_establishment")
    .select("establishment_id")
    .eq("product_id", productId);

  if (currentError) {
    return { error: "No se pudieron consultar los establecimientos del producto. (PROD-EST-01)" };
  }

  const currentIds = new Set((currentRows ?? []).map((row) => row.establishment_id));
  const nextIds = new Set(establishmentIds);

  const toInsert = establishmentIds.filter((establishmentId) => !currentIds.has(establishmentId));
  const toDelete = Array.from(currentIds).filter((establishmentId) => !nextIds.has(establishmentId));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("products_establishment")
      .delete()
      .eq("product_id", productId)
      .in("establishment_id", toDelete);

    if (error) {
      return { error: "No se pudieron remover establecimientos del producto. (PROD-EST-02)" };
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products_establishment").insert(
      toInsert.map((establishmentId) => ({
        establishment_id: establishmentId,
        product_id: productId,
      }))
    );

    if (error) {
      return { error: "No se pudieron asignar establecimientos al producto. (PROD-EST-03)" };
    }
  }

  return { error: null as string | null };
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const companyId = parseCompanyId(formData.get("companyId"));
  const isActive = parseIsActive(formData.get("status"));

  if (!sku) {
    return { error: "El SKU es obligatorio." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (!companyId) {
    return { error: "Debes seleccionar una empresa." };
  }

  const context = await getAuthorizedProductClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;
  const companyExists = await validateCompanyExists(supabase, companyId);
  if (!companyExists) {
    return { error: "La empresa seleccionada no existe." };
  }

  const { error } = await supabase.from("product").insert({
    sku,
    name,
    company_id: companyId,
    is_active: isActive,
  });

  if (error) {
    return { error: "No se pudo crear el producto. Verifica SKU/empresa e intenta nuevamente. (PROD-CRE-01)" };
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productId = Number(formData.get("productId"));
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const companyId = parseCompanyId(formData.get("companyId"));
  const establishmentIds = parseEstablishmentIds(formData);
  const isActive = parseIsActive(formData.get("status"));

  if (!productId || Number.isNaN(productId)) {
    return { error: "Producto invalido." };
  }

  if (!sku) {
    return { error: "El SKU es obligatorio." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (!companyId) {
    return { error: "Debes seleccionar una empresa." };
  }

  const context = await getAuthorizedProductClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;
  const companyExists = await validateCompanyExists(supabase, companyId);
  if (!companyExists) {
    return { error: "La empresa seleccionada no existe." };
  }

  const establishmentsExist = await validateEstablishmentsExist(supabase, establishmentIds);
  if (!establishmentsExist) {
    return { error: "Alguno de los establecimientos seleccionados no existe." };
  }

  const { error } = await supabase
    .from("product")
    .update({
      sku,
      name,
      company_id: companyId,
      is_active: isActive,
    })
    .eq("product_id", productId);

  if (error) {
    return {
      error: "No se pudo actualizar el producto. Verifica SKU/empresa e intenta nuevamente. (PROD-UPD-01)",
    };
  }

  const syncResult = await syncProductEstablishments(supabase, productId, establishmentIds);
  if (syncResult.error) {
    return { error: syncResult.error };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}/editar`);
  redirect("/productos");
}

export async function deleteProductAction(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const productId = Number(formData.get("productId"));

  if (!productId || Number.isNaN(productId)) {
    return { error: "Producto invalido.", success: false };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Tu sesion ha expirado. Inicia sesion nuevamente.",
      success: false,
    };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (role !== "admin") {
    return { error: "Solo admin puede eliminar productos.", success: false };
  }

  const { error } = await supabase.from("product").delete().eq("product_id", productId);

  if (error) {
    return {
      error: "No se pudo eliminar el producto. Verifica dependencias relacionadas. (PROD-DEL-01)",
      success: false,
    };
  }

  revalidatePath("/productos");
  redirect("/productos");
}
