import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "./env";

/**
 * Yapay zekâ özellikleri. İki sağlayıcı yolu vardır:
 *
 *  - anthropic: Claude (resmî SDK, yapılandırılmış çıktı `messages.parse`).
 *  - OpenAI uyumlu servisler: Gemini, Groq, OpenRouter veya herhangi bir uyumlu uç nokta. Bunların ücretsiz
 *    katmanları vardır; kotalar ve model adları sağlayıcıya göre değişir (bkz. .env.example).
 *
 *  - free: anahtar ve hesap gerektirmeyen ücretsiz servis (Pollinations, açık kaynak model). Hiçbir anahtar
 *    tanımlı değilse kendiliğinden kullanılır; böylece yapay zekâ özellikleri ek ayar olmadan çalışır.
 *
 * Sağlayıcı AI_PROVIDER ile seçilir. Seçilmemişse: AI_API_KEY varsa "gemini", yoksa ANTHROPIC_API_KEY varsa
 * "anthropic", o da yoksa "free". Seçilen sağlayıcının anahtarı eksikse yine "free" kullanılır. "none" kapatır.
 * Her iki yolda da yanıt zod şemasıyla doğrulanır.
 */

export class AiError extends Error {}

type CompatProvider = "free" | "gemini" | "groq" | "openrouter" | "custom";
type Provider = "anthropic" | CompatProvider;

const PRESETS: Record<Exclude<CompatProvider, "custom">, { baseUrl: string; model?: string; label: string }> = {
  // Anahtarsız (anonim) katman, ölçülen sınırlar (Kasım 2026): tek model (GPT-OSS 20B), IP başına 45 saniyede
  // 1 yanıt, yanıt başına en fazla 1.500 jeton (yaklaşık 550 kelime). Bu yüzden yalnızca yönetim panelindeki kısa
  // metinlerde (SEO meta, sosyal medya metni) kullanılır; çağrılar sıraya alınır. Blog yazısı gibi uzun içerik ve
  // herkese açık arama için anahtarlı bir sağlayıcı gerekir.
  free: { baseUrl: "https://text.pollinations.ai/openai", model: "openai", label: "Ücretsiz (Pollinations)" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-latest", label: "Google Gemini" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", label: "Groq" },
  // OpenRouter'da ücretsiz modeller ":free" ekiyle biter ve sık değişir; gerekirse AI_MODEL ile güncelleyin.
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "google/gemma-4-31b-it:free", label: "OpenRouter" },
};

