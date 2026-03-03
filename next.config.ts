import type { NextConfig } from "next";

function getSupabaseHostname() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = getSupabaseHostname();

const nextConfig: NextConfig = {
  // Keep heavy Node-only libraries external to avoid Turbopack rewriting
  // pdfkit asset paths (e.g. /ROOT/node_modules/... on Windows).
  serverExternalPackages: ["pdfkit", "exceljs", "exifr", "sharp"],
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https",
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/**",
            } as const,
          ]
        : []),
      // Reasonable fallback for Supabase projects when NEXT_PUBLIC_SUPABASE_URL isn't present at build time.
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/**" },
      { protocol: "https", hostname: "**.supabase.in", pathname: "/storage/v1/object/**" },
    ],
  },
};

export default nextConfig;
