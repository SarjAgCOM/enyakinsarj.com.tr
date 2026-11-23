import Link from "next/link";
import { PostCard } from "@/components/site/post-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CategoryNav({ categories, active }: { categories: { slug: string; name: string; count: number }[]; active?: string }) {
  return (
    <nav aria-label="Kategoriler" className="mb-8 flex flex-wrap gap-2">
      <Link
        href="/blog"
        className={cn("rounded-full border px-3.5 py-1.5 text-sm", !active ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40")}
      >
        Tümü
      </Link>
      {categories
        .filter((c) => c.count > 0)
        .map((c) => (
          <Link
            key={c.slug}
            href={`/blog/kategori/${c.slug}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm",
              active === c.slug ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40",
            )}
          >
            {c.name} <span className="opacity-60">({c.count})</span>
          </Link>
        ))}
    </nav>
  );
}

export function PostGrid({ posts }: { posts: Parameters<typeof PostCard>[0]["post"][] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">Bu bölümde henüz yazı yok.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/sarj-haritasi">Şarj haritası</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/hesaplayicilar/sarj-maliyeti">Maliyet hesapla</Link>
          </Button>
        </div>
      </div>
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
    <nav aria-label="Sayfalama" className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Button asChild variant="outline">
          <Link href={href(page - 1)} rel="prev">
            ← Önceki
          </Link>
        </Button>
      )}
      <span className="px-3 text-sm text-muted-foreground">
        {page} / {pages}
      </span>
      {page < pages && (
        <Button asChild variant="outline">
          <Link href={href(page + 1)} rel="next">
            Sonraki →
          </Link>
        </Button>
      )}
    </nav>
  );
}
