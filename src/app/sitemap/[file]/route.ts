import { renderUrlset, sitemapEntries, sitemapIds } from "@/server/services/sitemap";

export const dynamic = "force-dynamic";

/** /sitemap/0.xml (sayfalar, ağlar, iller, blog) ve /sitemap/1.xml … (istasyonlar, 40.000'lik dilimler) */
export async function GET(_req: Request, ctx: RouteContext<"/sitemap/[file]">) {
  const { file } = await ctx.params;
  const match = /^(\d{1,3})\.xml$/.exec(file);
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(id) || !(await sitemapIds()).includes(id)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderUrlset(await sitemapEntries(id)), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
