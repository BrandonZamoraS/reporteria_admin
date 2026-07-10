"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_DYNAMIC_REPORT_PHOTOS } from "@/lib/reports/dynamic-report-types";

/* ── Types ────────────────────────────────────────────────── */
type CompanyOption = {
  id: number;
  label: string;
};

type EstablishmentOption = {
  id: number;
  label: string;
};

type StoreSection = {
  establishmentId: number | null;
  establishmentName: string;
  description: string;
  photos: Blob[];
};

type DynamicReportFormProps = {
  companies: CompanyOption[];
};

/* ── Photo compression via canvas ─────────────────────────── */
function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      const maxDim = 1200;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo obtener contexto del canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("No se pudo comprimir la imagen"));
          }
        },
        "image/jpeg",
        0.7
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen"));
    };

    img.src = url;
  });
}

/* ── Component ────────────────────────────────────────────── */
export function DynamicReportForm({ companies }: DynamicReportFormProps) {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [loading, setLoading] = useState(false);

  // Establishment options (filtered by company)
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [establishmentsLoading, setEstablishmentsLoading] = useState(false);

  // Active add-store form state
  const [showAddStore, setShowAddStore] = useState(false);
  const [newEstablishmentId, setNewEstablishmentId] = useState<number | null>(null);
  const [newEstablishmentName, setNewEstablishmentName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPhotos, setNewPhotos] = useState<Blob[]>([]);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchRequestIdRef = useRef(0);

  // Create object URLs for photo previews and revoke on cleanup
  const photoPreviewUrls = useMemo(() => {
    return newPhotos.map((photo) => URL.createObjectURL(photo));
  }, [newPhotos]);

  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviewUrls]);

  /* ── Company selection ────────────────────────────────── */
  const handleCompanyChange = useCallback(
    async (value: string) => {
      const id = value ? Number(value) : null;
      setCompanyId(id);
      const selected = companies.find((c) => c.id === id);
      setCompanyName(selected?.label ?? "");
      setSections([]);
      setEstablishments([]);

      if (id) {
        const requestId = ++fetchRequestIdRef.current;
        setEstablishmentsLoading(true);
        try {
          const response = await fetch(
            `/reportes/dinamico/establecimientos?companyId=${id}`
          );
          // Ignore stale responses
          if (requestId !== fetchRequestIdRef.current) return;

          if (response.ok) {
            const data = await response.json();
            const raw = data.establishments as Array<{ id: number; name?: string; label?: string }>;
            setEstablishments(
              raw.map((e) => ({
                id: e.id,
                label: e.label ?? e.name ?? `Establecimiento ${e.id}`,
              }))
            );
          } else {
            toast.error("No se pudieron cargar los establecimientos.");
          }
        } catch {
          if (requestId !== fetchRequestIdRef.current) return;
          toast.error("Error al conectar con el servidor.");
        } finally {
          if (requestId === fetchRequestIdRef.current) {
            setEstablishmentsLoading(false);
          }
        }
      }
    },
    [companies]
  );

  /* ── Photo file picker ─────────────────────────────────── */
  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      // Filter to only image files
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        toast.error("Solo se permiten imagenes.");
        return;
      }

      const remaining = MAX_DYNAMIC_REPORT_PHOTOS - newPhotos.length;
      if (remaining <= 0) {
        toast.error(`Maximo ${MAX_DYNAMIC_REPORT_PHOTOS} fotos por tienda.`);
        return;
      }

      setCompressing(true);
      try {
        const toCompress = imageFiles.slice(0, remaining);
        const compressed = await Promise.all(toCompress.map(compressPhoto));
        setNewPhotos((prev) => [...prev, ...compressed].slice(0, MAX_DYNAMIC_REPORT_PHOTOS));
      } catch {
        toast.error("Error al procesar las imagenes.");
      } finally {
        setCompressing(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [newPhotos.length]
  );

  const removeNewPhoto = useCallback((index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Add store ─────────────────────────────────────────── */
  const handleAddStore = useCallback(() => {
    if (!newEstablishmentId) {
      toast.error("Selecciona un establecimiento.");
      return;
    }

    const name =
      establishments.find((e) => e.id === newEstablishmentId)?.label ?? "Sin nombre";

    setSections((prev) => [
      ...prev,
      {
        establishmentId: newEstablishmentId,
        establishmentName: name,
        description: newDescription,
        photos: newPhotos,
      },
    ]);

    // Reset form
    setNewEstablishmentId(null);
    setNewEstablishmentName("");
    setNewDescription("");
    setNewPhotos([]);
    setShowAddStore(false);
  }, [newEstablishmentId, newEstablishmentName, newDescription, newPhotos, establishments]);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Download PDF ──────────────────────────────────────── */
  const handleDownload = useCallback(async () => {
    if (sections.length === 0) {
      toast.error("Agrega al menos un establecimiento.");
      return;
    }

    if (!companyId) {
      toast.error("Selecciona una empresa.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("companyId", String(companyId));
      formData.append("companyName", companyName);
      formData.append("description", reportDescription);
      formData.append("sectionCount", String(sections.length));

      sections.forEach((section, i) => {
        formData.append(`section.${i}.establishmentId`, String(section.establishmentId));
        formData.append(`section.${i}.establishmentName`, section.establishmentName);
        formData.append(`section.${i}.description`, section.description);
        section.photos.forEach((photo, j) => {
          formData.append(`section.${i}.photo.${j}`, photo, `photo_${i}_${j}.jpg`);
        });
      });

      const response = await fetch("/reportes/dinamico/pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.error ?? "Error al generar el PDF.");
        return;
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_dinamico_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("PDF generado correctamente.");
    } catch {
      toast.error("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [companyId, companyName, reportDescription, sections]);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Reportes</p>
        <h1 className="text-[20px] font-semibold text-foreground">Reporte Dinamico</h1>
      </header>

      {/* Company selector */}
      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--muted)]">
          Empresa
        </label>
        <select
          value={companyId ? String(companyId) : ""}
          onChange={(e) => handleCompanyChange(e.target.value)}
          className="h-10 w-full max-w-md rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        >
          <option value="">Selecciona una empresa</option>
          {companies.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.label}
            </option>
          ))}
        </select>
      </section>

      {/* Report description */}
      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--muted)]">
          Descripcion del reporte
        </label>
        <textarea
          value={reportDescription}
          onChange={(e) => setReportDescription(e.target.value)}
          rows={3}
          placeholder="Opcional: describe el proposito de este reporte..."
          className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-foreground"
        />
      </section>

      {/* Store sections list */}
      {sections.length > 0 && (
        <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <h2 className="mb-3 text-[14px] font-semibold text-foreground">
            Establecimientos ({sections.length})
          </h2>
          <div className="flex flex-col gap-2">
            {sections.map((section, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-[8px] border border-[var(--border)] bg-[#F4F7F4] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">
                    {section.establishmentName}
                  </p>
                  {section.description && (
                    <p className="mt-0.5 text-[12px] text-[var(--muted)] line-clamp-2">
                      {section.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {section.photos.length} foto{section.photos.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="shrink-0 rounded-[6px] p-1 text-[12px] text-red-600 hover:bg-red-50"
                  title="Eliminar establecimiento"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add store section */}
      {companyId && (
        <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          {!showAddStore ? (
            <button
              type="button"
              onClick={() => setShowAddStore(true)}
              className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-[#F4F7F4]"
            >
              + Agregar tienda
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-[14px] font-semibold text-foreground">Agregar tienda</h3>

              {/* Establishment picker */}
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                  Establecimiento
                </span>
                {establishmentsLoading ? (
                  <p className="text-[12px] text-[var(--muted)]">Cargando...</p>
                ) : (
                  <select
                    value={newEstablishmentId ? String(newEstablishmentId) : ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setNewEstablishmentId(id);
                      const selected = establishments.find((est) => est.id === id);
                      setNewEstablishmentName(selected?.label ?? "");
                    }}
                    className="h-10 w-full max-w-md rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                  >
                    <option value="">Selecciona un establecimiento</option>
                    {establishments.map((est) => (
                      <option key={est.id} value={String(est.id)}>
                        {est.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {/* Photos */}
              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                  Fotos ({newPhotos.length}/{MAX_DYNAMIC_REPORT_PHOTOS})
                </span>
                <div className="mb-2 flex flex-wrap gap-2">
                  {newPhotos.map((photo, i) => (
                    <div key={i} className="relative">
                      <img
                        src={photoPreviewUrls[i]}
                        alt={`Foto ${i + 1}`}
                        className="h-20 w-20 rounded-[6px] border border-[var(--border)] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewPhoto(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  disabled={compressing || newPhotos.length >= MAX_DYNAMIC_REPORT_PHOTOS}
                  className="block text-[12px] text-[var(--muted)] file:mr-3 file:rounded-[6px] file:border-0 file:bg-[#DDE2DD] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-[#0d3233] disabled:opacity-50"
                />
                {compressing && (
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Comprimiendo imagenes...</p>
                )}
              </div>

              {/* Description */}
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                  Descripcion
                </span>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="Opcional: observaciones de esta tienda..."
                  className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-foreground"
                />
              </label>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddStore}
                  className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStore(false);
                    setNewEstablishmentId(null);
                    setNewEstablishmentName("");
                    setNewDescription("");
                    setNewPhotos([]);
                  }}
                  className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Download button */}
      {sections.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="rounded-[8px] bg-foreground px-6 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
