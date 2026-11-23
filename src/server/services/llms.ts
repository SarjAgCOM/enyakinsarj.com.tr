import "server-only";
import { getCityTable, getPriceTable, getStats, listProviders } from "./stations";
import { listPublishedPosts } from "./posts";
import { absoluteUrl, site } from "@/lib/site";
import { AVG_KWH_PER_100KM, costPer100Km, fmtDate, fmtInt, fmtKw, fmtTl, hasPowerData } from "@/lib/format";

/**
 * llms.txt (llmstxt.org): yapay zekâ asistanları için sitenin kısa, bağlantılı özeti.
 * `full` sürümü tüm ağları, illeri ve fiyat tablosunu düz metin olarak içerir; böylece bir model
 * sayfaları tek tek gezmeden güncel rakamlara ulaşabilir.
 */
export async function buildLlmsTxt(full: boolean) {
  const [stats, providers, prices, cities, posts] = await Promise.all([
    getStats(),
    listProviders(),
    getPriceTable(),
    getCityTable(),
    listPublishedPosts({ take: full ? 100 : 30 }),
  ]);
  const activeCities = cities.filter((c) => c.count > 0);
  const providerLine = (p: (typeof providers)[number]) => {
    const parts = [`${fmtInt(p.stationCount)} istasyon`];
    // Güç verisi paylaşmayan ağlarda DC sayısı bilinmez; 0 yazmak yanıltıcı olur.
    if (hasPowerData(p)) parts.push(`${fmtInt(p.dcStationCount)} DC hızlı şarj`);
    if (p.maxPowerKw != null) parts.push(`en yüksek ${fmtKw(p.maxPowerKw)}`);
    if (full && p.minDcPrice != null) parts.push(`DC ${fmtTl(p.minDcPrice)}/kWh'den`);
    if (full && p.minAcPrice != null) parts.push(`AC ${fmtTl(p.minAcPrice)}/kWh'den`);
    return `- [${p.name}](${absoluteUrl(`/sarj-aglari/${p.slug}`)}): ${parts.join(", ")}`;
  };

  const lines: string[] = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `Türkiye genelinde ${fmtInt(stats.stations)} halka açık elektrikli araç şarj istasyonu, ${fmtInt(stats.providers)} şarj ağı ve ${stats.cities} il listelenir. ` +
      `Güç verisi paylaşan ağlarda ${fmtInt(stats.dc)} DC hızlı şarj istasyonu, bunların ${fmtInt(stats.ultra)} tanesi 150 kW ve üzeridir. ` +
      `Veriler Şarjağ API üzerinden düzenli olarak güncellenir${stats.lastSyncedAt ? ` (son güncelleme: ${fmtDate(stats.lastSyncedAt)})` : ""}. ` +
      "Fiyatlar bilgilendirme amaçlıdır; kesin fiyat için ilgili ağın uygulamasına bakılmalıdır.",
    "",
    "Kullanım notları:",
    "- Bir ilin istasyonları için `/sarj-istasyonlari/{il}` (örnek: `/sarj-istasyonlari/istanbul`), bir ağ için `/sarj-aglari/{ag}` adresini kullanın.",
    "- Tek istasyon sayfaları `/istasyon/{slug}` biçimindedir; adres, soketler, güç ve tarife bilgisi içerir.",
    "- Bazı ağlar güç ve soket ayrıntısı paylaşmaz; bu ağlarda DC sayısı ve en yüksek güç belirtilmez.",
    "",
    "## Ana sayfalar",
    `- [Şarj istasyonu haritası](${absoluteUrl("/sarj-haritasi")}): Tüm istasyonlar; ağ, soket ve güç filtresi; en yakın istasyon`,
    `- [Şarj ağları](${absoluteUrl("/sarj-aglari")}): Her ağın istasyon haritası ve fiyatları`,
    `- [Şarj fiyatları](${absoluteUrl("/sarj-fiyatlari")}): AC ve DC kWh ücret karşılaştırması`,
    `- [İl il şarj istasyonları](${absoluteUrl("/sarj-istasyonlari")}): 81 il için istasyon sayıları ve haritalar`,
    `- [Şarj maliyeti hesaplayıcı](${absoluteUrl("/hesaplayicilar/sarj-maliyeti")}): Bir şarjın ve 100 km'nin maliyeti`,
    `- [Blog](${absoluteUrl("/blog")}): Şarj rehberleri ve haberler`,
    "",
    "## Şarj ağları",
    ...(full ? providers : providers.slice(0, 20)).map(providerLine),
  ];

  if (prices.length) {
    lines.push(
      "",
      "## En düşük kWh fiyatları",
      `KDV dahil, istasyona göre değişebilir. 100 km maliyeti ${AVG_KWH_PER_100KM} kWh/100 km tüketimle hesaplanır.`,
      ...(full ? prices : prices.slice(0, 8)).map(
        (p) =>
          `- ${p.name}: AC ${fmtTl(p.minAcPrice)}, DC ${fmtTl(p.minDcPrice)}` +
          (p.minDcPrice != null ? `, 100 km (DC) yaklaşık ${fmtTl(costPer100Km(p.minDcPrice))}` : ""),
      ),
    );
  }

  lines.push(
    "",
    "## İller",
    ...(full ? activeCities : activeCities.slice(0, 15)).map(
      (c) => `- [${c.name}](${absoluteUrl(`/sarj-istasyonlari/${c.slug}`)}): ${fmtInt(c.count)} istasyon, ${fmtInt(c.dc)} DC`,
    ),
  );

  if (posts.items.length) {
    lines.push(
      "",
      "## Blog",
      ...posts.items.map((p) => `- [${p.title}](${absoluteUrl(`/blog/${p.slug}`)})${p.excerpt ? `: ${p.excerpt}` : ""}`),
    );
  }

  lines.push(
    "",
    "## Diğer",
    `- [Site haritası](${absoluteUrl("/sitemap.xml")})`,
    `- [RSS](${absoluteUrl("/blog/rss.xml")})`,
    full ? `- [Kısa sürüm](${absoluteUrl("/llms.txt")})` : `- [Ayrıntılı sürüm: tüm ağlar, iller ve fiyatlar](${absoluteUrl("/llms-full.txt")})`,
    `- [Hakkımızda](${absoluteUrl("/hakkimizda")}) · [Kullanım şartları](${absoluteUrl("/kullanim-sartlari")})`,
    "",
  );
  return lines.join("\n");
}
