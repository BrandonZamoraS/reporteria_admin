"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "@/app/home/_components/sidebar-nav";
import type { AppRole } from "@/lib/auth/roles";

type AppShellProps = {
  children: React.ReactNode;
  role: AppRole | null;
};

function isSidebarRoute(pathname: string) {
  return (
    pathname === "/home" ||
    pathname.startsWith("/home/") ||
    pathname.startsWith("/rutas") ||
    pathname.startsWith("/registros") ||
    pathname.startsWith("/establecimientos") ||
    pathname.startsWith("/empresas") ||
    pathname.startsWith("/productos") ||
    pathname.startsWith("/reportes") ||
    pathname.startsWith("/tareas") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/mi-perfil")
  );
}

export function AppShell({ children, role }: AppShellProps) {
  const pathname = usePathname();

  if (!isSidebarRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-background lg:flex lg:h-screen lg:items-start lg:overflow-hidden">
      {role ? <SidebarNav role={role} /> : null}
      <section className="w-full p-4 pt-5 sm:p-6 lg:h-screen lg:overflow-y-auto lg:p-6">
        {children}
      </section>
    </main>
  );
}
