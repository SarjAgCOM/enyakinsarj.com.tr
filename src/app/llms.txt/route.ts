import { getStats, listProviders } from "@/server/services/stations";
import { listPublishedPosts } from "@/server/services/posts";
import { absoluteUrl, site } from "@/lib/site";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Yapay zekâ asistanları / arama motorları için site özeti (llmstxt.org). */
export async function GET() {
  const [stats, providers, posts] = await Promise.all([getStats(), listProviders(), listPublishedPosts({ take: 30 })]);
  const body = `# ${site.name}

> ${site.description}

Türkiye genelinde ${fmtInt(stats.stations)} halka açık şarj istasyonu (${fmtInt(stats.dc)} DC hızlı şarj), ${stats.providers} şarj ağı ve ${stats.cities} il. Veriler Şarjağ API üzerinden düzenli güncellenir.

## Ana sayfalar
- [Şarj istasyonu haritası](${absoluteUrl("/sarj-haritasi")}): Tüm istasyonlar, ağ/soket/güç filtresi, en yakın istasyon
- [Şarj ağları](${absoluteUrl("/sarj-aglari")}): Her ağın istasyon haritası ve fiyatları
- [Şarj fiyatları](${absoluteUrl("/sarj-fiyatlari")}): AC/DC kWh ücret karşılaştırması
- [İl il şarj istasyonları](${absoluteUrl("/sarj-istasyonlari")}): 81 il için istasyon sayıları ve haritalar
- [Şarj maliyeti hesaplayıcı](${absoluteUrl("/hesaplayicilar/sarj-maliyeti")})

## Şarj ağları
${providers.map((p) => `- [${p.name}](${absoluteUrl(`/sarj-aglari/${p.slug}`)}): ${fmtInt(p.stationCount)} istasyon, ${fmtInt(p.dcStationCount)} DC`).join("\n")}

## Blog
${posts.items.map((p) => `- [${p.title}](${absoluteUrl(`/blog/${p.slug}`)})${p.excerpt ? `: ${p.excerpt}` : ""}`).join("\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
