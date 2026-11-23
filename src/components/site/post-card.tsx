import Image from "next/image";
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { LogoMark } from "./logo";

export interface PostCardData {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string | null;
  category: { slug: string; name: string } | null;
}

export function PostCard({ post, priority }: { post: PostCardData; priority?: boolean }) {
  return (
    <article className="surface-card-interactive group relative flex flex-col overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-accent">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-smooth group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <LogoMark className="size-12" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <p className="caption-4 flex items-center gap-2 text-muted-foreground">
          {post.category && <span className="text-primary">{post.category.name}</span>}
          {post.category && <span aria-hidden>·</span>}
          <time dateTime={post.publishedAt ?? undefined}>{fmtDate(post.publishedAt)}</time>
        </p>
        <h3 className="heading-6">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="body-6 line-clamp-3 text-muted-foreground">{post.excerpt}</p>}
      </div>
    </article>
  );
}
