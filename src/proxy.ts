import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * 1) /admin altındaki sayfaları korur (iyimser kontrol). Asıl yetki kontrolü her tRPC
 *    prosedüründe ve route handler'da ayrıca yapılır.
 * 2) /istasyon sayfalarında IP başına hız sınırı uygular: on binlerce istasyon sayfasının
 *    tek bir adresten hızla taranmasını (toplu veri çekme) yavaşlatır. Sınır, normal ziyaretçiyi
 *    ve arama motoru tarayıcılarının olağan hızını etkilemeyecek kadar geniştir.
 */

const STATION_PAGE_LIMIT = 120; // istek
const STATION_PAGE_WINDOW_MS = 60_000; // dakikada

// Tek sunucu kurulumu için bellek içi sayaç
const stationHits = new Map<string, number[]>();

function stationPageAllowed(ip: string) {
  const now = Date.now();
  const hits = (stationHits.get(ip) ?? []).filter((t) => now - t < STATION_PAGE_WINDOW_MS);
  const ok = hits.length < STATION_PAGE_LIMIT;
  if (ok) hits.push(now);
  stationHits.set(ip, hits);
  if (stationHits.size > 20_000) stationHits.clear();
  return ok;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/istasyon/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
    // IP bilinmiyorsa sınır uygulanmaz (herkesi tek sayaca düşürmemek için).
    if (ip && !stationPageAllowed(ip)) {
      return new NextResponse("Çok fazla istek gönderildi. Lütfen bir dakika sonra yeniden deneyin.", {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.next();
  }

  if (pathname === "/admin/giris") return NextResponse.next();

  const token = req.cookies.get("eys_session")?.value;
  const secret = process.env.APP_SECRET;
  let valid = false;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(`session:${secret}`), { algorithms: ["HS256"] });
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/giris";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/istasyon/:path*"],
};
