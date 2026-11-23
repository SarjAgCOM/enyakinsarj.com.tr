import "server-only";
import { z } from "zod";

/**
 * Sunucu ortam değişkenleri. Doğrulama ilk erişimde yapılır; böylece `next build`
 * sırasında (ör. Docker imajı oluşturulurken) gizli anahtarlar olmadan derleme yapılabilir.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, "APP_SECRET en az 32 karakter olmalı"),
  CRON_SECRET: z.string().min(16).optional(),
  SARJAG_API_KEY: z.string().optional(),
  SARJAG_API_URL: z.string().url().default("https://console.sarjag.com/api/v1"),
  SYNC_INTERVAL_HOURS: z.coerce.number().positive().default(24),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),
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