interface AiConfig {
  provider: Provider;
  label: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** Etkin sağlayıcı ayarı; yapılandırma eksikse `null`. */
export function aiConfig(): AiConfig | null {
  const e = env();
  let chosen = e.AI_PROVIDER ?? (e.AI_API_KEY ? "gemini" : e.ANTHROPIC_API_KEY ? "anthropic" : "free");
  if (chosen === "none") return null;
  // Seçilen sağlayıcının anahtarı girilmemişse anahtarsız ücretsiz servise düşülür.
  if (chosen === "anthropic" ? !e.ANTHROPIC_API_KEY : chosen !== "free" && !e.AI_API_KEY) chosen = "free";

  if (chosen === "free") {
    const preset = PRESETS.free;
    return { provider: "free", label: preset.label, apiKey: "", model: preset.model!, baseUrl: preset.baseUrl };
  }

  if (chosen === "anthropic") {
    if (!e.ANTHROPIC_API_KEY) return null;
    const model = e.AI_MODEL?.startsWith("claude") ? e.AI_MODEL : "claude-opus-5-5";
    return { provider: "anthropic", label: "Claude", apiKey: e.ANTHROPIC_API_KEY, model };
  }

  if (!e.AI_API_KEY) return null;
  const preset = chosen === "custom" ? undefined : PRESETS[chosen];
  const baseUrl = (e.AI_BASE_URL ?? preset?.baseUrl)?.replace(/\/+$/, "");
  // AI_MODEL'de Claude için kalmış bir değer varsa bu sağlayıcıda geçersizdir; sağlayıcının varsayılanı kullanılır.
  const model = e.AI_MODEL && !e.AI_MODEL.startsWith("claude") ? e.AI_MODEL : preset?.model;
  if (!baseUrl || !model) return null;
  return { provider: chosen, label: preset?.label ?? "Özel servis", apiKey: e.AI_API_KEY, model, baseUrl };
}

export const isAiConfigured = () => aiConfig() !== null;

/** Anahtarsız katman 45 saniyede 1 yanıt verdiği için ziyaretçi aramalarında kullanılmaz. */
export const isAiSearchAvailable = () => {
  const cfg = aiConfig();
  return cfg !== null && cfg.provider !== "free";
};

// ── Anahtarsız katman için sıra: çağrılar tek tek ve en az FREE_INTERVAL_MS arayla gönderilir ──
const FREE_INTERVAL_MS = 46_000;
let freeQueue: Promise<void> = Promise.resolve();
let freeNextAt = 0;

function freeSlot(): Promise<void> {
  const turn = freeQueue.then(async () => {
    const wait = freeNextAt - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    freeNextAt = Date.now() + FREE_INTERVAL_MS;
  });
  freeQueue = turn.catch(() => {});
  return turn;
}

const NOT_CONFIGURED = "Yapay zekâ kapalı (AI_PROVIDER=none) veya seçilen sağlayıcının ayarı eksik.";

interface StructuredOptions<S extends z.ZodType> {
  system: string;
  prompt: string;
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
  /** Ziyaretçinin beklediği çağrılar (arama) için kısa süre sınırı; aşılırsa AiError. */
  timeoutMs?: number;
}

/** Anahtarsız katmanın yanıt başına jeton sınırı. */
const FREE_MAX_OUTPUT_TOKENS = 1500;

async function structured<S extends z.ZodType>(opts: StructuredOptions<S>): Promise<z.infer<S>> {
  const cfg = aiConfig();
  if (!cfg) throw new AiError(NOT_CONFIGURED);
  // Uzun içerik anahtarsız katmanın sınırına sığmaz; dakikalarca bekletip kesik yanıt almak yerine hemen bildirilir.
  if (cfg.provider === "free" && (opts.maxTokens ?? 16000) > 4000) {
    throw new AiError(
      "Anahtarsız ücretsiz servis yanıt başına yaklaşık 500 kelimeyle sınırlı olduğu için blog yazısı gibi uzun içerik üretemez. " +
        "Ücretsiz bir Gemini (aistudio.google.com/apikey) veya Groq (console.groq.com/keys) anahtarı alıp ortam değişkenlerine " +
        "AI_PROVIDER ve AI_API_KEY olarak ekleyin.",
    );
  }
  return cfg.provider === "anthropic" ? viaAnthropic(cfg, opts) : viaOpenAiCompatible(cfg, opts);
}

// ─────────────────────────── Claude ───────────────────────────

let client: Anthropic | undefined;

// Sunucu tarafı ret (refusal) yedeği desteklenen modeller
const FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

async function viaAnthropic<S extends z.ZodType>(cfg: AiConfig, opts: StructuredOptions<S>): Promise<z.infer<S>> {
  client ??= new Anthropic({ apiKey: cfg.apiKey });
  const withFallback = FALLBACK_MODELS.has(cfg.model);

  let response;
  try {
    response = await client.beta.messages.parse({
      model: cfg.model,
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

// ─────────────────────────── OpenAI uyumlu servisler (Gemini, Groq, OpenRouter…) ───────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string } | string;
}

/** Yanıt metninden JSON nesnesini ayıklar (kod bloğu veya çevresindeki metin olsa bile). */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON nesnesi bulunamadı");
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function chat(cfg: AiConfig, messages: ChatMessage[], maxTokens: number, jsonMode: boolean, timeoutMs = 180_000) {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      // Anahtarsız servislerde Authorization başlığı gönderilmez.
      headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new AiError(`${cfg.label} servisine ulaşılamadı: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => null)) as ChatResponse | ChatResponse[] | null;
  // Gemini hata gövdesini dizi içinde döndürebilir.
  const data = Array.isArray(body) ? body[0] : body;
  const errorMessage = typeof data?.error === "string" ? data.error : data?.error?.message;
  return { status: res.status, ok: res.ok, data, errorMessage };
}

async function viaOpenAiCompatible<S extends z.ZodType>(cfg: AiConfig, opts: StructuredOptions<S>): Promise<z.infer<S>> {
  // Ücretsiz katmanlarda dakikalık jeton sınırı düşüktür; çıktı üst sınırı buna göre tutulur.
  const maxTokens = Math.min(
    opts.maxTokens ?? 8000,
    env().AI_MAX_TOKENS ?? 8000,
    cfg.provider === "free" ? FREE_MAX_OUTPUT_TOKENS : Infinity,
  );
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `${opts.system}\n\n` +
        "Yanıtını YALNIZCA aşağıdaki JSON şemasına uyan tek bir JSON nesnesi olarak ver. " +
        "Açıklama, giriş cümlesi veya kod bloğu ekleme. Şemadaki tüm alanları doldur; değer yoksa null kullan.\n" +
        `JSON şeması:\n${JSON.stringify(z.toJSONSchema(opts.schema))}`,
    },
    { role: "user", content: opts.prompt },
  ];

  let jsonMode = true;
  let lastProblem = "";
  // En fazla 3 çağrı: JSON kipini desteklemeyen modelde kipsiz tekrar + şemaya uymayan yanıtta bir düzeltme turu.
  let limitWaits = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (cfg.provider === "free") await freeSlot();
    const r = await chat(cfg, messages, maxTokens, jsonMode, opts.timeoutMs);

    if (!r.ok) {
      // Anahtarsız katmanın hız sınırı: servis kaç saniye beklenmesi gerektiğini bildirir; bekleyip yeniden denenir.
      if (cfg.provider === "free" && (r.status === 402 || r.status === 429) && limitWaits < 2) {
        const seconds = Number(/retry after (\d+)\s*s/i.exec(r.errorMessage ?? "")?.[1] ?? 45);
        freeNextAt = Date.now() + (Math.min(seconds, 90) + 2) * 1000;
        limitWaits++;
        attempt--;
        continue;
      }
      if (cfg.provider === "free" && (r.status === 402 || r.status === 429)) {
        throw new AiError("Ücretsiz yapay zekâ servisi şu an yoğun. Bir dakika sonra yeniden deneyin.");
      }
      if (r.status === 400 && jsonMode && /response_format|json_object|json mode/i.test(r.errorMessage ?? "")) {
        jsonMode = false;
        continue;
      }
      if (r.status === 401 || r.status === 403) throw new AiError(`${cfg.label}: AI_API_KEY geçersiz veya yetkisiz.`);
      if (r.status === 404) throw new AiError(`${cfg.label}: "${cfg.model}" modeli bulunamadı. AI_MODEL değerini kontrol edin.`);
      if (r.status === 429 || r.status === 413) {
        throw new AiError(`${cfg.label} kotası veya hız sınırı doldu. Biraz sonra yeniden deneyin ya da daha kısa içerik isteyin.`);
      }
      throw new AiError(`${cfg.label} hatası (${r.status}): ${r.errorMessage ?? "bilinmeyen hata"}`);
    }

    const choice = r.data?.choices?.[0];
    const content = choice?.message?.content ?? "";
    if (choice?.finish_reason === "length") {
      throw new AiError("Yanıt uzunluk sınırına takıldı. Daha kısa bir içerik isteyin.");
    }
    if (choice?.finish_reason === "content_filter") throw new AiError("Yapay zekâ bu isteği yanıtlamadı.");

    try {
      const parsed = opts.schema.safeParse(extractJson(content));
      if (parsed.success) return parsed.data;
      lastProblem = parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "(kök)"}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastProblem = (e as Error).message;
    }
    messages.push(
      { role: "assistant", content },
      { role: "user", content: `Yanıtın şemaya uymuyor (${lastProblem}). Yalnızca şemaya uyan geçerli JSON nesnesini yeniden gönder.` },
    );
  }
  throw new AiError(`Yapay zekâ yanıtı beklenen biçimde değil (${lastProblem}). Yeniden deneyin.`);
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
    timeoutMs: 20_000,
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
