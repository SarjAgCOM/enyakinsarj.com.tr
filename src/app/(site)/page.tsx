import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  CaretDownIcon,
  CrosshairIcon,
  FunnelIcon,
  GaugeIcon,
  LightningIcon,
  MapTrifoldIcon,
  ReceiptIcon,
} from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { AiSearch } from "@/components/site/ai-search";
import { MapExplorer } from "@/components/map/map-explorer";
import { Section, StatGrid } from "@/components/site/page-header";
import { PostCard } from "@/components/site/post-card";
import { ProviderDot } from "@/components/site/station-card";
import { JsonLd } from "@/components/site/json-ld";
import { Reveal } from "@/components/site/reveal";
import { TaglineReveal } from "@/components/site/tagline-reveal";
import { getCityTable, getPriceTable, getStats, listProviders } from "@/server/services/stations";
import { listPublishedPosts } from "@/server/services/posts";
import { absoluteUrl, site } from "@/lib/site";
import { costPer100Km, fmtDate, fmtInt, fmtTl, hasPowerData } from "@/lib/format";

export const dynamic = "force-dynamic";

const BENEFITS = [
  {
    icon: MapTrifoldIcon,
    title: "Tüm ağlar tek haritada",
    text: "Her ağın uygulamasını ayrı ayrı açmanız gerekmez. Halka açık istasyonların tamamı aynı ekranda.",
  },
  {
    icon: ReceiptIcon,
    title: "Güncel kWh fiyatları",
    text: "AC ve DC ücretlerini ağ ağ karşılaştırın, 100 km yolun kaç liraya geldiğini görün.",
  },
  {
    icon: GaugeIcon,
    title: "Anlık soket doluluğu",
    text: "İstasyona gitmeden önce kaç soketin müsait olduğunu istasyon sayfasından kontrol edin.",
  },
  {
    icon: FunnelIcon,
    title: "Aracınıza uygun filtre",
    text: "CCS, Type 2 veya CHAdeMO seçin, en az gücü belirleyin. Yalnızca işinize yarayan istasyonlar kalsın.",
  },
];

