import "server-only";
import { z } from "zod";

/**
 * Instagram Graph API (İşletme/Creator hesabı) ile görselli gönderi paylaşımı.
 * Akış: medya konteyneri oluştur → hazır olmasını bekle → yayınla.
 * Gereken: Facebook sayfasına bağlı IG hesabının kullanıcı id'si ve uzun ömürlü erişim anahtarı
 * (instagram_basic, instagram_content_publish izinleri).
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export const instagramCredentialsSchema = z.object({
  igUserId: z.string().min(1),
  accessToken: z.string().min(1),
});
export type InstagramCredentials = z.infer<typeof instagramCredentialsSchema>;

async function graph<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams(params);
  if (method === "GET") for (const [k, v] of body) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message: string } }) | null;
  if (!res.ok || !json || json.error) throw new Error(`Instagram API ${res.status}: ${json?.error?.message ?? res.statusText}`);
  return json;
}

export async function postToInstagram(creds: InstagramCredentials, input: { imageUrl: string; caption: string }) {
  const container = await graph<{ id: string }>(`${creds.igUserId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption.slice(0, 2200),
    access_token: creds.accessToken,
  });

  for (let i = 0; i < 15; i++) {
    const status = await graph<{ status_code?: string }>(
      container.id,
      { fields: "status_code", access_token: creds.accessToken },
      "GET",
    );
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram medya işlenemedi (${status.status_code}). Görsel herkese açık bir JPEG/PNG olmalı.`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const published = await graph<{ id: string }>(`${creds.igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: creds.accessToken,
  });
  const info = await graph<{ permalink?: string }>(
    published.id,
    { fields: "permalink", access_token: creds.accessToken },
    "GET",
  ).catch(() => ({ permalink: undefined }));
  return { externalId: published.id, url: info.permalink ?? null };
}

export async function verifyInstagram(creds: InstagramCredentials) {
  const me = await graph<{ username?: string }>(
    creds.igUserId,
    { fields: "username", access_token: creds.accessToken },
    "GET",
  );
  return me.username ? `@${me.username}` : creds.igUserId;
}
