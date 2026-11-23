"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LocateFixedIcon, Loader2Icon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StationCard } from "@/components/site/station-card";
import { FLAG, type MapProvider } from "@/lib/map-types";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const StationMap = dynamic(() => import("./station-map").then((m) => m.StationMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
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
      toast.error("Tarayıcınız konum özelliğini desteklemiyor.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Konumunuza erişilemedi. Tarayıcı izinlerini kontrol edin.");
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
    <div className="space-y-5">
      {!providerId && (
        <div className="space-y-2">
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
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Soket</legend>
        {SOCKETS.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <Checkbox
              id={`socket-${s.key}`}
              checked={(sockets & s.flag) !== 0}
              onCheckedChange={(v) => setSockets((cur) => (v ? cur | s.flag : cur & ~s.flag))}
            />
            <Label htmlFor={`socket-${s.key}`} className="font-normal">
              {s.label}
            </Label>
          </div>
        ))}
      </fieldset>
      <div className="space-y-2">
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
      <Button onClick={locate} disabled={locating} className="w-full" size="lg">
        {locating ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <LocateFixedIcon data-icon="inline-start" />}
        Bana en yakın istasyonlar
      </Button>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {lockedProvider ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: lockedProvider.color ?? "#16a34a" }} />
            {lockedProvider.name}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-green-600" /> Hızlı (DC)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-600" /> Normal (AC)
            </span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[300px_1fr]">
      {/* Filtre paneli */}
      <aside className="border-b lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 p-4 lg:hidden">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{fmtInt(filtered.length)}</span>{" "}
            <span className="text-muted-foreground">/ {fmtInt(total)} istasyon</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
              <LocateFixedIcon data-icon="inline-start" /> Yakınımda
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
              <SlidersHorizontalIcon data-icon="inline-start" /> Filtreler
            </Button>
          </div>
        </div>
        <div className={cn("space-y-4 p-4 pt-0 lg:block lg:pt-4", filtersOpen ? "block" : "hidden")}>
          <p className="hidden text-sm lg:block">
            <span className="text-2xl font-semibold tabular-nums">{fmtInt(filtered.length)}</span>{" "}
            <span className="text-muted-foreground">/ {fmtInt(total)} istasyon gösteriliyor</span>
          </p>
          {filters}
        </div>
        {userLocation && (
          <div className="max-h-[420px] space-y-2 overflow-y-auto border-t p-4">
            <h2 className="text-sm font-semibold">Size en yakın istasyonlar</h2>
            {nearestQuery.isLoading && <Skeleton className="h-24" />}
            {nearestQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">30 km içinde filtrelere uyan istasyon bulunamadı.</p>
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
      <div className={cn("relative", height)}>
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
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1.5 text-sm shadow">
            <Loader2Icon className="mr-1.5 inline size-4 animate-spin" />
            İstasyonlar yükleniyor…
          </div>
        )}
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-10 sm:left-auto sm:right-3 sm:w-96">
            <div className="relative">
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute -right-2 -top-2 z-20 rounded-full shadow"
                onClick={() => setSelected(null)}
                aria-label="Kapat"
              >
                <XIcon />
              </Button>
              {selectedQuery.data ? (
                <div className="shadow-xl">
                  <StationCard s={selectedQuery.data} />
                </div>
              ) : (
                <Skeleton className="h-36 rounded-xl" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
