import Link from "next/link";
import { MapPinIcon, NavigationIcon, ZapIcon } from "lucide-react";
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
  return <span aria-hidden className={cn("inline-block size-2.5 rounded-full", className)} style={{ background: color ?? "#16a34a" }} />;
}

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function StationCard({ s, compact }: { s: StationCardData; compact?: boolean }) {
  return (
    <article className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ProviderDot color={s.provider.color} />
            {s.provider.name}
          </p>
          <h3 className="mt-0.5 truncate font-semibold">
            <Link href={`/istasyon/${s.slug}`} className="after:absolute after:inset-0">
              {s.name}
            </Link>
          </h3>
        </div>
        <Badge variant={s.hasDc ? "default" : "secondary"} className="shrink-0">
          <ZapIcon data-icon="inline-start" />
          {fmtKw(s.maxPowerKw)}
        </Badge>
      </div>
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
        <span className="line-clamp-2">
          {[s.address, s.district, s.city].filter(Boolean).join(", ") || "Adres bilgisi yok"}
        </span>
      </p>
      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5">
          {s.standards.slice(0, 4).map((st) => (
            <Badge key={st} variant="outline" className="font-normal">
              {standardLabel(st)}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
        <span className="tabular-nums text-muted-foreground">
          {s.minDcPrice != null ? `DC ${fmtTl(s.minDcPrice)}` : s.minAcPrice != null ? `AC ${fmtTl(s.minAcPrice)}` : "Fiyat yok"}
          {s.distanceKm != null && <> · {s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m` : `${s.distanceKm.toFixed(1)} km`}</>}
        </span>
        {s.latitude != null && s.longitude != null && (
          <a
            href={directionsUrl(s.latitude, s.longitude)}
            target="_blank"
            rel="noopener"
            className="relative z-10 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <NavigationIcon className="size-3.5" />
            Yol tarifi
          </a>
        )}
      </div>
    </article>
  );
}
