import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, BadgeCheckIcon, CalculatorIcon, MapIcon, ReceiptIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiSearch } from "@/components/site/ai-search";
import { MapExplorer } from "@/components/map/map-explorer";
import { Section, StatGrid } from "@/components/site/page-header";
import { PostCard } from "@/components/site/post-card";
import { ProviderDot } from "@/components/site/station-card";
import { JsonLd } from "@/components/site/json-ld";
import { SarjagAppBadges } from "@/components/site/app-badges";
import { getCityTable, getPriceTable, getStats, listProviders } from "@/server/services/stations";
import { listPublishedPosts } from "@/server/services/posts";
import { absoluteUrl, site } from "@/lib/site";
import { costPer100Km, fmtDate, fmtInt, fmtTl } from "@/lib/format";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "En yakın şarj istasyonunu nasıl bulurum?",
    a: "Şarj haritasında “Bana en yakın istasyonlar” butonuna basarak konumunuza en yakın istasyonları mesafeye göre sıralayabilir, soket tipi ve en az güç filtresiyle aracınıza uygun olanları seçebilirsiniz.",
  },
  {
    q: "DC ve AC şarj arasındaki fark nedir?",
    a: "AC şarj (Type 2) genellikle 7–22 kW güçtedir ve uzun park sürelerine uygundur. DC hızlı şarj (CCS, CHAdeMO) 50 kW ile 400 kW üzeri güç sunar; uygun araçlarda %20'den %80'e 20–40 dakikada şarj sağlar.",
  },
  {
    q: "Şarj fiyatları ne sıklıkla güncellenir?",
    a: "İstasyon, soket ve fiyat verileri Şarjağ API üzerinden düzenli olarak senkronlanır. Fiyatlar bilgilendirme amaçlıdır; şarj öncesinde ilgili ağın uygulamasından teyit etmenizi öneririz.",
  },
  {
    q: "Hangi şarj ağları listeleniyor?",
    a: "ZES, Eşarj, Trugo, WAT Mobilite, Otopriz, Astor, EnYakıt, Ovolt ve daha birçok şarj ağının halka açık istasyonları tek haritada listelenir.",
  },
];

