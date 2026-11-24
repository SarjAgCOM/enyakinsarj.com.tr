import "server-only";
import { z } from "zod";

/**
 * Sunucu ortam değişkenleri. Doğrulama ilk erişimde yapılır; böylece `next build`
 * sırasında (ör. Docker imajı oluşturulurken) gizli anahtarlar olmadan derleme yapılabilir.
 */
const schema = z.object({
  // Docker'da bağlantı POSTGRES_* parçalarından kurulur (bkz. src/lib/database-url.ts)
  DATABASE_URL: z.string().optional(),
  APP_SECRET: z.string().min(32, "APP_SECRET en az 32 karakter olmalı"),
  CRON_SECRET: z.string().min(16).optional(),
  SARJAG_API_KEY: z.string().optional(),
  SARJAG_API_URL: z.string().url().default("https://console.sarjag.com/api/v1"),
  SYNC_INTERVAL_HOURS: z.coerce.number().positive().default(24),
  // Yapay zekâ: "anthropic" (Claude) veya OpenAI uyumlu ücretsiz servisler (bkz. src/server/ai.ts)
  // "free": anahtar gerektirmeyen ücretsiz servis (hiçbir anahtar yoksa varsayılan). "none": yapay zekâyı kapatır.
  // Boş değer (AI_PROVIDER=) tanımsız sayılır.
  AI_PROVIDER: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["free", "anthropic", "gemini", "groq", "openrouter", "custom", "none"]).optional(),
  ),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().optional(),
  AI_MAX_TOKENS: z.coerce.number().int().positive().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OCI_NAMESPACE: z.string().optional(),
  OCI_REGION: z.string().default("eu-frankfurt-1"),
  OCI_BUCKET: z.string().optional(),
  OCI_ACCESS_KEY_ID: z.string().optional(),
  OCI_SECRET_ACCESS_KEY: z.string().optional(),
  OCI_PUBLIC_BASE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ortam değişkenleri hatalı: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
