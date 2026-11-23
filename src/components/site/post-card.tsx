import Image from "next/image";
import Link from "next/link";
import { CalendarIcon } from "lucide-react";
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
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? post.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            <LogoMark className="size-12 opacity-70" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {post.category && <span className="text-xs font-semibold uppercase tracking-wide text-primary">{post.category.name}</span>}
        <h3 className="text-lg font-semibold leading-snug text-balance">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>}
        <p className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <CalendarIcon className="size-3.5" />
          <time dateTime={post.publishedAt ?? undefined}>{fmtDate(post.publishedAt)}</time>
        </p>
      </div>
    </article>
  );
}
