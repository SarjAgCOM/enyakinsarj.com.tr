import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { CategoryNav, Pagination, PostGrid } from "@/components/site/blog-list";
import { listCategoriesWithCounts, listPublishedPosts } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const sp = await searchParams;
  const page = Number(sp.sayfa) || 1;
  return {
    title: page > 1 ? `Elektrikli Araç Blogu – Sayfa ${page}` : "Elektrikli Araç Blogu: Şarj Rehberleri, İncelemeler ve Haberler",
    description: "Elektrikli araç şarjı, şarj ağları, kWh fiyatları ve e-mobilite dünyası hakkında rehberler, incelemeler ve haberler.",
    alternates: { canonical: page > 1 ? `/blog?sayfa=${page}` : "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
  };
}

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.sayfa) || 1);
  const [posts, categories] = await Promise.all([listPublishedPosts({ page }), listCategoriesWithCounts()]);
  return (
    <div className="container-page">
      <PageHeader
        crumbs={[{ href: "/blog", label: "Blog" }]}
        title="Elektrikli araç blogu"
        description="Şarj rehberleri, şarj ağı karşılaştırmaları, incelemeler ve haberler."
      />
      <CategoryNav categories={categories} />
      <PostGrid posts={posts.items} />
      <Pagination page={posts.page} pages={posts.pages} base="/blog" />
    </div>
  );
}
