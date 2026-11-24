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

/** Medya kapsayıcısının işlenmesini bekler (Instagram görseli kendi sunucusuna indirir). */
async function waitUntilReady(creds: InstagramCredentials, containerId: string) {
  for (let i = 0; i < 15; i++) {
    const status = await graph<{ status_code?: string }>(containerId, { fields: "status_code", access_token: creds.accessToken }, "GET");
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram medya işlenemedi (${status.status_code}). Görsel herkese açık bir JPEG olmalı.`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function publish(creds: InstagramCredentials, containerId: string) {
  const published = await graph<{ id: string }>(`${creds.igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: creds.accessToken,
  });
  const info = await graph<{ permalink?: string }>(published.id, { fields: "permalink", access_token: creds.accessToken }, "GET").catch(
    () => ({ permalink: undefined }),
  );
  return { externalId: published.id, url: info.permalink ?? null };
}

export async function postToInstagram(creds: InstagramCredentials, input: { imageUrl: string; caption: string }) {
  const container = await graph<{ id: string }>(`${creds.igUserId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption.slice(0, 2200),
    access_token: creds.accessToken,
  });
  await waitUntilReady(creds, container.id);
  return publish(creds, container.id);
}

/**
 * Birden fazla görseli tek gönderide (kaydırmalı dizi) paylaşır. Instagram 2 ile 10 arası görsel kabul eder
 * ve tüm görselleri ilkinin en-boy oranına göre kırpar; bu yüzden hepsi aynı oranda (kare) verilmelidir.
 */
export async function postCarouselToInstagram(creds: InstagramCredentials, input: { imageUrls: string[]; caption: string }) {
  const urls = input.imageUrls.slice(0, 10);
  if (urls.length < 2) return postToInstagram(creds, { imageUrl: urls[0], caption: input.caption });

  const children: string[] = [];
  for (const image_url of urls) {
    const child = await graph<{ id: string }>(`${creds.igUserId}/media`, {
      image_url,
      is_carousel_item: "true",
      access_token: creds.accessToken,
    });
    await waitUntilReady(creds, child.id);
    children.push(child.id);
  }
  const parent = await graph<{ id: string }>(`${creds.igUserId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: input.caption.slice(0, 2200),
    access_token: creds.accessToken,
  });
  await waitUntilReady(creds, parent.id);
  return publish(creds, parent.id);
}

export async function verifyInstagram(creds: InstagramCredentials) {
  const me = await graph<{ username?: string }>(
    creds.igUserId,
    { fields: "username", access_token: creds.accessToken },
    "GET",
  );
  return me.username ? `@${me.username}` : creds.igUserId;
}
