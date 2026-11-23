import { NextResponse } from "next/server";
import { allow, clientIp, isSameOrigin, issueSession } from "@/server/guard";

export const dynamic = "force-dynamic";

/**
 * Tarayıcıya kısa ömürlü API oturumu verir (bkz. src/server/guard.ts).
 * Yalnızca sitenin kendi sayfalarından gelen isteklere yanıt verir; IP başına sınırlıdır.
 */
export async function GET(req: Request) {
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const ip = clientIp(req.headers);
  // 30 dk'lık oturum için saatte 2 istek yeter; sınır, sekme / cihaz çokluğu için geniş tutuldu.
  if (ip !== "unknown" && !allow(`session:${ip}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "600" } });
  }
  const s = issueSession(req.headers);
  return NextResponse.json({ t: s.token, k: s.key, exp: s.exp }, { headers: { "Cache-Control": "no-store" } });
}
