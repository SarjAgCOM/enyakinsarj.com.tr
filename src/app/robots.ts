import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";

const DISALLOW = ["/admin", "/api/"];

/**
 * Yapay zekâ tarayıcıları: arama / yanıt motorlarının (ChatGPT, Claude, Perplexity, Gemini…) içeriği
 * okuyup kaynak göstermesine açıkça izin verilir. Genel kural zaten izin verir; adları ayrıca yazmak
 * niyeti belirsizliğe yer bırakmadan ortaya koyar.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "CCBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt", "/llms-full.txt"], disallow: DISALLOW },
    ],
    // /sitemap.xml bir dizindir; sayfa ve istasyon haritalarını (/sitemap/0.xml, /sitemap/1.xml …) listeler.
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
