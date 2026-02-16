"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EstablishmentFormState = {
  error: string | null;
};

export type DeleteEstablishmentState = {
  error: string | null;
  success: boolean;
};

type AuthorizedEstablishmentContext =
  | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; role: "admin" | "editor" }
  | { error: string };

function parseIsActive(value: FormDataEntryValue | null) {
  return String(value ?? "active") === "active";
}

function parseRouteId(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalCoordinate(
  value: FormDataEntryValue | null,
  min: number,
  max: number
) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: null as number | null, error: null as string | null };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return { value: null as number | null, error: "Las coordenadas deben ser numericas." };
  }

  if (parsed < min || parsed > max) {
    return {
      value: null as number | null,
      error: `Las coordenadas deben estar entre ${min} y ${max}.`,
    };
  }

  return { value: parsed, error: null as string | null };
}

function parseProductIds(formData: FormData) {
  const parsed = formData
    .getAll("productIds")
    .map((value) => Number(String(value ?? "").trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(parsed));
}

async function getAuthorizedEstablishmentClient(): Promise<AuthorizedEstablishmentContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (!role || (role !== "admin" && role !== "editor")) {
    return { error: "No tienes permisos para administrar establecimientos." };
  }

  return { supabase, role };
}

async function validateRouteExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  routeId: number | null
) {
  if (!routeId) return true;

  const { data, error } = await supabase
    .from("route")
    .select("route_id")
    .eq("route_id", routeId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function validateProductsExist(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  productIds: number[]
) {
  if (productIds.length === 0) return true;

  const { data, error } = await supabase
    .from("product")
    .select("product_id")
    .in("product_id", productIds);

  if (error || !data) return false;
  return data.length === productIds.length;
}

async function syncEstablishmentProducts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: number,
  productIds: number[]
) {
  const { data: currentRows, error: currentError } = await supabase
    .from("products_establishment")
    .select("product_id")
    .eq("establishment_id", establishmentId);

  if (currentError) {
    return { error: "No se pudieron consultar los productos del establecimiento." };
  }

  const currentIds = new Set((currentRows ?? []).map((row) => row.product_id));
  const nextIds = new Set(productIds);

  const toInsert = productIds.filter((productId) => !currentIds.has(productId));
  const toDelete = Array.from(currentIds).filter((productId) => !nextIds.has(productId));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("products_establishment")
      .delete()
      .eq("establishment_id", establishmentId)
      .in("product_id", toDelete);

    if (error) {
      return { error: "No se pudieron remover productos del establecimiento." };
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products_establishment").insert(
      toInsert.map((productId) => ({
        establishment_id: establishmentId,
        product_id: productId,
      }))
    );

    if (error) {
      return { error: "No se pudieron asignar productos al establecimiento." };
    }
  }

  return { error: null as string | null };
}

export async function createEstablishmentAction(
  _prevState: EstablishmentFormState,
  formData: FormData
): Promise<EstablishmentFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const routeId = parseRouteId(formData.get("routeId"));
  const direction = String(formData.get("direction") ?? "").trim();
  const latResult = parseOptionalCoordinate(formData.get("lat"), -90, 90);
  const lngResult = parseOptionalCoordinate(formData.get("lng"), -180, 180);
  const isActive = parseIsActive(formData.get("status"));
  const productIds = parseProductIds(formData);

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (latResult.error || lngResult.error) {
    return { error: latResult.error ?? lngResult.error };
  }

  const context = await getAuthorizedEstablishmentClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;

  const routeExists = await validateRouteExists(supabase, routeId);
  if (!routeExists) {
    return { error: "La ruta seleccionada no existe." };
  }

  const productsExist = await validateProductsExist(supabase, productIds);
  if (!productsExist) {
    return { error: "Uno o mas productos seleccionados no existen." };
  }

  const { data: created, error } = await supabase
    .from("establishment")
    .insert({
      name,
      route_id: routeId,
      direction: direction || null,
      lat: latResult.value,
      long: lngResult.value,
      is_active: isActive,
    })
    .select("establishment_id")
    .single();

  if (error || !created) {
    return { error: "No se pudo crear el establecimiento. Intenta nuevamente." };
  }

  const syncResult = await syncEstablishmentProducts(supabase, created.establishment_id, productIds);
  if (syncResult.error) {
    return { error: syncResult.error };
  }

  revalidatePath("/establecimientos");
  revalidatePath(`/establecimientos/${created.establishment_id}`);
  redirect("/establecimientos");
}

export async function updateEstablishmentAction(
  _prevState: EstablishmentFormState,
  formData: FormData
): Promise<EstablishmentFormState> {
  const establishmentId = Number(formData.get("establishmentId"));
  const name = String(formData.get("name") ?? "").trim();
  const routeId = parseRouteId(formData.get("routeId"));
  const direction = String(formData.get("direction") ?? "").trim();
  const latResult = parseOptionalCoordinate(formData.get("lat"), -90, 90);
  const lngResult = parseOptionalCoordinate(formData.get("lng"), -180, 180);
  const isActive = parseIsActive(formData.get("status"));
  const productIds = parseProductIds(formData);

  if (!establishmentId || Number.isNaN(establishmentId)) {
    return { error: "Establecimiento invalido." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (latResult.error || lngResult.error) {
    return { error: latResult.error ?? lngResult.error };
  }

  const context = await getAuthorizedEstablishmentClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;

  const routeExists = await validateRouteExists(supabase, routeId);
  if (!routeExists) {
    return { error: "La ruta seleccionada no existe." };
  }

  const productsExist = await validateProductsExist(supabase, productIds);
  if (!productsExist) {
    return { error: "Uno o mas productos seleccionados no existen." };
  }

  const { error } = await supabase
    .from("establishment")
    .update({
      name,
      route_id: routeId,
      direction: direction || null,
      lat: latResult.value,
      long: lngResult.value,
      is_active: isActive,
    })
    .eq("establishment_id", establishmentId);

  if (error) {
    return { error: "No se pudo actualizar el establecimiento. Intenta nuevamente." };
  }

  const syncResult = await syncEstablishmentProducts(supabase, establishmentId, productIds);
  if (syncResult.error) {
    return { error: syncResult.error };
  }

  revalidatePath("/establecimientos");
  revalidatePath(`/establecimientos/${establishmentId}`);
  redirect("/establecimientos");
}

export async function deleteEstablishmentAction(
  _prevState: DeleteEstablishmentState,
  formData: FormData
): Promise<DeleteEstablishmentState> {
  const establishmentId = Number(formData.get("establishmentId"));

  if (!establishmentId || Number.isNaN(establishmentId)) {
    return { error: "Establecimiento invalido.", success: false };
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
    return { error: "Solo admin puede eliminar establecimientos.", success: false };
  }

  const { error: linkError } = await supabase
    .from("products_establishment")
    .delete()
    .eq("establishment_id", establishmentId);

  if (linkError) {
    return {
      error: "No se pudieron remover relaciones de productos del establecimiento.",
      success: false,
    };
  }

  const { error } = await supabase
    .from("establishment")
    .delete()
    .eq("establishment_id", establishmentId);

  if (error) {
    return {
      error:
        "No se pudo eliminar el establecimiento. Verifica si tiene registros relacionados.",
      success: false,
    };
  }

  revalidatePath("/establecimientos");
  redirect("/establecimientos");
}
