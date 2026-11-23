import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { Breadcrumbs, Section } from "@/components/site/page-header";
import { Markdown, extractFaq, extractHeadings } from "@/components/site/markdown";
import { PostCard } from "@/components/site/post-card";
import { JsonLd } from "@/components/site/json-ld";
import { ViewTracker } from "@/components/site/view-tracker";
import { ShareButtons } from "@/components/site/share-buttons";
import { Badge } from "@/components/ui/badge";
import { getPublishedPost } from "@/server/services/posts";
import { absoluteUrl, site } from "@/lib/site";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Yazı bulunamadı" };
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt ?? undefined;
  return {
    title: { absolute: `${title} | ${site.name}` },
    description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    authors: post.author ? [{ name: post.author.name }] : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(`/blog/${post.slug}`),
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      section: post.category?.name,
      tags: post.tags,
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl, alt: post.coverImageAlt ?? post.title }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  const headings = extractHeadings(post.content);
  const faq = extractFaq(post.content);
  const words = post.content.split(/\s+/).length;
  const readMinutes = Math.max(1, Math.round(words / 200));
  const url = absoluteUrl(`/blog/${post.slug}`);

  return (
    <article className="mx-auto max-w-7xl px-4">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.seoDescription ?? post.excerpt,
            image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            author: { "@type": post.author ? "Person" : "Organization", name: post.author?.name ?? site.name },
            publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
            mainEntityOfPage: url,
            keywords: post.keywords.join(", "),
            wordCount: words,
            inLanguage: "tr-TR",
          },
          ...(faq.length
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
                },
              ]
            : []),
        ]}
      />
      <ViewTracker slug={post.slug} />

      <header className="mx-auto max-w-3xl space-y-4 pb-8 pt-8">
        <Breadcrumbs
          items={[
            { href: "/blog", label: "Blog" },
            ...(post.category ? [{ href: `/blog/kategori/${post.category.slug}`, label: post.category.name }] : []),
            { href: `/blog/${post.slug}`, label: post.title },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-muted-foreground">{post.excerpt}</p>}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {post.author && <span>{post.author.name}</span>}
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="size-4" />
            <time dateTime={post.publishedAt ?? undefined}>{fmtDate(post.publishedAt)}</time>
          </span>
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-4" /> {readMinutes} dk okuma
          </span>
        </div>
      </header>

      {post.coverImageUrl && (
        <div className="relative mx-auto mb-10 aspect-[16/9] max-w-5xl overflow-hidden rounded-2xl bg-muted">
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            fill
            priority
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          <Markdown content={post.content} />
          {post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-8 border-t pt-6">
            <ShareButtons url={url} title={post.title} />
          </div>
        </div>
        {headings.length > 2 && (
          <aside className="hidden lg:block">
            <nav aria-label="İçindekiler" className="sticky top-24 space-y-2 text-sm">
              <p className="font-semibold">İçindekiler</p>
              {headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} className="block text-muted-foreground hover:text-foreground">
                  {h.label}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

      {post.related.length > 0 && (
        <Section title="İlgili yazılar" className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {post.related.map((r) => (
              <PostCard key={r.id} post={r} />
            ))}
          </div>
        </Section>
      )}

      <div className="mx-auto max-w-5xl rounded-2xl border bg-muted/40 p-6 text-center">
        <p className="font-medium">Yakınınızdaki şarj istasyonlarını görmek ister misiniz?</p>
        <Link href="/sarj-haritasi?yakinimda=1" className="mt-2 inline-block font-semibold text-primary hover:underline">
          Şarj haritasını aç →
        </Link>
      </div>
    </article>
  );
}
