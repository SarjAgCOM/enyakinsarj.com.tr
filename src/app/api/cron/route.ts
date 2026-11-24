import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { publishDuePosts } from "@/server/services/posts";
import { syncIfDue } from "@/server/services/sync";
import { runNewsCycle } from "@/server/services/news";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Zamanlanmış görevler. docker-compose içindeki "cron" servisi bu uç noktayı birkaç dakikada bir çağırır:
 *  - Zamanı gelen planlı blog yazılarını yayınlar ve otomatik sosyal medya paylaşımını tetikler
 *  - SYNC_INTERVAL_HOURS dolduysa Şarjağ istasyon senkronunu çalıştırır
 *  - Haber akışı açıksa RSS kaynaklarını tarar ve kuyruktan bir haber üretir
 */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const published = await publishDuePosts().catch((e: Error) => ({ error: e.message }));
  const sync = await syncIfDue().catch((e: Error) => ({ error: e.message }));
  const news = await runNewsCycle().catch((e: Error) => ({ error: e.message }));
  return NextResponse.json({ ok: true, published, sync, news });
}
