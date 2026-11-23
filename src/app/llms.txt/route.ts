import { buildLlmsTxt } from "@/server/services/llms";

export const dynamic = "force-dynamic";

/** Yapay zekâ asistanları için site özeti (llmstxt.org). */
export async function GET() {
  return new Response(await buildLlmsTxt(false), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
