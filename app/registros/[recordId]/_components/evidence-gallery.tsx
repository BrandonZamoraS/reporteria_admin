"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type EvidenceItem = {
  url: string;
  geoInfo?: string | null;
};

type EvidenceGalleryProps = {
  items: EvidenceItem[];
};

function isProbablyImageUrl(url: string) {
  const normalized = url.split("?")[0]?.toLowerCase() ?? "";
  return (
    normalized.endsWith(".jpg") ||
    normalized.endsWith(".jpeg") ||
    normalized.endsWith(".png") ||
    normalized.endsWith(".webp") ||
    normalized.endsWith(".gif") ||
    normalized.endsWith(".avif")
  );
}

function isSafeImageSrc(url: string) {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
}

export function EvidenceGallery({ items }: EvidenceGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [failedUrls, setFailedUrls] = useState<Record<string, true>>({});
  const canOpen = items.length > 0;

  const safeItems = useMemo(
    () =>
      items
        .map((item) => ({ ...item, url: String(item.url ?? "").trim() }))
        .filter((item) => item.url.length > 0),
    [items]
  );

  useEffect(() => {
    if (openIndex == null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowLeft") setOpenIndex((prev) => (prev == null ? prev : Math.max(0, prev - 1)));
      if (event.key === "ArrowRight")
        setOpenIndex((prev) => (prev == null ? prev : Math.min(safeItems.length - 1, prev + 1)));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex, safeItems.length]);

  if (!canOpen) {
    return <p className="text-[13px] text-[var(--muted)]">No hay evidencias cargadas.</p>;
  }

  const activeItem = openIndex != null ? safeItems[openIndex] ?? null : null;
  const activeIsImage = activeItem
    ? isProbablyImageUrl(activeItem.url) &&
      isSafeImageSrc(activeItem.url) &&
      !failedUrls[activeItem.url]
    : false;
  const activeIndex = openIndex ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {safeItems.map((item, idx) => {
          const isImage =
            isProbablyImageUrl(item.url) && isSafeImageSrc(item.url) && !failedUrls[item.url];
          return (
            <button
              key={`${item.url}-${idx}`}
              type="button"
              onClick={() => setOpenIndex(idx)}
              className="group overflow-hidden rounded-[12px] border border-[var(--border)] bg-[#F8FAF8] text-left"
              aria-label={`Abrir evidencia ${idx + 1}`}
            >
              <div className="relative aspect-square w-full bg-white">
                {isImage ? (
                  <Image
                    src={item.url}
                    alt={`Evidencia ${idx + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    onError={() => setFailedUrls((prev) => ({ ...prev, [item.url]: true }))}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-4">
                    <span className="text-[12px] font-semibold text-[var(--muted)]">Archivo</span>
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <p className="text-[12px] font-semibold text-foreground">Evidencia {idx + 1}</p>
                {item.geoInfo ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--muted)]">{item.geoInfo}</p>
                ) : (
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">Sin geo info</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[14px] bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground">
                Evidencia {activeIndex + 1} de {safeItems.length}
              </p>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
              >
                Cerrar
              </button>
            </div>

            <div className="relative h-[70vh] w-full bg-black">
              {activeIsImage ? (
                <Image
                  src={activeItem.url}
                  alt={`Evidencia ${activeIndex + 1}`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  onError={() => setFailedUrls((prev) => ({ ...prev, [activeItem.url]: true }))}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-[14px] font-semibold text-white">Este archivo no se puede previsualizar.</p>
                  <a
                    href={activeItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[8px] bg-white px-3 py-2 text-[12px] font-semibold text-foreground"
                  >
                    Abrir archivo
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenIndex((prev) => (prev == null ? prev : Math.max(0, prev - 1)))}
                  disabled={activeIndex === 0}
                  className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setOpenIndex((prev) => (prev == null ? prev : Math.min(safeItems.length - 1, prev + 1)))}
                  disabled={activeIndex === safeItems.length - 1}
                  className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>

              <a
                href={activeItem.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
              >
                Abrir en nueva pestana
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

