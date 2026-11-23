import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "./env";

/**
 * Yapay zekâ özellikleri (Claude). Varsayılan model: claude-opus-5-5 (AI_MODEL ile değiştirilebilir).
 * Yanıtlar zod şemalarıyla yapılandırılmış çıktı olarak alınır (`messages.parse`).
 */

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY }));

export const isAiConfigured = () => Boolean(env().ANTHROPIC_API_KEY);

export class AiError extends Error {}

// Sunucu tarafı ret (refusal) yedeği desteklenen modeller
const FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

async function structured<S extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!isAiConfigured()) throw new AiError("ANTHROPIC_API_KEY tanımlı değil.");
  const model = env().AI_MODEL;
  const withFallback = FALLBACK_MODELS.has(model);

  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Yapay zekâ servisi şu an yoğun, biraz sonra tekrar deneyin.");
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("ANTHROPIC_API_KEY geçersiz.");
    if (e instanceof Anthropic.APIError) throw new AiError(`Yapay zekâ hatası (${e.status}): ${e.message}`);
    throw e;
  }

  if (response.stop_reason === "refusal") throw new AiError("Yapay zekâ bu isteği yanıtlamadı.");
  if (response.stop_reason === "max_tokens") throw new AiError("Yanıt uzunluk sınırına takıldı; daha kısa bir içerik isteyin.");
  if (!response.parsed_output) throw new AiError("Yapay zekâ yanıtı beklenen biçimde değil.");
  return response.parsed_output as z.infer<S>;
}

// ─────────────────────────── Doğal dilde istasyon arama ───────────────────────────

export const searchIntentSchema = z.object({
  citySlug: z.string().nullable().describe("İl slug'ı (listeden), yoksa null"),
  districtSlug: z.string().nullable().describe("İlçe adı küçük harf ASCII slug (ör. kadikoy), yoksa null"),
  providerIds: z.array(z.string()).describe("Belirtilen şarj ağlarının id'leri (listeden)"),
  minPowerKw: z.number().nullable().describe("En az güç (kW). 'hızlı' ≈ 50, 'ultra hızlı' ≈ 150"),
  dcOnly: z.boolean(),
  standards: z.array(z.enum(["CCS2", "TYPE2", "CHADEMO"])),
  sort: z.enum(["distance", "power", "price"]),
  useMyLocation: z.boolean().describe("Kullanıcı 'yakınımda', 'bana en yakın' gibi konumuna göre arıyorsa true"),
  query: z.string().nullable().describe("Belirli bir yer/tesis adı aranıyorsa (ör. 'Forum AVM'), yoksa null"),
  reply: z.string().describe("Kullanıcıya ne arandığını anlatan tek kısa Türkçe cümle"),
});
export type SearchIntent = z.infer<typeof searchIntentSchema>;

export async function parseSearchIntent(query: string, ctx: { providers: { id: string; name: string }[]; cities: { slug: string; name: string }[] }) {
  return structured({
    effort: "low",
    maxTokens: 4000,
    schema: searchIntentSchema,
    system:
      "Türkiye'deki elektrikli araç şarj istasyonu arama asistanısın. Kullanıcının doğal dildeki isteğini arama filtrelerine çevir. " +
      "Yalnızca verilen listelerdeki il slug'larını ve ağ id'lerini kullan; emin değilsen null/boş bırak. " +
      "Soket eşlemesi: CCS/CCS2/DC hızlı → CCS2, Type 2/AC → TYPE2, CHAdeMO → CHADEMO.",
    prompt: [
      `Şarj ağları (id: ad): ${ctx.providers.map((p) => `${p.id}: ${p.name}`).join(", ")}`,
      `İller (slug: ad): ${ctx.cities.map((c) => `${c.slug}: ${c.name}`).join(", ")}`,
      "",
      `Kullanıcı isteği: """${query.slice(0, 500)}"""`,
    ].join("\n"),
  });
}

// ─────────────────────────── Blog yazısı üretimi ───────────────────────────

export const generatedPostSchema = z.object({
  title: z.string().describe("Tıklanabilir, SEO uyumlu başlık (55-65 karakter)"),
  slug: z.string().describe("Türkçe karaktersiz, tireli URL slug'ı"),
  excerpt: z.string().describe("1-2 cümlelik özet (150-200 karakter)"),
  content: z.string().describe("Markdown gövde: H2/H3 başlıklar, listeler, gerektiğinde tablo; H1 kullanma"),
  seoTitle: z.string().describe("Meta title (en fazla 60 karakter)"),
  seoDescription: z.string().describe("Meta description (140-160 karakter)"),
  keywords: z.array(z.string()).describe("5-10 anahtar kelime"),
  tags: z.array(z.string()).describe("3-6 etiket"),
  coverImageAlt: z.string().describe("Kapak görseli için açıklayıcı alt metin"),
  socialX: z.string().describe("X (Twitter) gönderisi, en fazla 240 karakter, 1-2 hashtag, {url} yer tutucusu içermeli"),
  socialInstagram: z.string().describe("Instagram açıklaması: 3-5 kısa paragraf, emoji olabilir, sonunda 8-12 hashtag; link yerine 'bio'daki bağlantı' ifadesi"),
});
export type GeneratedPost = z.infer<typeof generatedPostSchema>;

