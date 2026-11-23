"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwiseIcon, CircleNotchIcon, PencilSimpleIcon, SparkleIcon } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useTRPC, type RouterOutputs } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime, fmtInt, fmtTl } from "@/lib/format";

type Provider = RouterOutputs["admin"]["provider"]["list"][number];

function ProviderDialog({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: provider.name,
    website: provider.website ?? "",
    logoUrl: provider.logoUrl ?? "",
    description: provider.description ?? "",
    seoContent: provider.seoContent ?? "",
    color: provider.color ?? "#16a34a",
    isActive: provider.isActive,
  });
  const save = useMutation(
    trpc.admin.provider.update.mutationOptions({
      onSuccess: () => {
        toast.success("Kaydedildi");
        void qc.invalidateQueries({ queryKey: trpc.admin.provider.list.queryKey() });
        onClose();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const ai = useMutation(
    trpc.admin.ai.providerContent.mutationOptions({
      onSuccess: (d) => (setForm((f) => ({ ...f, seoContent: d.content })), toast.success("SEO metni üretildi")),
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{provider.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Ad</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Web sitesi</Label>
            <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Logo URL</Label>
            <Input value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Harita rengi</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-9 p-1" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Kısa açıklama</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Ağ sayfası SEO metni (markdown)</Label>
              <Button size="sm" variant="ghost" disabled={ai.isPending} onClick={() => ai.mutate({ providerId: provider.id })}>
                {ai.isPending ? <CircleNotchIcon className="animate-spin" data-icon="inline-start" /> : <SparkleIcon data-icon="inline-start" />}
                AI ile üret
              </Button>
            </div>
            <Textarea
              value={form.seoContent}
              onChange={(e) => setForm((f) => ({ ...f, seoContent: e.target.value }))}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} id="active" />
            <Label htmlFor="active">Aktif (senkron ve sitede göster)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={save.isPending} onClick={() => save.mutate({ id: provider.id, ...form })}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StationsAdminPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const runs = useQuery({ ...trpc.admin.sync.runs.queryOptions(), refetchInterval: (q) => (q.state.data?.some((r) => r.status === "RUNNING") ? 3000 : false) });
  const providers = useQuery(trpc.admin.provider.list.queryOptions());
  const me = useQuery(trpc.admin.sync.sarjagMe.queryOptions());
  const [editing, setEditing] = useState<Provider | null>(null);
  const trigger = useMutation(
    trpc.admin.sync.trigger.mutationOptions({
      onSuccess: () => {
        toast.success("Senkron başlatıldı");
        setTimeout(() => void qc.invalidateQueries({ queryKey: trpc.admin.sync.runs.queryKey() }), 800);
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const running = runs.data?.some((r) => r.status === "RUNNING");

  return (
    <>
      <AdminPageTitle
        title="Şarj ağları ve Şarjağ senkronu"
        description="İstasyon verileri Şarjağ API'den çekilip veritabanına yazılır. Cron, SYNC_INTERVAL_HOURS aralığıyla otomatik senkron yapar."
        actions={
          <Button onClick={() => trigger.mutate({})} disabled={running || trigger.isPending}>
            {running ? <CircleNotchIcon className="animate-spin" data-icon="inline-start" /> : <ArrowsClockwiseIcon data-icon="inline-start" />}
            {running ? "Senkron sürüyor…" : "Tüm ağları senkronla"}
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Şarjağ projesi</CardDescription>
            <CardTitle>{me.data?.ok ? me.data.project.name : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {me.data?.ok ? (
              <>
                Token bakiyesi: <strong className="text-foreground">{fmtInt(me.data.tokens.balance)}</strong>
                {me.data.usage30d && <> · 30 gün: {fmtInt(me.data.usage30d.requests)} istek</>}
              </>
            ) : (
              (me.data?.error ?? "Yükleniyor…")
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Son senkronlar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {runs.data?.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <details>
                    <summary className="flex cursor-pointer items-center gap-2">
                      <Badge variant={r.status === "FAILED" ? "destructive" : r.status === "RUNNING" ? "outline" : "secondary"}>{r.status}</Badge>
                      <span>{fmtDateTime(r.startedAt)}</span>
                      <span className="text-muted-foreground">
                        · {r.trigger} · {r.providersOk}/{r.providersOk + r.providersFailed} ağ · {fmtInt(r.stationsUpserted)} istasyon
                      </span>
                    </summary>
                    {r.log && <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{r.log}</pre>}
                  </details>
                </li>
              ))}
              {runs.data?.length === 0 && <li className="text-muted-foreground">Henüz senkron çalışmadı.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ağ</TableHead>
              <TableHead className="text-right">İstasyon</TableHead>
              <TableHead className="text-right">DC</TableHead>
              <TableHead className="text-right">DC kWh</TableHead>
              <TableHead>Son senkron</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: p.color ?? "#16a34a" }} />
                    {p.name}
                    {!p.isActive && <Badge variant="outline">pasif</Badge>}
                    {p.seoContent && <Badge variant="secondary">SEO</Badge>}
                  </span>
                  {p.lastSyncError && <p className="mt-1 max-w-md truncate text-xs text-destructive">{p.lastSyncError}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(p.stationCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(p.dcStationCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtTl(p.minDcPrice)}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDateTime(p.lastSyncedAt)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Bu ağı senkronla"
                    disabled={running}
                    onClick={() => trigger.mutate({ providerIds: [p.id] })}
                  >
                    <ArrowsClockwiseIcon />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Düzenle" onClick={() => setEditing(p)}>
                    <PencilSimpleIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {providers.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Henüz ağ yok. “Tüm ağları senkronla” ile Şarjağ&apos;dan çekin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {editing && <ProviderDialog provider={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
