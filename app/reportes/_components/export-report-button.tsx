"use client";

import { useMemo, useState } from "react";
import type { AppRole } from "@/lib/auth/roles";
import type { ReportType } from "@/lib/reports/types";

type Option = {
  id: number;
  label: string;
};

type ExportReportButtonProps = {
  role: AppRole;
  reportType: ReportType;
  reportTitle: string;
  defaultCompanyId: number | null;
  companies: Option[];
  users: Option[];
  routes: Option[];
  establishments: Option[];
  products: Option[];
};

function shouldShowUser(reportType: ReportType) {
  return reportType === "eficiencia" || reportType === "auditoria" || reportType === "productividad";
}

function shouldShowRoute(reportType: ReportType) {
  return reportType === "ajustes";
}

function shouldShowCompany(reportType: ReportType) {
  return reportType === "completo" || reportType === "ajustes";
}

function shouldShowProduct(reportType: ReportType) {
  return reportType === "completo" || reportType === "ajustes";
}

function shouldShowEstablishment(reportType: ReportType) {
  return reportType === "completo" || reportType === "ajustes";
}

export function ExportReportButton({
  role,
  reportType,
  reportTitle,
  defaultCompanyId,
  companies,
  users,
  routes,
  establishments,
  products,
}: ExportReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const showCompany = useMemo(
    () => role !== "visitante" && shouldShowCompany(reportType),
    [reportType, role]
  );
  const showUser = useMemo(
    () => role !== "visitante" && shouldShowUser(reportType),
    [reportType, role]
  );
  const showRoute = useMemo(
    () => role !== "visitante" && shouldShowRoute(reportType),
    [reportType, role]
  );
  const showProduct = useMemo(() => shouldShowProduct(reportType), [reportType]);
  const showEstablishment = useMemo(() => shouldShowEstablishment(reportType), [reportType]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
      >
        Exportar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-[12px] border border-[var(--border)] bg-white p-4">
            <h3 className="text-[16px] font-semibold text-foreground">Exportar {reportTitle}</h3>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Configura los parametros para generar el PDF.
            </p>

            <form
              action="/reportes/export"
              method="get"
              target="_blank"
              className="mt-3 grid gap-3 md:grid-cols-2"
              onSubmit={() => {
                setTimeout(() => setIsOpen(false), 150);
              }}
            >
              <input type="hidden" name="type" value={reportType} />
              {role === "visitante" && defaultCompanyId ? (
                <input type="hidden" name="companyId" value={String(defaultCompanyId)} />
              ) : null}

              {showCompany ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Empresa
                  </span>
                  <select
                    name="companyId"
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    defaultValue=""
                  >
                    <option value="">Todas</option>
                    {companies.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showUser ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Usuario
                  </span>
                  <select
                    name="userId"
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    defaultValue=""
                  >
                    <option value="">Todos</option>
                    {users.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showRoute ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Ruta
                  </span>
                  <select
                    name="routeId"
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    defaultValue=""
                  >
                    <option value="">Todas</option>
                    {routes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showEstablishment ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Establecimiento
                  </span>
                  <select
                    name="establishmentId"
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    defaultValue=""
                  >
                    <option value="">Todos</option>
                    {establishments.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showProduct ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Producto
                  </span>
                  <select
                    name="productId"
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    defaultValue=""
                  >
                    <option value="">Todos</option>
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Desde</span>
                <input
                  type="date"
                  name="from"
                  className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Hasta</span>
                <input
                  type="date"
                  name="to"
                  className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                />
              </label>

              <div className="col-span-full mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
                >
                  Generar PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
