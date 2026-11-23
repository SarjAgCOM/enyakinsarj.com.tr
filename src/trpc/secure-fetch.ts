/**
 * tRPC istekleri için şifreli taşıma (istemci tarafı). Sunucu karşılığı: src/server/guard.ts
 *
 * - /api/session'dan kısa ömürlü jeton + AES anahtarı alınır ve bellekte tutulur.
 * - İstek gövdesi şifrelenir, jeton başlıkta gönderilir, yanıt çözülür.
 * - Oturum süresi dolduysa (401) bir kez yenilenip istek tekrarlanır.
 */

interface Session {
  token: string;
  key: CryptoKey;
  exp: number;
}

const TOKEN_HEADER = "x-eys-t";
const ENCRYPTED_HEADER = "x-eys-enc";

let pending: Promise<Session> | null = null;

const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function loadSession(): Promise<Session> {
  const res = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error(res.status === 429 ? "Çok fazla istek gönderildi. Biraz sonra yeniden deneyin." : "Oturum açılamadı.");
  const { t, k, exp } = (await res.json()) as { t: string; k: string; exp: number };
  const key = await crypto.subtle.importKey("raw", fromBase64(k), "AES-GCM", false, ["encrypt", "decrypt"]);
  return { token: t, key, exp };
}

async function getSession(force = false): Promise<Session> {
  if (!force && pending) {
    const s = await pending.catch(() => null);
    // Süresi dolmak üzere olan oturum yenilenir.
    if (s && s.exp - Date.now() > 60_000) return s;
  }
  pending = loadSession();
  return pending;
}

async function encrypt(key: CryptoKey, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + body.length);
  out.set(iv);
  out.set(body, iv.length);
  return toBase64(out);
}

async function decrypt(key: CryptoKey, payload: string) {
  const raw = fromBase64(payload);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return new TextDecoder().decode(plain);
}

export async function secureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const body = typeof init?.body === "string" ? init.body : "";
  let res!: Response;

  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await getSession(attempt > 0);
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    headers.set(TOKEN_HEADER, session.token);

    res = await fetch(input, {
      ...init,
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({ d: body ? await encrypt(session.key, body) : "" }),
    });

    if (res.status === 401 && attempt === 0) continue; // oturum süresi dolmuş: yenile ve tekrar dene
    if (res.headers.get(ENCRYPTED_HEADER)) {
      const { d } = (await res.json()) as { d: string };
      return new Response(await decrypt(session.key, d), {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    }
    break;
  }

  // Şifresiz yanıt: koruma katmanının reddi (403 / 429 / 401). tRPC'nin anlayacağı hata biçimine çevrilir.
  const message =
    res.status === 429
      ? "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin."
      : "İstek doğrulanamadı. Sayfayı yenileyip yeniden deneyin.";
  // Toplu istekte (a,b,c) her çağrı için bir hata nesnesi gerekir.
  const path = new URL(String(input instanceof Request ? input.url : input), location.origin).pathname;
  const calls = path.split("/").pop()?.split(",").length ?? 1;
  const error = { error: { json: { message, code: -32603, data: { code: "FORBIDDEN", httpStatus: res.status } } } };
  return new Response(JSON.stringify(Array.from({ length: calls }, () => error)), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