const STEPS = [
  {
    title: "Konumunuzu paylaşın veya yazın",
    text: "En yakın istasyon butonuna basın ya da arama kutusuna il, ilçe veya ağ adını yazın.",
  },
  {
    title: "Soket ve güce göre daraltın",
    text: "Aracınızın soket tipini ve istediğiniz en az gücü seçin. Harita anında güncellenir.",
  },
  {
    title: "Yol tarifini alın",
    text: "İstasyonun fiyatına ve doluluğuna bakın, tek dokunuşla navigasyonu başlatın.",
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
  const networkNames = providers.slice(0, 6).map((p) => p.name);

  const faq = [
    {
      q: "En yakın şarj istasyonunu nasıl bulurum?",
      a: "Haritadaki “Bana en yakın istasyonlar” butonuna basın. Konumunuza en yakın istasyonlar mesafeye göre sıralanır. Soket tipi ve en az güç filtresiyle aracınıza uygun olanları seçebilirsiniz.",
    },
    {
      q: "DC ve AC şarj arasındaki fark nedir?",
      a: "AC şarj (Type 2) genellikle 7 ile 22 kW arasındadır ve uzun park sürelerine uygundur. DC hızlı şarj (CCS, CHAdeMO) 50 kW ile 400 kW üzeri güç sunar. Uygun araçlarda bataryayı yüzde 20'den yüzde 80'e yaklaşık 20 ile 40 dakikada doldurur.",
    },
    {
      q: "Hangi şarj ağları listeleniyor?",
      a: networkNames.length
        ? `${networkNames.join(", ")} ve diğer ağların halka açık istasyonları listelenir. Toplam ${fmtInt(stats.providers)} şarj ağı tek haritada yer alır.`
        : "Türkiye'de faaliyet gösteren şarj ağlarının halka açık istasyonları tek haritada listelenir.",
    },
    {
      q: "Şarj fiyatları ne sıklıkla güncellenir?",
      a: "İstasyon, soket ve fiyat verileri Şarjağ API üzerinden düzenli olarak yenilenir. Fiyatlar bilgilendirme amaçlıdır. Şarj öncesinde ilgili ağın uygulamasından teyit etmenizi öneririz.",
    },
    {
      q: "Anlık doluluk bilgisi nereden geliyor?",
      a: "İstasyon sayfasındaki “Anlık doluluk” butonuna bastığınızda soket durumları o anda Şarjağ üzerinden sorgulanır ve müsait, dolu veya arızalı olarak gösterilir.",
    },
    {
      q: "Aracıma uygun soketi nasıl seçerim?",
      a: "Avrupa pazarındaki araçların çoğu DC şarjda CCS, AC şarjda Type 2 kullanır. CHAdeMO bazı Japon modellerinde bulunur. Aracınızın kullanım kılavuzundaki soket tipini haritadaki filtreden seçebilirsiniz.",
    },
    {
      q: "Siteyi kullanmak ücretli mi?",
      a: "Hayır. Harita, fiyat karşılaştırması ve hesaplayıcı ücretsizdir ve üyelik gerektirmez.",
    },
  ];

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
          { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: site.url, logo: absoluteUrl("/icon.svg") },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />

      {/* Hero */}
      <section className="container-page flex flex-col items-center gap-6 pb-12 pt-10 text-center md:pt-16">
        <p className="chip caption-1 pointer-events-none">
          <LightningIcon aria-hidden weight="fill" className="size-4 text-primary" />
          {fmtInt(stats.stations)} istasyon, {fmtInt(stats.providers)} şarj ağı
        </p>
        <h1 className="heading-4 text-hero max-w-170 pb-2 sm:heading-3 md:heading-1">
          Size en yakın şarj istasyonunu
          <br className="hidden sm:block" /> saniyeler içinde bulun
        </h1>
        <p className="body-3 max-w-170 text-muted-foreground">
          Türkiye&apos;deki şarj ağlarının istasyonları, soket tipleri, güçleri ve güncel kWh fiyatları tek haritada. Ne
          aradığınızı yazın, yapay zekâ sizin için filtrelesin.
        </p>
        <div className="w-full max-w-3xl">
          <AiSearch />
        </div>
        <p className="caption-2 text-muted-foreground">Ücretsiz. Üyelik gerekmez.</p>
      </section>

      <div className="container-page">
        {/* Kanıt: canlı veriden rakamlar */}
        <Reveal>
          <StatGrid
            items={[
              { label: "Şarj istasyonu", value: fmtInt(stats.stations) },
              { label: "DC hızlı şarj", value: fmtInt(stats.dc), hint: "güç verisi paylaşan ağlarda" },
              { label: "150 kW ve üzeri", value: fmtInt(stats.ultra) },
              { label: "Şarj ağı", value: fmtInt(stats.providers), hint: `${stats.cities} ilde` },
            ]}
          />
          {stats.lastSyncedAt && (
            <p className="caption-5 mt-3 text-muted-foreground">
              Son güncelleme {fmtDate(stats.lastSyncedAt)}. Kaynak: Şarjağ API.
            </p>
          )}
        </Reveal>

        {/* Ürün: harita */}
        <Reveal>
          <Section
            id="harita"
            title="Şarj istasyonu haritası"
            subtitle="Ağ, soket tipi ve güce göre filtreleyin. Konumunuza en yakın istasyonları görün."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/sarj-haritasi">
                  Tam ekran aç <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            }
          >
            <Suspense>
              <MapExplorer providers={mapProviders} height="h-[560px]" />
            </Suspense>
          </Section>
        </Reveal>
      </div>

      {/* Slogan */}
      <section className="container-page py-24" aria-label="Neden En Yakın Şarj">
        <TaglineReveal lines={["Hangi ağ, hangi soket,", "kaç kilovat, kaç lira.", "Yola çıkmadan önce hepsini bilin."]} />
      </section>

      <div className="container-page">
        {/* Faydalar */}
        <Reveal>
          <Section id="faydalar" title="Şarj molanızı şansa bırakmayın">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b) => (
                <li key={b.title} className="surface-card flex flex-col gap-3 p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <b.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="title-3">{b.title}</h3>
                  <p className="body-6 text-muted-foreground">{b.text}</p>
                </li>
              ))}
            </ul>
          </Section>
        </Reveal>

        {/* Nasıl çalışır */}
        <Reveal>
          <Section id="nasil-calisir" title="Üç adımda şarj noktanız hazır">
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="surface-card flex flex-col gap-3 p-6">
                  <span className="caption-3 flex size-8 items-center justify-center rounded-lg bg-foreground text-background tabular-nums">
                    {i + 1}
                  </span>
                  <h3 className="title-3">{s.title}</h3>
                  <p className="body-6 text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </Section>
        </Reveal>

        {/* Şarj ağları */}
        {providers.length > 0 && (
          <Reveal>
            <Section
              id="aglar"
              title="Şarj ağları"
              subtitle="Her ağın kendi istasyon haritası, soket dağılımı ve fiyatları."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/sarj-aglari">
                    Tüm ağları gör <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {providers.slice(0, 12).map((p) => (
                  <Link key={p.id} href={`/sarj-aglari/${p.slug}`} className="surface-card-interactive flex flex-col gap-2 p-4">
                    <p className="title-3 flex items-center gap-2">
                      <ProviderDot color={p.color} />
                      <span className="truncate">{p.name}</span>
                    </p>
                    <p className="caption-2 text-muted-foreground">
                      <span className="caption-1 tabular-nums text-foreground">{fmtInt(p.stationCount)}</span> istasyon
                      {hasPowerData(p) && (
                        <>
                          , <span className="tabular-nums">{fmtInt(p.dcStationCount)}</span> DC
                        </>
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </Section>
          </Reveal>
        )}

        {/* Fiyatlar */}
        {prices.length > 0 && (
          <Reveal>
            <Section
              id="fiyatlar"
              title="En uygun DC şarj ücretleri"
              subtitle="kWh başına en düşük fiyatlar. 100 km maliyeti ortalama 17 kWh tüketimle hesaplanır."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/sarj-fiyatlari">
                    Tüm fiyatları gör <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Şarj ağı</th>
                      <th className="num">AC (₺/kWh)</th>
                      <th className="num">DC (₺/kWh)</th>
                      <th className="num">100 km (DC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.slice(0, 6).map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/sarj-aglari/${p.slug}`} className="body-5 flex items-center gap-2 hover:text-primary">
                            <ProviderDot color={p.color} /> {p.name}
                          </Link>
                        </td>
                        <td className="num">{fmtTl(p.minAcPrice)}</td>
                        <td className="num">
                          {fmtTl(p.minDcPrice)}
                          {p.maxDcPrice && p.minDcPrice && p.maxDcPrice > p.minDcPrice ? ` ile ${fmtTl(p.maxDcPrice)} arası` : ""}
                        </td>
                        <td className="num">{fmtTl(costPer100Km(p.minDcPrice))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </Reveal>
        )}

        {/* İller */}
        {cities.some((c) => c.count > 0) && (
          <Reveal>
            <Section id="iller" title="İl il şarj istasyonları" subtitle="En çok istasyon bulunan iller.">
              <div className="flex flex-wrap gap-2">
                {cities
                  .filter((c) => c.count > 0)
                  .slice(0, 24)
                  .map((c) => (
                    <Link key={c.slug} href={`/sarj-istasyonlari/${c.slug}`} className="chip">
                      {c.name} <span className="caption-2 tabular-nums text-muted-foreground">{fmtInt(c.count)}</span>
                    </Link>
                  ))}
                <Link href="/sarj-istasyonlari" className="chip text-primary">
                  81 ilin tamamı <ArrowRightIcon aria-hidden className="size-4" />
                </Link>
              </div>
            </Section>
          </Reveal>
        )}

        {/* Blog */}
        {posts.items.length > 0 && (
          <Reveal>
            <Section
              id="blog"
              title="Rehberler ve haberler"
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/blog">
                    Tüm yazıları gör <ArrowRightIcon data-icon="inline-end" />
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
          </Reveal>
        )}

        {/* SSS */}
        <Reveal>
          <Section id="sss" title="Sık sorulan sorular">
            <div className="grid gap-3 md:grid-cols-2">
              {faq.map((f) => (
                <details key={f.q} className="surface-card group p-6">
                  <summary className="title-3 flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <CaretDownIcon
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-500 ease-smooth group-open:rotate-180"
                    />
                  </summary>
                  <p className="body-6 mt-3 text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </Section>
        </Reveal>

        {/* Son çağrı */}
        <Reveal>
          <section className="my-10 flex flex-col items-center gap-6 rounded-3xl bg-foreground px-6 py-16 text-center text-background">
            <h2 className="heading-4 max-w-170 md:heading-3">Bir sonraki şarjınız için en yakın istasyonu şimdi bulun</h2>
            <p className="body-3 max-w-170 opacity-75">Ücretsiz. Üyelik gerekmez. Konum izni vermeniz yeterli.</p>
            <Button asChild size="lg">
              <Link href="/sarj-haritasi?yakinimda=1">
                <CrosshairIcon data-icon="inline-start" weight="bold" />
                En yakın istasyonu bul
              </Link>
            </Button>
          </section>
        </Reveal>
      </div>
    </>
  );
}
