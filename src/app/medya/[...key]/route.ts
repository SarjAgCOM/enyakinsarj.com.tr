import { ALLOWED_IMAGE_TYPES, getObject, isStorageConfigured } from "@/server/storage";

export const dynamic = "force-dynamic";

// Yükleme sırasında üretilen anahtar biçimi: klasör/yıl/ay/ad-xxxxxxxx.uzantı
const KEY_PATTERN = /^[a-z0-9-]+\/\d{4}\/\d{2}\/[a-z0-9-]+\.[a-z0-9]{2,5}$/i;

/**
 * Yüklenen görselleri sitenin kendi adresinden sunar: /medya/blog/2026/11/ornek-ab12cd34.jpg
 * Sunucu dosyayı bucket'tan kendi kimlik bilgisiyle okur; bu yüzden bucket'ın herkese açık olması gerekmez
 * ve adresi dışarıya gösterilmez. Dosya adları değişmez olduğundan yanıt uzun süre önbelleğe alınır.
 */
export async function GET(req: Request, ctx: RouteContext<"/medya/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!KEY_PATTERN.test(key) || !isStorageConfigured()) return new Response("Not found", { status: 404 });

  let object;
  try {
    object = await getObject(key);
  } catch (e) {
    console.error("medya okunamadı", key, e);
    return new Response("Görsel şu an okunamıyor.", { status: 502 });
  }
  // Yalnızca görsel türleri sunulur; başka içerik aynı kaynaktan (origin) verilmez.
  if (!object || !ALLOWED_IMAGE_TYPES.includes(object.contentType)) return new Response("Not found", { status: 404 });

  if (object.etag && req.headers.get("if-none-match") === object.etag) {
    await object.body.cancel().catch(() => {});
    return new Response(null, { status: 304, headers: { ETag: object.etag } });
  }

  const headers = new Headers({
    "Content-Type": object.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // SVG içine gömülü betiklerin sitenin kaynağında çalışmasını engeller.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  if (object.contentLength != null) headers.set("Content-Length", String(object.contentLength));
  if (object.etag) headers.set("ETag", object.etag);
  return new Response(object.body, { headers });
}
