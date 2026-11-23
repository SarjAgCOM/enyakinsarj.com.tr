"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CrosshairIcon, SlidersHorizontalIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StationCard, StationCardSkeleton } from "@/components/site/station-card";
import { FLAG, type MapProvider } from "@/lib/map-types";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const StationMap = dynamic(() => import("./station-map").then((m) => m.StationMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});

const POWER_OPTIONS = [0, 22, 50, 100, 150, 250];
const SOCKETS = [
  { key: "ccs", label: "CCS (DC)", flag: FLAG.CCS },
  { key: "type2", label: "Type 2 (AC)", flag: FLAG.TYPE2 },
  { key: "chademo", label: "CHAdeMO", flag: FLAG.CHADEMO },
] as const;

export interface MapExplorerProps {
  providers: MapProvider[];
  /** Sayfaya sabitlenmiş ağ (ağ sayfaları) */
  providerId?: string;
  citySlug?: string;
  center?: { lat: number; lng: number; zoom?: number } | null;
  height?: string;
}

export function MapExplorer({ providers, providerId, citySlug, center, height = "h-[70vh] min-h-[520px]" }: MapExplorerProps) {
  const trpc = useTRPC();
  const params = useSearchParams();
  const [network, setNetwork] = useState<string>(providerId ?? params.get("ag") ?? "all");
  const [sockets, setSockets] = useState<number>(0);
  const [minPower, setMinPower] = useState<number>(params.get("dc") ? 50 : 0);
  const [selected, setSelected] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const pointsQuery = useQuery(
    trpc.station.mapPoints.queryOptions({ providerId, citySlug }, { staleTime: 10 * 60 * 1000 }),
  );
  const providerMeta = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);

  const filtered = useMemo(() => {
    const data = pointsQuery.data;
    if (!data) return [];
    const netIdx = network !== "all" ? data.providers.indexOf(network) : -1;
    return data.points.filter(([, , , pi, kw, flags]) => {
      if (network !== "all" && pi !== netIdx) return false;
      if (minPower && kw < minPower) return false;
      if (sockets && (flags & sockets) === 0) return false;
      return true;
    });
  }, [pointsQuery.data, network, minPower, sockets]);

  const selectedQuery = useQuery({
    ...trpc.station.byUid.queryOptions({ uid: selected ?? "" }),
    enabled: Boolean(selected),
  });

  const nearestQuery = useQuery({
    ...trpc.station.search.queryOptions({
      near: userLocation ? { ...userLocation, radiusKm: 30 } : undefined,
      providerIds: providerId ? [providerId] : network !== "all" ? [network] : undefined,
      citySlug: undefined,
      minPowerKw: minPower || undefined,
      standards: SOCKETS.filter((s) => sockets & s.flag).map((s) =>
        s.key === "ccs" ? "CCS2" : s.key === "type2" ? "TYPE2" : "CHADEMO",
      ),
      sort: "distance",
      limit: 10,
    }),
    enabled: Boolean(userLocation),
  });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocError("Tarayıcınız konum özelliğini desteklemiyor. İl sayfalarından arayabilirsiniz.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Konumunuza erişilemedi. Tarayıcının konum iznini açıp yeniden deneyin.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!params.get("yakinimda")) return;
    const t = setTimeout(locate, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = pointsQuery.data?.points.length ?? 0;
  const lockedProvider = providerId ? providerMeta.get(providerId) : undefined;

  const filters = (
    <div className="flex flex-col gap-6">
      {!providerId && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="network">Şarj ağı</Label>
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger id="network" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">Tüm ağlar</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({fmtInt(p.stationCount)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="title-4 mb-2">Soket</legend>
        {SOCKETS.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <Checkbox
              id={`socket-${s.key}`}
              checked={(sockets & s.flag) !== 0}
              onCheckedChange={(v) => setSockets((cur) => (v ? cur | s.flag : cur & ~s.flag))}
            />
            <Label htmlFor={`socket-${s.key}`} className="body-6">
              {s.label}
            </Label>
          </div>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="power">En az güç</Label>
        <Select value={String(minPower)} onValueChange={(v) => setMinPower(Number(v))}>
          <SelectTrigger id="power" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POWER_OPTIONS.map((p) => (
              <SelectItem key={p} value={String(p)}>
                {p === 0 ? "Tümü" : `${p} kW ve üzeri`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={locate} disabled={locating} className="w-full">
          <CrosshairIcon data-icon="inline-start" weight="bold" />
          {locating ? "Konum alınıyor" : "Bana en yakın istasyonlar"}
        </Button>
        {locError && (
          <p role="alert" className="caption-2 text-destructive">
            {locError}
          </p>
        )}
      </div>
      <div className="caption-5 flex items-center gap-4 text-muted-foreground">
        {lockedProvider ? (
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: lockedProvider.color ?? "var(--primary)" }} />
            {lockedProvider.name}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#0c7a43]" /> Hızlı (DC)
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#1d5fd1]" /> Normal (AC)
            </span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="surface-card grid gap-2 p-2 lg:grid-cols-[288px_1fr]">
      {/* Filtre paneli */}
      <aside className="flex flex-col gap-4 p-2 lg:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="caption-2 text-muted-foreground">
            <span className="heading-6 tabular-nums text-foreground lg:heading-5">{fmtInt(filtered.length)}</span> /{" "}
            {fmtInt(total)} istasyon
          </p>
          <div className="flex gap-2 lg:hidden">
            <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
              <CrosshairIcon data-icon="inline-start" /> Yakınımda
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="map-filters"
            >
              <SlidersHorizontalIcon data-icon="inline-start" /> Filtreler
            </Button>
          </div>
        </div>
        {locError && (
          <p role="alert" className="caption-2 text-destructive lg:hidden">
            {locError}
          </p>
        )}
        <div id="map-filters" className={cn("lg:block", filtersOpen ? "block" : "hidden")}>
          {filters}
        </div>
        {userLocation && (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            <h2 className="title-4">Size en yakın istasyonlar</h2>
            {nearestQuery.isLoading && (
              <>
                <StationCardSkeleton />
                <StationCardSkeleton />
              </>
            )}
            {nearestQuery.data?.length === 0 && (
              <p className="body-6 rounded-xl border border-dashed bg-surface p-4 text-muted-foreground">
                30 km içinde bu filtrelere uyan istasyon yok. Güç veya soket filtresini kaldırıp yeniden deneyin.
              </p>
            )}
            {nearestQuery.data?.map((s) => (
              <button key={s.uid} type="button" className="block w-full text-left" onClick={() => setSelected(s.uid)}>
                <StationCard s={s} compact />
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Harita */}
      <div className={cn("relative overflow-hidden rounded-lg bg-surface", height)}>
        <StationMap
          points={filtered}
          color={lockedProvider?.color}
          center={center}
          userLocation={userLocation}
          fitToPoints={Boolean(providerId || citySlug) && !center}
          focus={
            selectedQuery.data?.latitude != null && selectedQuery.data.longitude != null
              ? { lat: selectedQuery.data.latitude, lng: selectedQuery.data.longitude }
              : null
          }
          onSelect={setSelected}
          className="absolute inset-0"
        />
        {pointsQuery.isLoading && (
          <p className="caption-1 absolute left-1/2 top-4 -translate-x-1/2 rounded-full border bg-background px-3 py-1">
            İstasyonlar yükleniyor
          </p>
        )}
        {pointsQuery.isError && (
          <p role="alert" className="caption-1 absolute left-1/2 top-4 -translate-x-1/2 rounded-full border bg-background px-3 py-1 text-destructive">
            İstasyonlar yüklenemedi. Sayfayı yenileyin.
          </p>
        )}
        {selected && (
          <div className="absolute inset-x-2 bottom-2 z-10 sm:left-auto sm:w-96">
            <div className="relative">
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute -right-1 -top-1 z-20 rounded-full border"
                onClick={() => setSelected(null)}
                aria-label="İstasyon kartını kapat"
              >
                <XIcon />
              </Button>
              {selectedQuery.data ? <StationCard s={selectedQuery.data} /> : <StationCardSkeleton />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
