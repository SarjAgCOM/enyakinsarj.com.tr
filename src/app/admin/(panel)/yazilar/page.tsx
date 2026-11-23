"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { useTRPC } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDateTime, fmtInt } from "@/lib/format";

type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ALL";
const LABEL = { DRAFT: "Taslak", SCHEDULED: "Planlı", PUBLISHED: "Yayında" } as const;

export default function PostsPage() {
  const trpc = useTRPC();
  const [status, setStatus] = useState<Status>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const posts = useQuery(
    trpc.admin.post.list.queryOptions({ status: status === "ALL" ? undefined : status, q: q || undefined, page }),
  );

  return (
    <>
      <AdminPageTitle
        title="Blog yazıları"
        actions={
          <Button asChild>
            <Link href="/admin/yazilar/yeni">
              <PlusIcon data-icon="inline-start" /> Yeni yazı
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(v) => (setStatus(v as Status), setPage(1))}>
          <TabsList>
            <TabsTrigger value="ALL">Tümü</TabsTrigger>
            <TabsTrigger value="PUBLISHED">Yayında</TabsTrigger>
            <TabsTrigger value="SCHEDULED">Planlı</TabsTrigger>
            <TabsTrigger value="DRAFT">Taslak</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Başlıkta ara" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="max-w-xs" />
      </div>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Başlık</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Yayın</TableHead>
              <TableHead className="text-right">Okunma</TableHead>
              <TableHead>Paylaşım</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.data?.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-md">
                  <Link href={`/admin/yazilar/${p.id}`} className="font-medium hover:text-primary">
                    {p.title}
                  </Link>
                  {p.aiGenerated && <SparklesIcon className="ml-1.5 inline size-3.5 text-primary" aria-label="Yapay zekâ ile üretildi" />}
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === "PUBLISHED" ? "default" : p.status === "SCHEDULED" ? "secondary" : "outline"}>
                    {LABEL[p.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.category?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDateTime(p.publishedAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(p.viewCount)}</TableCell>
                <TableCell className="text-muted-foreground">{p.sharedAt ? "✓" : p._count.socialPosts ? "hata" : "—"}</TableCell>
              </TableRow>
            ))}
            {posts.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Yazı bulunamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {posts.data && posts.data.pages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {posts.data.pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= posts.data.pages} onClick={() => setPage((p) => p + 1)}>
            Sonraki
          </Button>
        </div>
      )}
    </>
  );
}
