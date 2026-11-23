"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CategoriesPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const cats = useQuery(trpc.admin.category.list.queryOptions());
  const [editing, setEditing] = useState<{ id?: string; name: string; slug: string; description: string }>({
    name: "",
    slug: "",
    description: "",
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: trpc.admin.category.list.queryKey() });
  const upsert = useMutation(
    trpc.admin.category.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Kaydedildi");
        setEditing({ name: "", slug: "", description: "" });
        refresh();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const del = useMutation(trpc.admin.category.delete.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));

  return (
    <>
      <AdminPageTitle title="Kategoriler" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Yazı</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cats.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-right">{c._count.posts}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Düzenle"
                      onClick={() => setEditing({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? "" })}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Sil"
                      onClick={() => confirm(`"${c.name}" silinsin mi? Yazılar kategorisiz kalır.`) && del.mutate({ id: c.id })}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{editing.id ? "Kategoriyi düzenle" : "Yeni kategori"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cname">Ad</Label>
              <Input id="cname" value={editing.name} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cslug">Slug (boşsa addan üretilir)</Label>
              <Input id="cslug" value={editing.slug} onChange={(e) => setEditing((s) => ({ ...s, slug: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cdesc">Açıklama</Label>
              <Textarea id="cdesc" value={editing.description} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button
                disabled={editing.name.trim().length < 2 || upsert.isPending}
                onClick={() =>
                  upsert.mutate({ id: editing.id, name: editing.name, slug: editing.slug || undefined, description: editing.description })
                }
              >
                Kaydet
              </Button>
              {editing.id && (
                <Button variant="ghost" onClick={() => setEditing({ name: "", slug: "", description: "" })}>
                  Vazgeç
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
