import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { ENCRYPTED_HEADER, allow, clientIp, decrypt, encrypt, isSameOrigin, verifySession } from "@/server/guard";

export const dynamic = "force-dynamic";
// Yapay zekâ ile yazı üretimi uzun sürebilir
export const maxDuration = 300;

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

/**
 * tRPC uç noktası yalnızca sitenin kendi arayüzünden kullanılabilir:
 *  - istekler aynı kaynaktan gelmeli ve geçerli bir oturum jetonu taşımalı,
 *  - sorgular dahil her çağrı POST'tur; girdi (gövde) ve yanıt AES-256-GCM ile şifrelidir,
 *  - IP başına hız sınırı uygulanır.
 */
async function handler(req: Request) {
  if (!isSameOrigin(req.headers)) return json({ error: "forbidden" }, 403);

  const key = verifySession(req.headers);
  // 401: istemci oturumunu yeniler ve isteği bir kez daha dener.
  if (!key) return json({ error: "session" }, 401);

  const ip = clientIp(req.headers);
  if (ip !== "unknown" && !allow(`trpc:${ip}`, 240, 60_000)) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": "30" });
  }

  let plainBody: string;
  try {
    const { d } = (await req.json()) as { d?: string };
    plainBody = d ? decrypt(key, d) : "";
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  const inner = new Request(req.url, { method: "POST", headers, body: plainBody || undefined });

  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: inner,
    router: appRouter,
    allowMethodOverride: true,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`❌ tRPC /${path ?? "?"}: ${error.message}`)
        : ({ path, error }) => {
            if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC /${path ?? "?"}`, error);
          },
  });

  return json({ d: encrypt(key, await res.text()) }, res.status, { [ENCRYPTED_HEADER]: "1" });
}

/** Girdilerin adres çubuğunda görünmemesi için GET kabul edilmez. */
export function GET() {
  return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
}

export { handler as POST };
