import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { PostCard } from "@/components/site/post-card";
import { EmptyState } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tab = (active: boolean) =>
  cn(
    "chip",
    active && "border-foreground bg-foreground text-background hover:border-foreground hover:text-background",
  );

export function CategoryNav({ categories, active }: { categories: { slug: string; name: string; count: number }[]; active?: string }) {
  return (
    <nav aria-label="Kategoriler" className="mb-8 flex flex-wrap gap-2">
      <Link href="/blog" aria-current={!active ? "page" : undefined} className={tab(!active)}>
        Tümü
      </Link>
      {categories
        .filter((c) => c.count > 0)
        .map((c) => (
          <Link
            key={c.slug}
            href={`/blog/kategori/${c.slug}`}
            aria-current={active === c.slug ? "page" : undefined}
            className={tab(active === c.slug)}
          >
            {c.name} <span className="caption-2 tabular-nums opacity-60">{c.count}</span>
          </Link>
        ))}
    </nav>
  );
}

export function PostGrid({ posts }: { posts: Parameters<typeof PostCard>[0]["post"][] }) {
  if (posts.length === 0) {
    return (
      <EmptyState title="Bu bölümde henüz yazı yok">
        <span className="w-full">Yeni rehberler yayınlandığında burada görünecek. O zamana kadar:</span>
        <Button asChild variant="outline" size="sm">
          <Link href="/sarj-haritasi">Şarj haritasını aç</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/hesaplayicilar/sarj-maliyeti">Şarj maliyetini hesapla</Link>
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p, i) => (
        <PostCard key={p.slug} post={p} priority={i < 3} />
      ))}
    </div>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? base : `${base}?sayfa=${p}`);
  return (
    <nav aria-label="Sayfalama" className="mt-10 flex items-center justify-center gap-3">
      {page > 1 && (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page - 1)} rel="prev">
            <ArrowLeftIcon data-icon="inline-start" /> Önceki sayfa
          </Link>
        </Button>
      )}
      <span className="caption-2 tabular-nums text-muted-foreground">
        {page} / {pages}
      </span>
      {page < pages && (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page + 1)} rel="next">
            Sonraki sayfa <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      )}
    </nav>
  );
}
