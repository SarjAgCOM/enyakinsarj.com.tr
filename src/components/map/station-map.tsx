"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { MapPoint } from "@/lib/map-types";
import { FLAG } from "@/lib/map-types";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";

// v6 web worker'ı ayrı modül olarak yüklenir (scripts/copy-maplibre-worker.mjs public/vendor'a kopyalar)
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
const TURKEY_BOUNDS: [[number, number], [number, number]] = [
  [25.6, 35.8],
  [44.9, 42.2],
];

export interface StationMapProps {
  points: MapPoint[];
  /** Belirli bir ağ sayfasında işaretçiler ağın renginde çizilir. */
  color?: string | null;
  center?: { lat: number; lng: number; zoom?: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  focus?: { lat: number; lng: number } | null;
  fitToPoints?: boolean;
  onSelect?: (uid: string) => void;
  className?: string;
}

function toGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map(([uid, lat, lng, , kw, flags]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { uid, kw, dc: (flags & FLAG.DC) !== 0 ? 1 : 0 },
    })),
  };
}

export function StationMap({ points, color, center, userLocation, focus, fitToPoints, onSelect, className }: StationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const pendingData = useRef<GeoJSON.FeatureCollection | null>(null);
  const onSelectRef = useRef(onSelect);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const didFit = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Haritayı bir kez oluştur
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      bounds: center ? undefined : TURKEY_BOUNDS,
      center: center ? [center.lng, center.lat] : undefined,
      zoom: center?.zoom,
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      const primary = color ?? "#16a34a";
      map.addSource("stations", {
        type: "geojson",
        data: pendingData.current ?? { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 48,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "stations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": color ?? ["step", ["get", "point_count"], "#22c55e", 50, "#16a34a", 300, "#15803d"],
          "circle-radius": ["step", ["get", "point_count"], 16, 50, 21, 300, 27, 1000, 33],
          "circle-stroke-width": 3,
          "circle-stroke-color": "rgba(255,255,255,0.85)",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "stations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "station-points",
        type: "circle",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": color ? primary : ["case", ["==", ["get", "dc"], 1], "#16a34a", "#2563eb"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 8, 17, 11],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", async (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        if (!f) return;
        const src = map.getSource("stations") as maplibregl.GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on("click", "station-points", (e) => {
        const uid = e.features?.[0]?.properties?.uid as string | undefined;
        if (uid) onSelectRef.current?.(uid);
      });
      for (const layer of ["clusters", "station-points"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      readyRef.current = true;
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Veri değiştikçe kaynağı güncelle
  useEffect(() => {
    const data = toGeoJSON(points);
    const map = mapRef.current;
    const apply = () => {
      (map!.getSource("stations") as maplibregl.GeoJSONSource | undefined)?.setData(data);
      if (fitToPoints && !didFit.current && points.length) {
        const bounds = new maplibregl.LngLatBounds();
        for (const p of points) bounds.extend([p[2], p[1]]);
        map!.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 0 });
        didFit.current = true;
      }
    };
    if (map && readyRef.current) apply();
    else {
      pendingData.current = data;
      map?.once("load", apply);
    }
  }, [points, fitToPoints]);

  // Kullanıcı konumu
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "size-4 rounded-full border-[3px] border-white bg-blue-600 shadow-[0_0_0_6px_rgba(37,99,235,0.25)]";
      el.setAttribute("aria-label", "Konumunuz");
      userMarker.current = new maplibregl.Marker({ element: el });
    }
    userMarker.current.setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 12.5 });
  }, [userLocation]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 15) });
  }, [focus]);

  // MapLibre konteynere `position: relative` verdiği için dış sarmalayıcı konumlandırmayı taşır.
  return (
    <div className={className} role="region" aria-label="Şarj istasyonları haritası">
      <div ref={container} className="size-full" />
    </div>
  );
}