export default async function HomePage() {
  const [stats, providers, prices, cities, posts] = await Promise.all([
    getStats(),
    listProviders(),
    getPriceTable(),
    getCityTable(),
    listPublishedPosts({ take: 3 }),
  ]);
  const mapProviders = providers.map((p) => ({ id: p.id, name: p.name, slug: p.slug, color: p.color, stationCount: p.stationCount }));

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.name,
            url: site.url,
            inLanguage: "tr-TR",
            potentialAction: {
              "@type": "SearchAction",
              target: `${absoluteUrl("/sarj-istasyonlari")}?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: site.name,
            url: site.url,
            logo: absoluteUrl("/icon.svg"),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-4xl px-4 pb-14 pt-16 text-center md:pt-24">
          <Badge variant="secondary" className="mb-5">
            <ZapIcon data-icon="inline-start" /> {fmtInt(stats.stations)} istasyon · {stats.providers} şarj ağı · tek harita
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Size <span className="text-primary">en yakın şarj istasyonunu</span> saniyeler içinde bulun
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Türkiye&apos;deki tüm şarj ağlarının istasyonları, soket tipleri, güçleri ve güncel kWh fiyatları. Ne aradığınızı
            yazın, yapay zekâ sizin için filtrelesin.
          </p>
          <div className="mx-auto mt-8 max-w-3xl">
            <AiSearch />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <div className="py-8">
          <StatGrid
            items={[
              { label: "Şarj istasyonu", value: fmtInt(stats.stations) },
              { label: "DC hızlı şarj", value: fmtInt(stats.dc) },
              { label: "150 kW ve üzeri", value: fmtInt(stats.ultra) },
              { label: "Şarj ağı", value: fmtInt(stats.providers), hint: `${stats.cities} ilde` },
            ]}
          />
          {stats.lastSyncedAt && (
            <p className="mt-2 text-xs text-muted-foreground">Son güncelleme: {fmtDate(stats.lastSyncedAt)} · Kaynak: Şarjağ API</p>
          )}
        </div>

        <Section
          id="harita"
          title="Şarj istasyonu haritası"
          subtitle="Ağ, soket tipi ve güce göre filtreleyin; konumunuza en yakın istasyonları görün."
          action={
            <Button asChild variant="outline">
              <Link href="/sarj-haritasi">
                Tam ekran <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          }
        >
          <Suspense>
            <MapExplorer providers={mapProviders} height="h-[560px]" />
          </Suspense>
        </Section>

        <Section
          id="aglar"
          title="Şarj ağları"
          subtitle="Her ağın kendi istasyon haritası, soket dağılımı ve fiyatları"
          action={
            <Button asChild variant="ghost">
              <Link href="/sarj-aglari">
                Tüm ağlar <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {providers.slice(0, 12).map((p) => (
              <Link
                key={p.id}
                href={`/sarj-aglari/${p.slug}`}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <p className="flex items-center gap-2 font-semibold">
                  <ProviderDot color={p.color} />
                  <span className="truncate">{p.name}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium tabular-nums text-foreground">{fmtInt(p.stationCount)}</span> istasyon ·{" "}
                  {fmtInt(p.dcStationCount)} DC
                </p>
                <p className="mt-1 text-xs text-muted-foreground group-hover:text-primary">Haritayı gör →</p>
              </Link>
            ))}
          </div>
        </Section>

        {prices.length > 0 && (
          <Section
            id="fiyatlar"
            title="En uygun DC şarj ücretleri"
            subtitle={`kWh başına en düşük fiyatlar; 100 km maliyeti ortalama 17 kWh/100 km tüketimle hesaplanır.`}
            action={
              <Button asChild variant="ghost">
                <Link href="/sarj-fiyatlari">
                  Tüm fiyatlar <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            }
          >
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Şarj ağı</th>
                    <th className="px-4 py-3 font-semibold">AC (₺/kWh)</th>
                    <th className="px-4 py-3 font-semibold">DC (₺/kWh)</th>
                    <th className="px-4 py-3 font-semibold">100 km (DC)</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.slice(0, 6).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">
                        <Link href={`/sarj-aglari/${p.slug}`} className="flex items-center gap-2 font-medium hover:text-primary">
                          <ProviderDot color={p.color} /> {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(p.minAcPrice)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {fmtTl(p.minDcPrice)}
                        {p.maxDcPrice && p.minDcPrice && p.maxDcPrice > p.minDcPrice ? ` – ${fmtTl(p.maxDcPrice)}` : ""}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{fmtTl(costPer100Km(p.minDcPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section id="araclar" title="Şarjınızı planlayın">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { href: "/sarj-haritasi?yakinimda=1", icon: MapIcon, title: "En yakın istasyon", text: "Konumunuza göre en yakın ve en hızlı istasyonları bulun." },
              { href: "/hesaplayicilar/sarj-maliyeti", icon: CalculatorIcon, title: "Şarj maliyeti", text: "Bir dolum ve 100 km kaç TL? Benzinle karşılaştırın." },
              { href: "/sarj-fiyatlari", icon: ReceiptIcon, title: "Fiyat karşılaştırma", text: "Ağların AC/DC kWh ücretlerini yan yana görün." },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="group rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40">
                <c.icon className="size-7 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </Link>
            ))}
          </div>
        </Section>

        <Section id="iller" title="İl il şarj istasyonları" subtitle="En çok istasyon bulunan iller">
          <div className="flex flex-wrap gap-2">
            {cities
              .filter((c) => c.count > 0)
              .slice(0, 24)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/sarj-istasyonlari/${c.slug}`}
                  className="rounded-full border bg-card px-3.5 py-1.5 text-sm hover:border-primary/40 hover:text-primary"
                >
                  {c.name} <span className="text-muted-foreground tabular-nums">({fmtInt(c.count)})</span>
                </Link>
              ))}
            <Link href="/sarj-istasyonlari" className="rounded-full px-3.5 py-1.5 text-sm font-medium text-primary">
              81 ilin tamamı →
            </Link>
          </div>
        </Section>

        {posts.items.length > 0 && (
          <Section
            id="blog"
            title="Rehberler ve haberler"
            action={
              <Button asChild variant="ghost">
                <Link href="/blog">
                  Blog <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            }
          >
            <div className="grid gap-6 md:grid-cols-3">
              {posts.items.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </Section>
        )}

        <Section id="sss" title="Sık sorulan sorular">
          <div className="grid gap-4 md:grid-cols-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-start gap-2">
                    <BadgeCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                    {f.q}
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="my-10 grid items-center gap-6 rounded-3xl bg-primary px-6 py-10 text-primary-foreground md:grid-cols-[1fr_auto] md:px-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Yoldayken de yanınızda: Şarjağ uygulaması</h2>
            <p className="mt-2 max-w-xl opacity-85">
              Tüm şarj ağlarını tek uygulamada görün, anlık soket doluluğunu kontrol edin ve rotanızı planlayın.
            </p>
          </div>
          <SarjagAppBadges className="[&_a]:bg-primary-foreground [&_a]:text-primary" />
        </section>
      </div>
    </>
  );
}
