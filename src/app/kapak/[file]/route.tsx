import { ImageResponse } from "next/og";
import { db } from "@/server/db";
import { site } from "@/lib/site";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const GREEN = "#0c7a43";
const INK = "#0f1411";

/**
 * Yazı için sitenin kendi ürettiği görsel (JPEG): /kapak/<slug>.jpg
 *   ?b=kare  → 1080×1080 (Instagram); varsayılan 1200×630 (bağlantı önizlemesi)
 *   ?n=1..4  → öne çıkan maddelerden birinin kartı (Instagram görsel dizisi için)
 *
 * Kapak görseli yüklenmemiş yazılarda (ör. haber akışından üretilenler) başka sitelerin fotoğrafları
 * kullanılmaz; bağlantı önizlemesi ve sosyal medya paylaşımı bu görsellerle yapılır.
 */
export async function GET(req: Request, ctx: RouteContext<"/kapak/[file]">) {
  const { file } = await ctx.params;
  const slug = /^([a-z0-9-]{1,120})\.jpg$/.exec(file)?.[1];
  if (!slug) return new Response("Not found", { status: 404 });

  const post = await db.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, highlights: true, publishedAt: true, category: { select: { name: true } } },
  });
  if (!post) return new Response("Not found", { status: 404 });

  const params = new URL(req.url).searchParams;
  const square = params.get("b") === "kare";
  const n = Number(params.get("n") ?? 0);
  const highlight = Number.isInteger(n) && n >= 1 ? post.highlights[n - 1] : undefined;
  if (n !== 0 && !highlight) return new Response("Not found", { status: 404 });

  const width = square ? 1080 : 1200;
  const height = square ? 1080 : 630;
  const pad = square ? 88 : 72;

  const brand = (color: string, markBg: string, markFg: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 600, color }}>
      <div style={{ display: "flex", width: 56, height: 56, borderRadius: 14, background: markBg, alignItems: "center", justifyContent: "center" }}>
        <svg width="34" height="34" viewBox="0 0 32 32">
          <path d="M17.6 5 9 18h6l-1.6 9L23 13.5h-6.2L17.6 5Z" fill={markFg} />
        </svg>
      </div>
      {site.domain}
    </div>
  );

  const text = highlight ?? post.title;
  const scale = square ? 1.15 : 1;
  const fontSize = Math.round((text.length <= 45 ? 76 : text.length <= 80 ? 62 : text.length <= 120 ? 52 : 44) * scale);

  const element = highlight ? (
    // Öne çıkan madde kartı: açık zemin
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: pad, background: "#ffffff", color: INK, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600, color: GREEN }}>
        <div style={{ display: "flex", width: 64, height: 64, borderRadius: 16, background: "#e8f5ee", alignItems: "center", justifyContent: "center", fontSize: 34 }}>{n}</div>
        Öne çıkanlar
      </div>
      <div style={{ display: "flex", fontSize, fontWeight: 600, lineHeight: 1.12 }}>{text}</div>
      {brand(INK, GREEN, "#ffffff")}
    </div>
  ) : (
    // Kapak: marka yeşili zemin
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: pad, background: GREEN, color: "#ffffff", fontFamily: "sans-serif" }}>
      {brand("#ffffff", "#ffffff", GREEN)}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, opacity: 0.85 }}>
          {[post.category?.name, post.publishedAt ? fmtDate(post.publishedAt) : null].filter(Boolean).join("  ·  ")}
        </div>
        <div style={{ display: "flex", fontSize, fontWeight: 600, lineHeight: 1.1 }}>{text}</div>
      </div>
    </div>
  );

  // Instagram yalnızca JPEG kabul eder; ImageResponse PNG ürettiği için dönüştürülür.
  const png = Buffer.from(await new ImageResponse(element, { width, height }).arrayBuffer());
  const cache = "public, max-age=86400, stale-while-revalidate=604800";
  try {
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": cache } });
  } catch (e) {
    // sharp yüklenemezse (ör. platform ikilisi eksik) PNG döner: bağlantı önizlemeleri çalışmaya devam eder.
    console.error("kapak JPEG'e çevrilemedi, PNG dönülüyor", e);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": cache } });
  }
}
