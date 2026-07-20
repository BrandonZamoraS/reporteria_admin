"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
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

// --- Product photo storage helpers ---

const PRODUCT_PHOTO_BUCKET = "product-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function createStorageAdminClient() {
  try {
    const { url } = getSupabaseEnv();
    return createClient(url, getSupabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

function extractStoragePathFromUrl(photoUrl: string): string | null {
  if (!photoUrl) return null;
  try {
    const url = new URL(photoUrl);
    const prefix = "/storage/v1/object/public/";
    const idx = url.pathname.indexOf(prefix);
    if (idx === -1) return null;
    const after = url.pathname.slice(idx + prefix.length);
    // after looks like: product-photos/products/{productId}/{uuid}.{ext}
    const slashIdx = after.indexOf("/");
    if (slashIdx === -1) return null;
    return after.slice(slashIdx + 1); // products/{productId}/{uuid}.{ext}
  } catch {
    return null;
  }
}

async function removeProductPhotoByUrl(photoUrl: string): Promise<boolean> {
  const path = extractStoragePathFromUrl(photoUrl);
  if (!path) return true; // nothing to delete
  const storage = createStorageAdminClient();
  if (!storage) return false;
  const { error } = await storage.storage.from(PRODUCT_PHOTO_BUCKET).remove([path]);
  return !error;
}

function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return "Solo se permiten imagenes JPG, PNG o WEBP.";
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return "La imagen no debe superar los 5MB.";
  }
  return null;
}

async function uploadProductPhoto(
  productId: number,
  file: File
): Promise<{ url: string } | { error: string }> {
  const validationError = validatePhotoFile(file);
  if (validationError) return { error: validationError };

  const ext = file.name.includes(".")
    ? (file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase()
    : "bin";
  const path = `products/${productId}/${crypto.randomUUID()}.${ext || "bin"}`;

  const storage = createStorageAdminClient();
  if (!storage) {
    return { error: "Configuración de almacenamiento no disponible. Contacta al administrador." };
  }

  const { error } = await storage.storage.from(PRODUCT_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { error: `No se pudo subir la foto del producto: ${error.message}` };
  }

  const { url: supabaseUrl } = getSupabaseEnv();
  const photoUrl = `${supabaseUrl}/storage/v1/object/public/${PRODUCT_PHOTO_BUCKET}/${path}`;
  return { url: photoUrl };
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
  const photoFile = formData.get("photo") as File | null;

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

  const { data: inserted, error } = await supabase
    .from("product")
    .insert({
      sku,
      name,
      company_id: companyId,
      is_active: isActive,
    })
    .select("product_id")
    .single();

  if (error || !inserted) {
    return { error: "No se pudo crear el producto. Verifica SKU/empresa e intenta nuevamente. (PROD-CRE-01)" };
  }

  const productId = inserted.product_id;

  if (photoFile && photoFile.size > 0) {
    const uploadResult = await uploadProductPhoto(productId, photoFile);
    if ("error" in uploadResult) {
      // Product was created, but photo failed. Return error so user can retry photo.
      return { error: uploadResult.error };
    }

    const { error: updateError } = await supabase
      .from("product")
      .update({ photo_url: uploadResult.url })
      .eq("product_id", productId);

    if (updateError) {
      return { error: "El producto se creo, pero no se pudo guardar la foto." };
    }
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
  const photoFile = formData.get("photo") as File | null;

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

  if (photoFile && photoFile.size > 0) {
    // Fetch current photo_url to clean up old photo
    const { data: currentProduct } = await supabase
      .from("product")
      .select("photo_url")
      .eq("product_id", productId)
      .maybeSingle();

    const uploadResult = await uploadProductPhoto(productId, photoFile);
    if ("error" in uploadResult) {
      return { error: uploadResult.error };
    }

    const { error: photoUpdateError } = await supabase
      .from("product")
      .update({ photo_url: uploadResult.url })
      .eq("product_id", productId);

    if (photoUpdateError) {
      return { error: "Los datos se actualizaron, pero no se pudo guardar la foto." };
    }

    // Clean up old photo if it existed
    if (currentProduct?.photo_url) {
      await removeProductPhotoByUrl(currentProduct.photo_url);
    }
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

  // Fetch photo_url before deleting so we can clean up storage
  const { data: product } = await supabase
    .from("product")
    .select("photo_url")
    .eq("product_id", productId)
    .maybeSingle();

  if (product?.photo_url) {
    await removeProductPhotoByUrl(product.photo_url);
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
