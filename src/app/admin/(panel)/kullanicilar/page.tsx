"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";

export default function UsersPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const users = useQuery(trpc.admin.user.list.queryOptions());
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "EDITOR" as "ADMIN" | "EDITOR" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const refresh = () => void qc.invalidateQueries({ queryKey: trpc.admin.user.list.queryKey() });
  const create = useMutation(
    trpc.admin.user.create.mutationOptions({
      onSuccess: () => (toast.success("Kullanıcı eklendi"), setForm({ email: "", name: "", password: "", role: "EDITOR" }), refresh()),
      onError: (e) => toast.error(e.message),
    }),
  );
  const del = useMutation(trpc.admin.user.delete.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));
  const change = useMutation(
    trpc.admin.user.changePassword.mutationOptions({
      onSuccess: () => (toast.success("Şifre değiştirildi"), setPw({ current: "", next: "" })),
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <>
      <AdminPageTitle title="Kullanıcılar" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Eklenme</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role === "ADMIN" ? "Yönetici" : "Editör"}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" aria-label="Sil" onClick={() => confirm(`${u.email} silinsin mi?`) && del.mutate({ id: u.id })}>
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yeni kullanıcı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Ad soyad" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="E-posta" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input
                placeholder="Şifre (en az 10 karakter)"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "ADMIN" | "EDITOR" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Editör</SelectItem>
                  <SelectItem value="ADMIN">Yönetici</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={create.isPending} onClick={() => create.mutate(form)}>
                Ekle
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Şifremi değiştir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cur">Mevcut şifre</Label>
                <Input id="cur" type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nw">Yeni şifre</Label>
                <Input id="nw" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
              </div>
              <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate(pw)}>
                Değiştir
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
