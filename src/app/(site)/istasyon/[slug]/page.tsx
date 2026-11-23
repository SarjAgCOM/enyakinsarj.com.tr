import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MapPinIcon, NavigationIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, StatGrid } from "@/components/site/page-header";
import { StationCard, directionsUrl } from "@/components/site/station-card";
import { LiveStatus } from "@/components/site/live-status";
import { JsonLd } from "@/components/site/json-ld";
import { getNearbyStations, getStationBySlug } from "@/server/services/stations";
import type { SarjagConnector, SarjagPrice } from "@/server/sarjag/schemas";
import { STATUS_LABELS, fmtDateTime, fmtKw, fmtTl, standardLabel } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/istasyon/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStationBySlug(slug);
  if (!s) return { title: "İstasyon bulunamadı" };
  const place = [s.district, s.city].filter(Boolean).join(", ");
  return {
    title: `${s.name} – ${s.provider.name} Şarj İstasyonu${place ? ` (${place})` : ""}`,
    description: `${s.provider.name} ${s.name} şarj istasyonu: ${s.totalConnectors} soket, en yüksek ${fmtKw(s.maxPowerKw)}, ${s.standards.map(standardLabel).join(", ")}.${s.minDcPrice ? ` DC ${fmtTl(s.minDcPrice)}/kWh.` : ""} Adres, yol tarifi ve anlık doluluk.`,
    alternates: { canonical: `/istasyon/${s.slug}` },
    robots: s.isActive ? undefined : { index: false },
  };
}

export default async function StationPage({ params }: PageProps<"/istasyon/[slug]">) {
  const { slug } = await params;
  const s = await getStationBySlug(slug);
  if (!s) notFound();
  const connectors = s.connectors as unknown as SarjagConnector[];
  const prices = s.prices as unknown as SarjagPrice[];
  const nearby = s.latitude != null && s.longitude != null ? await getNearbyStations(s.latitude, s.longitude, s.uid) : [];
  const place = [s.district, s.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-7xl px-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Place",
          additionalType: "https://schema.org/AutomotiveBusiness",
          name: `${s.provider.name} ${s.name}`,
          url: absoluteUrl(`/istasyon/${s.slug}`),
          address: {
            "@type": "PostalAddress",
            streetAddress: s.address ?? undefined,
            addressLocality: s.district ?? undefined,
            addressRegion: s.city ?? undefined,
            postalCode: s.postalCode ?? undefined,
            addressCountry: "TR",
          },
          ...(s.latitude != null && s.longitude != null
            ? { geo: { "@type": "GeoCoordinates", latitude: s.latitude, longitude: s.longitude } }
            : {}),
          brand: { "@type": "Brand", name: s.provider.name },
          amenityFeature: s.standards.map((st) => ({ "@type": "LocationFeatureSpecification", name: standardLabel(st), value: true })),
        }}
      />
      <PageHeader
        crumbs={[
          ...(s.citySlug ? [{ href: `/sarj-istasyonlari/${s.citySlug}`, label: s.city ?? s.citySlug }] : []),
          { href: `/sarj-aglari/${s.provider.slug}`, label: s.provider.name },
          { href: `/istasyon/${s.slug}`, label: s.name },
        ]}
        title={s.name}
        description={
          <span className="flex items-start gap-1.5">
            <MapPinIcon className="mt-1 size-4 shrink-0" />
            {[s.address, place].filter(Boolean).join(" · ") || "Adres bilgisi yok"}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            <Link href={`/sarj-aglari/${s.provider.slug}`}>{s.provider.name}</Link>
          </Badge>
          {s.hasDc && <Badge>DC hızlı şarj</Badge>}
          {s.hasAc && <Badge variant="outline">AC</Badge>}
          {!s.isActive && <Badge variant="destructive">Artık listelenmiyor</Badge>}
          {s.access && <Badge variant="outline">{s.access === "PUBLIC" ? "Herkese açık" : s.access}</Badge>}
        </div>
        {s.latitude != null && s.longitude != null && (
          <Button asChild size="lg">
            <a href={directionsUrl(s.latitude, s.longitude)} target="_blank" rel="noopener">
              <NavigationIcon data-icon="inline-start" /> Yol tarifi al
            </a>
          </Button>
        )}
      </PageHeader>

      <StatGrid
        items={[
          { label: "En yüksek güç", value: fmtKw(s.maxPowerKw) },
          { label: "Soket", value: s.totalConnectors },
          { label: "DC kWh", value: fmtTl(s.minDcPrice) },
          { label: "AC kWh", value: fmtTl(s.minAcPrice) },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <Section title="Soketler">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-3">Soket</th>
                    <th className="px-4 py-3">Tip</th>
                    <th className="px-4 py-3">Güç</th>
                    <th className="px-4 py-3">Fiyat</th>
                    <th className="px-4 py-3">Son durum</th>
                  </tr>
                </thead>
                <tbody>
                  {connectors.map((c) => (
                    <tr key={c.uid} className="border-t">
                      <td className="px-4 py-2.5 font-mono text-xs">{c.evseId ?? c.code ?? c.uid.split(":").pop()}</td>
                      <td className="px-4 py-2.5">{standardLabel(c.standard)}</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        <ZapIcon className="mr-1 inline size-3.5 text-primary" />
                        {fmtKw(c.maxPowerKw)} {c.powerType}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {c.price?.energyPerKwh != null ? `${fmtTl(c.price.energyPerKwh)}/kWh` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{STATUS_LABELS[c.status] ?? c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              “Son durum” senkron anındaki durumdur ({fmtDateTime(s.syncedAt)}). Güncel doluluk için aşağıdaki butonu kullanın.
            </p>
          </Section>

          <Section title="Anlık doluluk">
            <Suspense>
              <LiveStatus uid={s.uid} />
            </Suspense>
          </Section>

          {prices.length > 0 && (
            <Section title="Tarifeler">
              <ul className="grid gap-2 sm:grid-cols-2">
                {prices.map((p, i) => (
                  <li key={p.tariffId ?? i} className="rounded-lg border px-4 py-3 text-sm">
                    <p className="font-medium">
                      {p.label ?? `${p.powerType ?? ""} tarife`}{" "}
                      {p.audience && p.audience !== "ALL" && (
                        <span className="text-muted-foreground">({p.audience === "MEMBER" ? "üye" : "misafir"})</span>
                      )}
                    </p>
                    <p className="mt-1 tabular-nums text-muted-foreground">
                      {p.energyPerKwh != null && <>{fmtTl(p.energyPerKwh)}/kWh </>}
                      {p.timePerMinute != null && p.timePerMinute > 0 && <>· {fmtTl(p.timePerMinute)}/dk </>}
                      {p.sessionFee != null && p.sessionFee > 0 && <>· oturum {fmtTl(p.sessionFee)} </>}
                      {p.vatIncluded === false && "(KDV hariç)"}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="py-8">
          {nearby.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Yakındaki diğer istasyonlar</h2>
              {nearby.map((n) => (
                <StationCard key={n.uid} s={n} compact />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
