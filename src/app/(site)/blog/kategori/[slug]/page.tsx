import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { listCategoriesWithCounts, listPublishedPosts } from "@/server/services/posts";
import { CategoryNav, Pagination, PostGrid } from "@/components/site/blog-list";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/blog/kategori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await listCategoriesWithCounts()).find((c) => c.slug === slug);
  if (!cat) return { title: "Kategori bulunamadı" };
  return {
    title: `${cat.name} – Elektrikli Araç Blogu`,
    description: cat.description ?? `${cat.name} kategorisindeki yazılar.`,
    alternates: { canonical: `/blog/kategori/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/blog/kategori/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.sayfa) || 1);
  const categories = await listCategoriesWithCounts();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const posts = await listPublishedPosts({ page, categorySlug: slug });
  return (
    <div className="container-page">
      <PageHeader
        crumbs={[
          { href: "/blog", label: "Blog" },
          { href: `/blog/kategori/${slug}`, label: cat.name },
        ]}
        title={cat.name}
        description={cat.description}
      />
      <CategoryNav categories={categories} active={slug} />
      <PostGrid posts={posts.items} />
      <Pagination page={posts.page} pages={posts.pages} base={`/blog/kategori/${slug}`} />
    </div>
  );
}
