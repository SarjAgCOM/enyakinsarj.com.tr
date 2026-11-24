import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { sharePost } from "../social";
import { CACHE_TAGS } from "./cache-tags";
import { slugify } from "@/lib/slug";

export const PAGE_SIZE = 12;

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  publishedAt: true,
  tags: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.PostSelect;

const published = (): Prisma.PostWhereInput => ({ status: "PUBLISHED", publishedAt: { lte: new Date() } });

const serialize = <T extends { publishedAt: Date | null }>(p: T) => ({
  ...p,
  publishedAt: p.publishedAt?.toISOString() ?? null,
});

const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string) =>
  unstable_cache(fn, [key], { tags: [CACHE_TAGS.posts], revalidate: 300 });

export const listPublishedPosts = cached(
  async (opts: { page?: number; categorySlug?: string; tag?: string; take?: number } = {}) => {
    const page = Math.max(1, opts.page ?? 1);
    const take = opts.take ?? PAGE_SIZE;
    const where: Prisma.PostWhereInput = {
      ...published(),
      ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
      ...(opts.tag ? { tags: { has: opts.tag } } : {}),
    };
    const [items, total] = await Promise.all([
      db.post.findMany({ where, select: cardSelect, orderBy: { publishedAt: "desc" }, skip: (page - 1) * take, take }),
      db.post.count({ where }),
    ]);
    return { items: items.map(serialize), total, page, pages: Math.max(1, Math.ceil(total / take)) };
  },
  "posts-list",
);

export type PostCard = Awaited<ReturnType<typeof listPublishedPosts>>["items"][number];

export const getPublishedPost = cached(async (slug: string) => {
  const post = await db.post.findFirst({
    where: { slug, ...published() },
    include: { category: { select: { slug: true, name: true } }, author: { select: { name: true } } },
  });
  if (!post) return null;
  const related = await db.post.findMany({
    where: {
      ...published(),
      id: { not: post.id },
      OR: [{ categoryId: post.categoryId ?? undefined }, { tags: { hasSome: post.tags } }],
    },
    select: cardSelect,
    orderBy: { publishedAt: "desc" },
    take: 3,
  });
  return {
    ...serialize(post),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    sharedAt: post.sharedAt?.toISOString() ?? null,
    related: related.map(serialize),
  };
}, "post-by-slug");

export const listCategoriesWithCounts = cached(async () => {
  const cats = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: { where: published() } } } },
  });
  return cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, count: c._count.posts }));
}, "categories");

export const getAllPostSlugs = cached(
  async () =>
    (await db.post.findMany({ where: published(), select: { slug: true, updatedAt: true } })).map((p) => ({
      slug: p.slug,
      updatedAt: p.updatedAt.toISOString(),
    })),
  "post-slugs",
);

export function revalidatePosts() {
  revalidateTag(CACHE_TAGS.posts, { expire: 0 });
}

/** Yazıyı yayınlar; otomatik paylaşım açıksa bağlı sosyal hesaplarda paylaşır. */
export async function publishPost(id: string) {
  const current = await db.post.findUniqueOrThrow({ where: { id } });
  const post = await db.post.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: current.publishedAt && current.publishedAt <= new Date() ? current.publishedAt : new Date(),
    },
  });
  revalidatePosts();
  const shares = post.autoShare && !post.sharedAt ? await sharePost(id, { auto: true }) : [];
  return { post, shares };
}

/** Cron: zamanı gelmiş planlı yazıları yayınlar. */
export async function publishDuePosts() {
  const due = await db.post.findMany({
    where: { status: "SCHEDULED", publishedAt: { lte: new Date() } },
    select: { id: true },
  });
  const results = [];
  for (const { id } of due) results.push({ id, ...(await publishPost(id)) });
  return results.map((r) => ({ id: r.id, shares: r.shares }));
}

/** Başlıktan (veya verilen slug'dan) benzersiz yazı slug'ı üretir. */
export async function uniquePostSlug(base: string, excludeId?: string) {
  const root = slugify(base, 90) || "yazi";
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await db.post.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}
