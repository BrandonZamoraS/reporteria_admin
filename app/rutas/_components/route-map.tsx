"use client";

import { useEffect, useMemo, useRef } from "react";

type RouteMapPoint = {
  establishmentId: number;
  name: string;
  lat: number | null;
  lng: number | null;
};

type RouteMapProps = {
  points: RouteMapPoint[];
};

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-sdk";
const DEFAULT_MAP_CENTER: LatLng = { lat: 19.4326, lng: -99.1332 };

type LatLng = { lat: number; lng: number };

type GoogleMapsSdk = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: LatLng;
        zoom: number;
        mapTypeControl: boolean;
        streetViewControl: boolean;
        fullscreenControl: boolean;
      }
    ) => {
      setCenter: (center: LatLng) => void;
      setZoom: (zoom: number) => void;
      fitBounds: (bounds: { extend: (position: LatLng) => void }) => void;
    };
    Marker: new (options: {
      map: unknown;
      position: LatLng;
      title: string;
      label: string;
    }) => {
      setMap: (map: unknown) => void;
    };
    Polyline: new (options: {
      path: LatLng[];
      geodesic: boolean;
      strokeColor: string;
      strokeOpacity: number;
      strokeWeight: number;
    }) => {
      setMap: (map: unknown) => void;
    };
    LatLngBounds: new () => {
      extend: (position: LatLng) => void;
    };
  };
};

function hasGoogleMapsSdk(value: unknown): value is GoogleMapsSdk {
  if (!value || typeof value !== "object") return false;
  const maybeSdk = value as { maps?: unknown };
  if (!maybeSdk.maps || typeof maybeSdk.maps !== "object") return false;
  const maps = maybeSdk.maps as Record<string, unknown>;
  return (
    typeof maps.Map === "function" &&
    typeof maps.Marker === "function" &&
    typeof maps.Polyline === "function" &&
    typeof maps.LatLngBounds === "function"
  );
}

function loadGoogleMapsSdk(apiKey: string) {
  return new Promise<GoogleMapsSdk>((resolve, reject) => {
    const win = window as typeof window & {
      google?: unknown;
    };

    if (hasGoogleMapsSdk(win.google)) {
      resolve(win.google);
      return;
    }

    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener(
        "load",
        () =>
          hasGoogleMapsSdk(win.google)
            ? resolve(win.google)
            : reject(new Error("Google Maps SDK no disponible tras carga")),
        { once: true }
      );
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps SDK")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () =>
        hasGoogleMapsSdk(win.google)
          ? resolve(win.google)
          : reject(new Error("Google Maps SDK no disponible tras carga")),
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps SDK")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

export function RouteMap({ points }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const validPoints = useMemo(
    () =>
      points.filter(
        (point): point is RouteMapPoint & { lat: number; lng: number } =>
          typeof point.lat === "number" &&
          Number.isFinite(point.lat) &&
          typeof point.lng === "number" &&
          Number.isFinite(point.lng)
      ),
    [points]
  );

  useEffect(() => {
    if (!apiKey || !mapContainerRef.current) return;

    let isCancelled = false;
    const markers: Array<{ setMap: (map: unknown) => void }> = [];
    let polyline: { setMap: (map: unknown) => void } | undefined;

    loadGoogleMapsSdk(apiKey)
      .then((googleInstance) => {
        if (isCancelled || !mapContainerRef.current) return;
        const google = googleInstance;

        const defaultCenter =
          validPoints.length > 0
            ? { lat: validPoints[0].lat, lng: validPoints[0].lng }
            : DEFAULT_MAP_CENTER;
        const map = new google.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const bounds = new google.maps.LatLngBounds();
        validPoints.forEach((point, index) => {
          const position = { lat: point.lat, lng: point.lng };
          bounds.extend(position);

          const marker = new google.maps.Marker({
            map,
            position,
            title: point.name,
            label: String(index + 1),
          });
          markers.push(marker);
        });

        if (validPoints.length > 1) {
          polyline = new google.maps.Polyline({
            path: validPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
            geodesic: true,
            strokeColor: "#0D3233",
            strokeOpacity: 0.9,
            strokeWeight: 3,
          });
          polyline.setMap(map);
          map.fitBounds(bounds);
        } else if (validPoints.length === 1) {
          map.setCenter(defaultCenter);
          map.setZoom(14);
        } else {
          map.setCenter(defaultCenter);
          map.setZoom(11);
        }
      })
      .catch(() => {
        // Defer error UI to the fallback below.
      });

    return () => {
      isCancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      polyline?.setMap(null);
    };
  }, [apiKey, validPoints]);

  if (!apiKey) {
    return (
      <div className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3 text-[13px] text-[var(--muted)]">
        Configura <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para mostrar el mapa de ruta.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={mapContainerRef}
        className="h-[320px] w-full rounded-[10px] border border-[var(--border)]"
      />
      {validPoints.length === 0 ? (
        <p className="text-[12px] text-[var(--muted)]">
          Esta ruta no tiene establecimientos con coordenadas validas.
        </p>
      ) : null}
    </div>
  );
}
