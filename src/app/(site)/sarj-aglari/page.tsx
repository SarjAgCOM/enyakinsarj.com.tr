import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { ProviderDot } from "@/components/site/station-card";
import { JsonLd } from "@/components/site/json-ld";
import { listProviders } from "@/server/services/stations";
import { fmtInt, fmtKw, fmtTl } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const providers = await listProviders();
  return {
    title: `Türkiye Şarj Ağları (${providers.length} Ağ): İstasyon Haritaları ve Fiyatlar`,
    description: `${providers
      .slice(0, 6)
      .map((p) => p.name)
      .join(", ")} ve diğer ${providers.length} şarj ağının istasyon haritaları, DC/AC istasyon sayıları ve kWh fiyatları.`,
    alternates: { canonical: "/sarj-aglari" },
  };
}

export default async function ProvidersPage() {
  const providers = await listProviders();
  return (
    <div className="mx-auto max-w-7xl px-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Türkiye şarj ağları",
          itemListElement: providers.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.name,
            url: absoluteUrl(`/sarj-aglari/${p.slug}`),
          })),
        }}
      />
      <PageHeader
        crumbs={[{ href: "/sarj-aglari", label: "Şarj Ağları" }]}
        title="Türkiye'deki şarj ağları"
        description={`${providers.length} şarj ağının istasyon haritaları, hızlı şarj (DC) kapasiteleri ve güncel kWh fiyatları. Bir ağa tıklayarak yalnızca o ağın istasyonlarını haritada görün.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => (
          <Link key={p.id} href={`/sarj-aglari/${p.slug}`} className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ProviderDot color={p.color} className="size-3" />
                {p.name}
              </h2>
              <span className="text-xs text-muted-foreground">en yüksek {fmtKw(p.maxPowerKw)}</span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">İstasyon</dt>
                <dd className="font-semibold tabular-nums">{fmtInt(p.stationCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">DC</dt>
                <dd className="font-semibold tabular-nums">{fmtInt(p.dcStationCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">DC kWh</dt>
                <dd className="font-semibold tabular-nums">{fmtTl(p.minDcPrice)}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
      {providers.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Henüz şarj ağı verisi yok. Yönetim panelinden Şarjağ senkronunu başlatın.
        </p>
      )}
    </div>
  );
}
