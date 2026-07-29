"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";
import type { ProductFormState } from "@/app/productos/actions";
import {
  ProductEstablishmentsPicker,
  type ProductEstablishmentOption,
} from "@/app/productos/_components/product-establishments-picker";

type Product = {
  product_id: number;
  sku: string;
  name: string;
  company_id: number;
  is_active: boolean;
  photo_url?: string | null;
};

type CompanyOption = {
  company_id: number;
  name: string;
  is_active: boolean;
};

type ProductFormProps = {
  mode: "create" | "edit";
  product?: Product;
  companies: CompanyOption[];
  establishmentOptions?: ProductEstablishmentOption[];
  initialSelectedEstablishmentIds?: number[];
  action: (
    prevState: ProductFormState,
    formData: FormData
  ) => Promise<ProductFormState>;
};

const INITIAL_STATE: ProductFormState = { error: null };
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB (original)
const MAX_COMPRESSED_SIZE = 800 * 1024; // 800KB (target after compression)
const MAX_DIMENSION = 1200; // Max width/height in pixels
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error("No se pudo crear el contexto del canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo comprimir la imagen"));
            return;
          }

          // Create compressed file
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        0.8 // 80% quality
      );
    };

    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = URL.createObjectURL(file);
  });
}

export function ProductForm({
  mode,
  product,
  companies,
  establishmentOptions = [],
  initialSelectedEstablishmentIds = [],
  action,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedEstablishmentIds, setSelectedEstablishmentIds] = useState(
    initialSelectedEstablishmentIds
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (state.error) toast.error(state.error); }, [state]);
  
  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    setCompressedPhoto(null);
    const file = e.target.files?.[0];
    if (!file) {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Solo se permiten imagenes JPG, PNG o WEBP.");
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError(`La imagen supera los 5MB (${formatFileSize(file.size)}).`);
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      // Compress the image
      const compressed = await compressImage(file);
      setCompressedPhoto(compressed);
      
      // Revoke previous blob URL before creating new one
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      const url = URL.createObjectURL(compressed);
      setPhotoPreview(url);
      
      console.log(`[ProductForm] Compressed ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`);
    } catch (err) {
      console.error("[ProductForm] Compression failed:", err);
      setPhotoError("No se pudo procesar la imagen. Intenta con otra.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form action={formAction} onSubmit={async (e) => {
      // If we have a compressed photo, we need to intercept and replace the file
      if (compressedPhoto) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("photo", compressedPhoto);
        
        // Call the action - Next.js will handle the redirect
        formAction(formData);
        return;
      }
      // Otherwise, let the form submit normally
    }} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      {mode === "edit" ? <input type="hidden" name="productId" value={product?.product_id} /> : null}
      {mode === "edit"
        ? selectedEstablishmentIds.map((establishmentId) => (
            <input
              key={establishmentId}
              type="hidden"
              name="establishmentIds"
              value={establishmentId}
            />
          ))
        : null}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">SKU</span>
            <input
              name="sku"
              defaultValue={product?.sku ?? ""}
              placeholder="SKU-001"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre
            </span>
            <input
              name="name"
              defaultValue={product?.name ?? ""}
              placeholder="Nombre del producto"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Empresa
            </span>
            <AdaptiveSelect
              name="companyId"
              defaultValue={product?.company_id ? String(product.company_id) : ""}
              required
              emptyOptionLabel="Seleccionar empresa"
              placeholder="Buscar empresa"
              options={companies.map((company) => ({
                value: String(company.company_id),
                label: `${company.name}${company.is_active ? "" : " (Inactiva)"}`,
              }))}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block max-w-[260px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Estado
            </span>
            <select
              name="status"
              defaultValue={product?.is_active === false ? "inactive" : "active"}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
        </div>

        {/* Photo upload section */}
        <div className="rounded-[8px] border border-[var(--border)] p-3">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Foto del producto
          </span>

          <div className="flex flex-wrap items-start gap-3">
            {/* Current photo or new preview */}
            {(mode === "edit" && product?.photo_url && !photoPreview) ? (
              <div
                data-testid="photo-preview"
                className="relative h-20 w-20 overflow-hidden rounded-[8px] border border-[var(--border)]"
              >
                <Image
                  src={product.photo_url}
                  alt="Foto del producto"
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ) : photoPreview ? (
              <div
                data-testid="photo-preview"
                className="relative h-20 w-20 overflow-hidden rounded-[8px] border border-[var(--border)]"
              >
                <Image
                  src={photoPreview}
                  alt="Vista previa de la foto"
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="text-[13px] text-[var(--muted)] file:mr-3 file:rounded-[6px] file:border file:border-[var(--border)] file:bg-white file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-foreground"
              />
              <p className="text-[11px] text-[var(--muted)]">
                JPG, PNG o WEBP. Maximo 5MB.
              </p>
              {photoError ? (
                <p className="text-[12px] font-medium text-[#9B1C1C]">{photoError}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="mt-4">
          <ProductEstablishmentsPicker
            options={establishmentOptions}
            selectedIds={selectedEstablishmentIds}
            onSelectedIdsChange={setSelectedEstablishmentIds}
          />
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/productos"
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

      {state.error ? <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p> : null}
    </form>
  );
}