export async function generateBlogPost(input: {
  topic: string;
  keywords?: string[];
  tone?: "bilgilendirici" | "samimi" | "teknik" | "haber";
  length?: "kisa" | "orta" | "uzun";
  instructions?: string;
  categoryName?: string;
  dataContext?: string;
}) {
  const words = { kisa: "600-800", orta: "1000-1400", uzun: "1800-2400" }[input.length ?? "orta"];
  return structured({
    effort: "high",
    maxTokens: 16000,
    schema: generatedPostSchema,
    system:
      "Sen enyakinsarj.com.tr için yazan, Türkiye elektrikli araç (EV) ve şarj altyapısı konusunda uzman bir editörsün. " +
      "Akıcı, doğru ve özgün Türkçe yazarsın. Arama motorları ve yapay zekâ asistanları için optimize edilmiş içerik üretirsin: " +
      "net başlık hiyerarşisi, ilk paragrafta doğrudan cevap, kısa paragraflar, SSS bölümü (### soru formatında), somut sayılar. " +
      "Sana verilen güncel veri özetindeki sayıları kullanabilirsin; bunların dışında kesin fiyat veya istatistik uydurma — " +
      "emin olmadığın bilgileri genel ifadelerle anlat. İç bağlantı olarak /sarj-haritasi, /sarj-fiyatlari, /sarj-aglari ve " +
      "/hesaplayicilar/sarj-maliyeti sayfalarına uygun yerlerde markdown link ver.",
    prompt: [
      `Konu: ${input.topic}`,
      input.categoryName ? `Kategori: ${input.categoryName}` : "",
      input.keywords?.length ? `Hedef anahtar kelimeler: ${input.keywords.join(", ")}` : "",
      `Ton: ${input.tone ?? "bilgilendirici"}`,
      `Uzunluk: yaklaşık ${words} kelime`,
      input.instructions ? `Ek talimatlar: ${input.instructions}` : "",
      input.dataContext ? `\nGüncel site verisi (kaynak: Şarjağ API, bugün itibarıyla):\n${input.dataContext}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

// ─────────────────────────── SEO meta & sosyal medya metinleri ───────────────────────────

export const seoMetaSchema = z.object({
  seoTitle: z.string(),
  seoDescription: z.string(),
  excerpt: z.string(),
  keywords: z.array(z.string()),
  tags: z.array(z.string()),
});

export async function generateSeoMeta(input: { title: string; content: string }) {
  return structured({
    effort: "low",
    maxTokens: 4000,
    schema: seoMetaSchema,
    system:
      "Türkçe SEO uzmanısın. Verilen blog yazısı için meta title (≤60 karakter), meta description (140-160 karakter), " +
      "150-200 karakterlik özet, 5-10 anahtar kelime ve 3-6 etiket üret.",
    prompt: `Başlık: ${input.title}\n\nİçerik:\n${input.content.slice(0, 20000)}`,
  });
}

export const socialCopySchema = z.object({
  socialX: z.string(),
  socialInstagram: z.string(),
});

export async function generateSocialCopy(input: { title: string; excerpt?: string | null; content: string }) {
  return structured({
    effort: "low",
    maxTokens: 4000,
    schema: socialCopySchema,
    system:
      "Bir elektrikli araç şarj platformunun sosyal medya editörüsün. X için en fazla 240 karakterlik, {url} yer tutucusu içeren " +
      "dikkat çekici bir gönderi; Instagram için emoji içerebilen, sonunda 8-12 Türkçe/İngilizce hashtag bulunan, link yerine " +
      "'bio'daki bağlantı' diyen bir açıklama yaz.",
    prompt: `Başlık: ${input.title}\nÖzet: ${input.excerpt ?? ""}\n\nİçerik:\n${input.content.slice(0, 8000)}`,
  });
}

// ─────────────────────────── Şarj ağı sayfası SEO metni ───────────────────────────

export async function generateProviderContent(input: { name: string; website?: string | null; stats: string }) {
  const out = await structured({
    effort: "medium",
    maxTokens: 8000,
    schema: z.object({ content: z.string().describe("Markdown, H2/H3 başlıklı, 350-600 kelime, sonunda SSS") }),
    system:
      "Türkiye'deki şarj ağları hakkında tarafsız, bilgilendirici ve SEO uyumlu Türkçe sayfa metinleri yazıyorsun. " +
      "Yalnızca verilen istatistikleri kesin bilgi olarak kullan; kampanya, abonelik veya fiyat uydurma. H1 kullanma.",
    prompt: `Şarj ağı: ${input.name}\nWeb sitesi: ${input.website ?? "-"}\n\nGüncel veriler:\n${input.stats}`,
  });
  return out.content;
}
