import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * API koruması: verinin yalnızca sitenin kendi arayüzünden okunabilmesi için.
 *
 * 1) İstemci önce /api/session'dan kısa ömürlü bir oturum (imzalı jeton + AES anahtarı) alır.
 *    Oturum yalnızca aynı kaynaktan gelen tarayıcı isteklerine verilir.
 * 2) /api/trpc istekleri bu jetonu taşımak zorundadır; istek gövdesi ve yanıt AES-256-GCM ile şifrelenir.
 *    Ağ sekmesinde yalnızca şifreli metin görünür; kopyalanan bir istek jetonun süresi dolunca çalışmaz.
 * 3) Jeton, alındığı tarayıcının User-Agent değerine bağlıdır ve IP başına hız sınırı uygulanır.
 *
 * Sınır: anahtar tarayıcıya verilmek zorunda olduğu için bu, kararlı bir saldırganı durdurmaz;
 * toplu veri çekmeyi zorlaştırır ve yavaşlatır. Arama motorlarının okuması gereken HTML sayfaları
 * (SEO) doğası gereği herkese açıktır.
 */

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const TOKEN_HEADER = "x-eys-t";
export const ENCRYPTED_HEADER = "x-eys-enc";

// APP_SECRET yoksa süreç ömrü boyunca geçerli rastgele bir anahtar kullanılır
// (yeniden başlatmada istemciler oturumu kendiliğinden yeniler).
const ROOT =
  process.env.APP_SECRET && process.env.APP_SECRET.length >= 16
    ? Buffer.from(process.env.APP_SECRET)
    : randomBytes(32);

const derive = (purpose: string) => createHash("sha256").update(purpose).update(ROOT).digest();
const SIGN_KEY = derive("guard:sign:");
const ENC_KEY = derive("guard:enc:");

const b64u = (b: Buffer) => b.toString("base64url");
const uaHash = (ua: string | null) => createHash("sha256").update(ua ?? "").digest("base64url").slice(0, 16);

function sign(exp: number, nonce: string, ua: string | null) {
  return b64u(createHmac("sha256", SIGN_KEY).update(`${exp}.${nonce}.${uaHash(ua)}`).digest());
}

function sessionKey(exp: number, nonce: string) {
  return createHmac("sha256", ENC_KEY).update(`${exp}.${nonce}`).digest(); // 32 bayt
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** Yeni oturum: jeton + bu jetona özel AES anahtarı. */
export function issueSession(headers: Headers) {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = b64u(randomBytes(12));
  const token = `${exp}.${nonce}.${sign(exp, nonce, headers.get("user-agent"))}`;
  return { token, key: sessionKey(exp, nonce).toString("base64"), exp };
}

/** Jetonu doğrular; geçerliyse oturumun AES anahtarını döndürür. */
export function verifySession(headers: Headers): Buffer | null {
  const token = headers.get(TOKEN_HEADER);
  if (!token) return null;
  const [expRaw, nonce, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!nonce || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = Buffer.from(sign(exp, nonce, headers.get("user-agent")));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return sessionKey(exp, nonce);
}

/**
 * İsteğin sitenin kendi sayfasından gelip gelmediği.
 * Tarayıcılar `Sec-Fetch-Site` gönderir; yoksa Origin / Referer alan adı Host ile karşılaştırılır.
 */
export function isSameOrigin(headers: Headers) {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const source = headers.get("origin") ?? headers.get("referer");
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

// AES-256-GCM. Biçim: base64( iv[12] | şifreli metin | etiket[16] ) — tarayıcıdaki WebCrypto ile aynı düzen.
export function encrypt(key: Buffer, plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64");
}

export function decrypt(key: Buffer, payload: string) {
  const raw = Buffer.from(payload, "base64");
  if (raw.length < 28) throw new Error("payload too short");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
}

// ── IP başına kayan pencereli hız sınırı (tek sunucu kurulumu için bellek içi) ──
const buckets = new Map<string, number[]>();

/** İzin varsa true döner ve isteği sayar; sınır aşıldıysa false. */
export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 20_000) buckets.clear();
  return true;
}
