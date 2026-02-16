import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Manrope } from "next/font/google";
import { AppShell } from "@/app/app-shell";
import { APP_ROLE_COOKIE, isAppRole } from "@/lib/auth/roles";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Instavista Admin",
  description: "Panel administrativo de Instavista",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(APP_ROLE_COOKIE)?.value;
  const role = isAppRole(roleCookie) ? roleCookie : null;

  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`}>
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  );
}
