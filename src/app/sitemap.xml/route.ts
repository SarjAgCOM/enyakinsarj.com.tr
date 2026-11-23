import { renderSitemapIndex, sitemapIds } from "@/server/services/sitemap";

export const dynamic = "force-dynamic";

/**
 * Site haritası dizini: /sitemap.xml
 * Arama motorları ve Search Console ilk olarak bu adresi dener. Dizin, sayfa haritasını (/sitemap/0.xml)
 * ve dolu olan istasyon parçalarını (/sitemap/1.xml …) listeler.
 */
export async function GET() {
  return new Response(renderSitemapIndex(await sitemapIds()), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
