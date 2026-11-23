import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * /admin altındaki sayfaları korur (iyimser kontrol). Asıl yetki kontrolü her tRPC
 * prosedüründe ve route handler'da ayrıca yapılır.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
  matcher: ["/admin/:path*"],
};
