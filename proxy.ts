import { NextResponse, type NextRequest } from "next/server";
import { APP_ROLE_COOKIE, isAppRole, roleHomePath } from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/proxy";

function redirectWithSessionCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = pathname;
  nextUrl.search = "";

  const redirectResponse = NextResponse.redirect(nextUrl);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, user } = await updateSession(request);
  const roleCookie = request.cookies.get(APP_ROLE_COOKIE)?.value;
  const role = isAppRole(roleCookie) ? roleCookie : null;

  const isAuthPage = pathname === "/login";
  const isHomeRoot = pathname === "/home";
  const isRoot = pathname === "/";
  const isRoleHome = pathname.startsWith("/home/");
  const isRoutes = pathname.startsWith("/rutas");
  const isRecords = pathname.startsWith("/registros");
  const isCompanies = pathname.startsWith("/empresas");
  const isProducts = pathname.startsWith("/productos");
  const isReports = pathname.startsWith("/reportes");
  const isTasks = pathname.startsWith("/tareas");
  const isUsers = pathname.startsWith("/usuarios");
  const isMyProfile = pathname === "/mi-perfil";
  const isLegacyMyProfile = pathname === "/usuarios/mi-perfil";

  if (
    !user &&
    (isRoot ||
      isHomeRoot ||
      isRoleHome ||
      isRoutes ||
      isRecords ||
      isCompanies ||
      isProducts ||
      isReports ||
      isTasks ||
      isUsers ||
      isMyProfile)
  ) {
    return redirectWithSessionCookies(request, response, "/login");
  }

  if (user && (isRoot || isAuthPage || isHomeRoot) && role) {
    return redirectWithSessionCookies(request, response, roleHomePath(role));
  }

  if (user && isCompanies && role && role !== "admin" && role !== "editor") {
    return redirectWithSessionCookies(request, response, roleHomePath(role));
  }

  if (user && isRoutes && role && role === "visitante") {
    return redirectWithSessionCookies(request, response, roleHomePath(role));
  }

  if (user && isProducts && role && role === "rutero") {
    return redirectWithSessionCookies(request, response, roleHomePath(role));
  }

  if (user && isReports && role && role === "rutero") {
    return redirectWithSessionCookies(request, response, roleHomePath(role));
  }

  if (user && isLegacyMyProfile) {
    return redirectWithSessionCookies(request, response, "/mi-perfil");
  }

  if (user && isTasks && role && role === "visitante") {
    return redirectWithSessionCookies(request, response, roleHomePath(role));
  }

  if (user && isUsers && role && (role === "visitante" || role === "rutero")) {
    return redirectWithSessionCookies(request, response, "/mi-perfil");
  }

  if (user && isRoleHome && role) {
    const routeRole = pathname.split("/")[2];

    if (!isAppRole(routeRole) || routeRole !== role) {
      return redirectWithSessionCookies(request, response, roleHomePath(role));
    }
  }

  return response;
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
