import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MapExplorer } from "@/components/map/map-explorer";
import { PageHeader, Section, StatGrid } from "@/components/site/page-header";
import { getCityTable, getStats, listProviders } from "@/server/services/stations";
import { fmtDate, fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getStats();
  return {
    title: `Şarj İstasyonu Haritası: Türkiye'deki ${fmtInt(stats.stations)} Şarj Noktası`,
    description: `Türkiye'deki ${fmtInt(stats.stations)} elektrikli araç şarj istasyonu tek haritada. ${stats.providers} şarj ağı, ${fmtInt(stats.dc)} DC hızlı şarj noktası; soket tipi, güç ve ağa göre filtreleyin, size en yakın istasyonu bulun.`,
    alternates: { canonical: "/sarj-haritasi" },
  };
}

export default async function MapPage() {
  const [stats, providers, cities] = await Promise.all([getStats(), listProviders(), getCityTable()]);
  return (
    <div className="mx-auto max-w-7xl px-4">
      <PageHeader
        crumbs={[{ href: "/sarj-haritasi", label: "Şarj Haritası" }]}
        title="Şarj istasyonu haritası"
        description="Türkiye'deki halka açık elektrikli araç şarj istasyonları tek haritada. Ağa, soket tipine ve güce göre filtreleyin; size en yakın istasyonları görün."
      />
      <StatGrid
        items={[
          { label: "İstasyon", value: fmtInt(stats.stations) },
          { label: "Hızlı şarj (DC)", value: fmtInt(stats.dc) },
          { label: "150 kW ve üzeri", value: fmtInt(stats.ultra) },
          { label: "Şarj ağı", value: fmtInt(stats.providers), hint: `${stats.cities} il` },
        ]}
      />
      <div className="mt-6">
        <Suspense>
          <MapExplorer
            providers={providers.map((p) => ({ id: p.id, name: p.name, slug: p.slug, color: p.color, stationCount: p.stationCount }))}
          />
        </Suspense>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Veri kaynağı: Şarjağ API · Son güncelleme: {fmtDate(stats.lastSyncedAt)} · Harita: © OpenStreetMap katkıda bulunanlar,
        OpenFreeMap. Anlık müsaitlik için istasyon sayfasındaki “Anlık doluluk” butonunu kullanın.
      </p>

      <Section title="İllere göre şarj istasyonları">
        <div className="flex flex-wrap gap-2">
          {cities
            .filter((c) => c.count > 0)
            .slice(0, 16)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/sarj-istasyonlari/${c.slug}`}
                className="rounded-full border px-3.5 py-1.5 text-sm hover:border-primary/40 hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          <Link href="/sarj-istasyonlari" className="px-3.5 py-1.5 text-sm font-medium text-primary">
            81 il →
          </Link>
        </div>
      </Section>

      <Section title="Şarj ağlarının haritaları">
        <div className="flex flex-wrap gap-2">
          {providers.map((p) => (
            <Link
              key={p.id}
              href={`/sarj-aglari/${p.slug}`}
              className="rounded-full border px-3.5 py-1.5 text-sm hover:border-primary/40 hover:text-primary"
            >
              {p.name} <span className="text-muted-foreground">({fmtInt(p.stationCount)})</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
