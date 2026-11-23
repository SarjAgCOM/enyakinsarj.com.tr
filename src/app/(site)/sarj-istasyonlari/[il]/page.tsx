import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MapExplorer } from "@/components/map/map-explorer";
import { PageHeader, Section, StatGrid } from "@/components/site/page-header";
import { ProviderDot, directionsUrl } from "@/components/site/station-card";
import { JsonLd } from "@/components/site/json-ld";
import { getCityDetail, listProviders } from "@/server/services/stations";
import { locativeKi, provinceBySlug } from "@/lib/turkey";
import { fmtInt, fmtKw, fmtTl } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/sarj-istasyonlari/[il]">): Promise<Metadata> {
  const { il } = await params;
  const province = provinceBySlug(il);
  if (!province) return { title: "İl bulunamadı" };
  const d = await getCityDetail(il);
  return {
    title: `${province.name} Şarj İstasyonları (${fmtInt(d.count)} istasyon): Harita ve Fiyatlar`,
    description: `${locativeKi(province.name)} ${fmtInt(d.count)} elektrikli araç şarj istasyonu haritada: ${fmtInt(d.dc)} DC hızlı şarj, ${d.providers.length} şarj ağı. İlçelere göre istasyonlar ve en hızlı şarj noktaları.`,
    alternates: { canonical: `/sarj-istasyonlari/${il}` },
  };
}

export default async function CityPage({ params }: PageProps<"/sarj-istasyonlari/[il]">) {
  const { il } = await params;
  const province = provinceBySlug(il);
  if (!province) notFound();
  const [d, providers] = await Promise.all([getCityDetail(il), listProviders()]);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${locativeKi(province.name)} en hızlı şarj istasyonları`,
          itemListElement: d.fastest.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/istasyon/${s.slug}`),
            name: s.name,
          })),
        }}
      />
      <PageHeader
        crumbs={[
          { href: "/sarj-istasyonlari", label: "İl İl İstasyonlar" },
          { href: `/sarj-istasyonlari/${il}`, label: province.name },
        ]}
        title={`${province.name} şarj istasyonları`}
        description={`${province.name} genelindeki halka açık elektrikli araç şarj istasyonları, ilçelere göre dağılım ve en hızlı şarj noktaları.`}
      />
      <StatGrid
        items={[
          { label: "İstasyon", value: fmtInt(d.count) },
          { label: "DC hızlı şarj", value: fmtInt(d.dc) },
          { label: "150 kW ve üzeri", value: fmtInt(d.ultra) },
          { label: "Şarj ağı", value: fmtInt(d.providers.length) },
        ]}
      />

      <div className="mt-6">
        <Suspense>
          <MapExplorer
            citySlug={il}
            center={d.center ? { ...d.center, zoom: 10 } : null}
            providers={providers.map((p) => ({ id: p.id, name: p.name, slug: p.slug, color: p.color, stationCount: p.stationCount }))}
          />
        </Suspense>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={`${locativeKi(province.name)} şarj ağları`}>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-4 py-3">Ağ</th>
                  <th className="px-4 py-3 text-right">İstasyon</th>
                  <th className="px-4 py-3 text-right">DC</th>
                  <th className="px-4 py-3 text-right">DC kWh</th>
                </tr>
              </thead>
              <tbody>
                {d.providers.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5">
                      <Link href={`/sarj-aglari/${p.slug}`} className="flex items-center gap-2 hover:text-primary" title={`${p.name} şarj ücretleri`}>
                        <ProviderDot color={p.color} /> {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(p.count)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(p.dc)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtTl(p.minDcPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="İlçelere göre istasyonlar">
          <div className="max-h-[480px] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-4 py-3">İlçe</th>
                  <th className="px-4 py-3 text-right">İstasyon</th>
                  <th className="px-4 py-3 text-right">DC</th>
                  <th className="px-4 py-3 text-right">En yüksek güç</th>
                </tr>
              </thead>
              <tbody>
                {d.districts.map((x) => (
                  <tr key={x.slug} className="border-t">
                    <td className="px-4 py-2.5">{x.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(x.count)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(x.dc)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtKw(x.maxPowerKw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title={`${locativeKi(province.name)} en hızlı şarj istasyonları`}>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-4 py-3">İstasyon</th>
                <th className="px-4 py-3">Ağ</th>
                <th className="px-4 py-3">İlçe</th>
                <th className="px-4 py-3 text-right">Güç</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {d.fastest.map((s) => (
                <tr key={s.uid} className="border-t">
                  <td className="px-4 py-2.5">
                    <Link href={`/istasyon/${s.slug}`} className="font-medium hover:text-primary">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{s.provider.name}</td>
                  <td className="px-4 py-2.5">{s.district ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtKw(s.maxPowerKw)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {s.latitude != null && s.longitude != null && (
                      <a href={directionsUrl(s.latitude, s.longitude)} target="_blank" rel="noopener" className="text-primary hover:underline">
                        Yol tarifi
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
