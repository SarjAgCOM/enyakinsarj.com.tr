import { listPublishedPosts } from "@/server/services/posts";
import { absoluteUrl, site } from "@/lib/site";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const { items } = await listPublishedPosts({ take: 50 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(site.name)} Blog</title>
<link>${absoluteUrl("/blog")}</link>
<description>${esc(site.description)}</description>
<language>tr-TR</language>
<atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml"/>
${items
  .map(
    (p) => `<item>
<title>${esc(p.title)}</title>
<link>${absoluteUrl(`/blog/${p.slug}`)}</link>
<guid isPermaLink="true">${absoluteUrl(`/blog/${p.slug}`)}</guid>
${p.publishedAt ? `<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>` : ""}
${p.excerpt ? `<description>${esc(p.excerpt)}</description>` : ""}
${p.category ? `<category>${esc(p.category.name)}</category>` : ""}
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
