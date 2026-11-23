import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";
import { MapExplorer } from "@/components/map/map-explorer";
import { PageHeader, Section, StatGrid } from "@/components/site/page-header";
import { Markdown, extractFaq } from "@/components/site/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";
import { getProviderBySlug, listProviders } from "@/server/services/stations";
import { costPer100Km, fmtDate, fmtInt, fmtKw, fmtTl, standardLabel } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/sarj-aglari/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProviderBySlug(slug);
  if (!p) return { title: "Şarj ağı bulunamadı" };
  const year = new Date().getFullYear();
  return {
    title: `${p.name} Şarj İstasyonları ${year}: ${fmtInt(p.stationCount)} İstasyon Haritası ve kWh Fiyatları`,
    description: `${p.name} şarj ağının Türkiye'deki ${fmtInt(p.stationCount)} istasyonu haritada. ${fmtInt(p.dcStationCount)} DC hızlı şarj, en yüksek ${fmtKw(p.maxPowerKw)}${p.minDcPrice ? `, DC ${fmtTl(p.minDcPrice)}/kWh'den başlayan fiyatlar` : ""}.`,
    alternates: { canonical: `/sarj-aglari/${p.slug}` },
    openGraph: { title: `${p.name} şarj istasyonları haritası`, url: absoluteUrl(`/sarj-aglari/${p.slug}`) },
  };
}

export default async function ProviderPage({ params }: PageProps<"/sarj-aglari/[slug]">) {
  const { slug } = await params;
  const [p, providers] = await Promise.all([getProviderBySlug(slug), listProviders()]);
  if (!p) notFound();
  const faq = p.seoContent ? extractFaq(p.seoContent) : [];

  return (
    <div className="container-page">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: p.name,
            url: p.website ?? absoluteUrl(`/sarj-aglari/${p.slug}`),
            ...(p.logoUrl ? { logo: p.logoUrl } : {}),
            description: p.description ?? `${p.name} elektrikli araç şarj ağı`,
          },
          ...(faq.length
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
                },
              ]
            : []),
        ]}
      />
      <PageHeader
        crumbs={[
          { href: "/sarj-aglari", label: "Şarj ağları" },
          { href: `/sarj-aglari/${p.slug}`, label: p.name },
        ]}
        title={`${p.name} şarj istasyonları`}
        description={
          p.description ??
          `${p.name} ağına ait ${fmtInt(p.stationCount)} şarj istasyonunun haritası, soket dağılımı ve kWh fiyatları.`
        }
      >
        {p.website && (
          <Button asChild variant="outline" size="sm" className="self-start">
            <a href={p.website} target="_blank" rel="noopener">
              Resmi web sitesi <ArrowSquareOutIcon data-icon="inline-end" />
            </a>
          </Button>
        )}
      </PageHeader>

      <StatGrid
        items={[
          { label: "İstasyon", value: fmtInt(p.stationCount), hint: `${fmtInt(p.connectorCount)} soket` },
          { label: "DC hızlı şarj", value: fmtInt(p.dcStationCount) },
          { label: "150 kW ve üzeri", value: fmtInt(p.ultra) },
          { label: "En yüksek güç", value: fmtKw(p.maxPowerKw), hint: `${p.cities.length} ilde` },
        ]}
      />

      <div className="mt-6">
        <Suspense>
          <MapExplorer
            providerId={p.id}
            providers={providers.map((x) => ({ id: x.id, name: x.name, slug: x.slug, color: x.color, stationCount: x.stationCount }))}
          />
        </Suspense>
        <p className="caption-5 mt-3 text-muted-foreground">Son senkron {fmtDate(p.lastSyncedAt)}. Kaynak: Şarjağ API.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {(p.minAcPrice != null || p.minDcPrice != null) && (
            <Section title={`${p.name} şarj ücretleri`} subtitle="KDV dahil kWh fiyatları. İstasyona göre değişebilir.">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tip</th>
                      <th>En düşük</th>
                      <th>En yüksek</th>
                      <th>100 km</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="body-5">AC (Type 2)</td>
                      <td className="num">{fmtTl(p.minAcPrice)}</td>
                      <td className="num">{fmtTl(p.maxAcPrice)}</td>
                      <td className="num">{fmtTl(costPer100Km(p.minAcPrice))}</td>
                    </tr>
                    <tr>
                      <td className="body-5">DC (CCS, CHAdeMO)</td>
                      <td className="num">{fmtTl(p.minDcPrice)}</td>
                      <td className="num">{fmtTl(p.maxDcPrice)}</td>
                      <td className="num">{fmtTl(costPer100Km(p.minDcPrice))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {p.seoContent && (
            <Section title={`${p.name} hakkında`}>
              <Markdown content={p.seoContent} />
            </Section>
          )}
        </div>

        <aside className="space-y-6 py-8">
          {p.standards.length > 0 && (
            <div className="surface-card flex flex-col gap-3 p-6">
              <h2 className="title-3">Soket tipleri</h2>
              <ul className="body-6 flex flex-col gap-2">
                {p.standards.map((s) => (
                  <li key={s.standard} className="flex justify-between">
                    <span>{standardLabel(s.standard)}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtInt(s.count)} istasyon</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="surface-card flex flex-col gap-3 p-6">
            <h2 className="title-3">{p.name} istasyonu olan iller</h2>
            <ul className="body-6 flex max-h-96 flex-col gap-2 overflow-y-auto">
              {p.cities.map((c) => (
                <li key={c.slug} className="flex justify-between">
                  <Link href={`/sarj-istasyonlari/${c.slug}`} className="hover:text-primary">
                    {c.name}
                  </Link>
                  <span className="tabular-nums text-muted-foreground">{fmtInt(c.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
