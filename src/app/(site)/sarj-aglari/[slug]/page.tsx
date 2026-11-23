import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLinkIcon } from "lucide-react";
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
    <div className="mx-auto max-w-7xl px-4">
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
          { href: "/sarj-aglari", label: "Şarj Ağları" },
          { href: `/sarj-aglari/${p.slug}`, label: p.name },
        ]}
        title={`${p.name} şarj istasyonları`}
        description={
          p.description ??
          `${p.name} ağına ait ${fmtInt(p.stationCount)} şarj istasyonunun haritası, soket dağılımı ve kWh fiyatları.`
        }
      >
        {p.website && (
          <Button asChild variant="outline" size="sm">
            <a href={p.website} target="_blank" rel="noopener">
              Resmi web sitesi <ExternalLinkIcon data-icon="inline-end" />
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
        <p className="mt-2 text-xs text-muted-foreground">Son senkron: {fmtDate(p.lastSyncedAt)} · Kaynak: Şarjağ API</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {(p.minAcPrice != null || p.minDcPrice != null) && (
            <Section title={`${p.name} şarj ücretleri`} subtitle="KDV dahil kWh fiyatları; istasyona göre değişebilir.">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="px-4 py-3">Tip</th>
                      <th className="px-4 py-3">En düşük</th>
                      <th className="px-4 py-3">En yüksek</th>
                      <th className="px-4 py-3">100 km</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-4 py-3 font-medium">AC (Type 2)</td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(p.minAcPrice)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(p.maxAcPrice)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(costPer100Km(p.minAcPrice))}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-4 py-3 font-medium">DC (CCS / CHAdeMO)</td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(p.minDcPrice)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(p.maxDcPrice)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(costPer100Km(p.minDcPrice))}</td>
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
            <div className="rounded-xl border p-5">
              <h2 className="font-semibold">Soket tipleri</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {p.standards.map((s) => (
                  <li key={s.standard} className="flex justify-between">
                    <span>{standardLabel(s.standard)}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtInt(s.count)} istasyon</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-xl border p-5">
            <h2 className="font-semibold">{p.name} istasyonu olan iller</h2>
            <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto text-sm">
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
