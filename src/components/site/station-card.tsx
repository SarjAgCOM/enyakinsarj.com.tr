import Link from "next/link";
import { LightningIcon, MapPinIcon, NavigationArrowIcon } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { fmtKw, fmtTl, standardLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface StationCardData {
  slug: string;
  name: string;
  address: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  maxPowerKw: number | null;
  hasDc: boolean;
  standards: string[];
  minAcPrice: number | null;
  minDcPrice: number | null;
  provider: { name: string; slug: string; color: string | null };
  distanceKm?: number | null;
}

export function ProviderDot({ color, className }: { color: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: color ?? "var(--primary)" }}
    />
  );
}

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

const fmtDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

export function StationCard({ s, compact }: { s: StationCardData; compact?: boolean }) {
  const price =
    s.minDcPrice != null ? `DC ${fmtTl(s.minDcPrice)}` : s.minAcPrice != null ? `AC ${fmtTl(s.minAcPrice)}` : "Fiyat bilgisi yok";
  return (
    <article className="surface-card-interactive group relative flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="caption-4 flex items-center gap-2 text-muted-foreground">
            <ProviderDot color={s.provider.color} />
            {s.provider.name}
          </p>
          <h3 className="title-3 truncate">
            <Link href={`/istasyon/${s.slug}`} className="after:absolute after:inset-0">
              {s.name}
            </Link>
          </h3>
        </div>
        <Badge variant={s.hasDc ? "default" : "secondary"} className="shrink-0 tabular-nums">
          <LightningIcon weight="fill" data-icon="inline-start" />
          {fmtKw(s.maxPowerKw)}
        </Badge>
      </div>
      <p className="caption-2 flex items-start gap-2 text-muted-foreground">
        <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="line-clamp-2">
          {[s.address, s.district, s.city].filter(Boolean).join(", ") || "Adres bilgisi yok"}
        </span>
      </p>
      {!compact && s.standards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {s.standards.slice(0, 4).map((st) => (
            <Badge key={st} variant="outline" className="font-normal">
              {standardLabel(st)}
            </Badge>
          ))}
        </div>
      )}
      <div className="caption-2 mt-auto flex items-center justify-between gap-2">
        <span className="tabular-nums text-muted-foreground">
          {price}
          {s.distanceKm != null && <> · {fmtDistance(s.distanceKm)}</>}
        </span>
        {s.latitude != null && s.longitude != null && (
          <a
            href={directionsUrl(s.latitude, s.longitude)}
            target="_blank"
            rel="noopener"
            className="caption-1 relative z-10 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            <NavigationArrowIcon aria-hidden weight="fill" className="size-3" />
            Yol tarifi
          </a>
        )}
      </div>
    </article>
  );
}

/** İstasyon kartı yüklenirken gösterilen iskelet (gerçek düzenle aynı ölçülerde). */
export function StationCardSkeleton() {
  return (
    <div className="surface-card flex flex-col gap-3 p-4" aria-hidden>
      <div className="flex justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
    </div>
  );
}
