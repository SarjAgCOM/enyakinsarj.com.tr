"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOutIcon, ArrowsClockwiseIcon, PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useTRPC, type RouterOutputs } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Overview = RouterOutputs["admin"]["news"]["overview"];
type Status = "NEW" | "GENERATED" | "SKIPPED" | "FAILED";

const TABS: { id: Status; label: string }[] = [
  { id: "NEW", label: "Bekleyen" },
  { id: "GENERATED", label: "Üretilen" },
  { id: "FAILED", label: "Hatalı" },
  { id: "SKIPPED", label: "Atlanan" },
];

function useRefresh() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: trpc.admin.news.overview.queryKey() });
    void qc.invalidateQueries({ queryKey: trpc.admin.news.items.queryKey() });
  };
}

function SettingsCard({ overview, isAdmin }: { overview: Overview; isAdmin: boolean }) {
  const trpc = useTRPC();
  const refresh = useRefresh();
  const [form, setForm] = useState({
    enabled: overview.settings.enabled,
    autoPublish: overview.settings.autoPublish,
    dailyLimit: String(overview.settings.dailyLimit),
    intervalMinutes: String(overview.settings.intervalMinutes),
  });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation(
    trpc.admin.news.saveSettings.mutationOptions({
      onSuccess: () => (toast.success("Haber akışı ayarı kaydedildi"), setError(null), refresh()),
      onError: (e) => setError(e.message),
    }),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const dailyLimit = Number(form.dailyLimit);
    const intervalMinutes = Number(form.intervalMinutes);
    if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 50) return setError("Günlük sınır 1 ile 50 arasında olmalı.");
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 15 || intervalMinutes > 1440) {
      return setError("Tarama aralığı 15 ile 1440 dakika arasında olmalı.");
    }
    save.mutate({ enabled: form.enabled, autoPublish: form.autoPublish, dailyLimit, intervalMinutes });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Otomasyon</CardTitle>
        <CardDescription>
          Son tarama {overview.settings.lastFetchedAt ? fmtDateTime(overview.settings.lastFetchedAt) : "henüz yapılmadı"}. Son 24
          saatte {overview.today} haber üretildi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="news-enabled">Otomatik tarama ve üretim</Label>
              <p className="caption-2 text-muted-foreground">Kaynaklar düzenli taranır, kuyruktaki haberler sırayla yazıya dönüştürülür.</p>
            </div>
            <Switch id="news-enabled" disabled={!isAdmin} checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="news-publish">Üretilen haberi doğrudan yayınla</Label>
              <p className="caption-2 text-muted-foreground">
                Kapalıyken haberler taslak olarak bekler ve siz onaylayınca yayınlanır. Açıkken yazılar kontrol edilmeden yayınlanır
                ve bağlı sosyal hesaplarda paylaşılır.
              </p>
            </div>
            <Switch id="news-publish" disabled={!isAdmin} checked={form.autoPublish} onCheckedChange={(v) => setForm((f) => ({ ...f, autoPublish: v }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="news-limit">Günlük haber sınırı</Label>
              <Input id="news-limit" inputMode="numeric" disabled={!isAdmin} value={form.dailyLimit} onChange={(e) => setForm((f) => ({ ...f, dailyLimit: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="news-interval">Tarama aralığı (dakika)</Label>
              <Input id="news-interval" inputMode="numeric" disabled={!isAdmin} value={form.intervalMinutes} onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: e.target.value }))} />
            </div>
          </div>
          {error && (
            <p role="alert" className="caption-1 text-destructive">
              {error}
            </p>
          )}
          {isAdmin ? (
            <Button type="submit" className="self-start" disabled={save.isPending}>
              {save.isPending ? "Kaydediliyor" : "Ayarı kaydet"}
            </Button>
          ) : (
            <p className="caption-2 text-muted-foreground">Ayarları yalnızca yönetici değiştirebilir.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function SourcesCard({ overview, isAdmin }: { overview: Overview; isAdmin: boolean }) {
  const trpc = useTRPC();
  const refresh = useRefresh();
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation(
    trpc.admin.news.addSource.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Kaynak eklendi: ${r.items} haberden ${r.evItems} tanesi elektrikli araçlarla ilgili`);
        setName("");
        setFeedUrl("");
        setError(null);
        refresh();
      },
      onError: (e) => setError(e.message),
    }),
  );
  const update = useMutation(trpc.admin.news.updateSource.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));
  const remove = useMutation(
    trpc.admin.news.deleteSource.mutationOptions({ onSuccess: () => (toast.success("Kaynak silindi"), refresh()), onError: (e) => toast.error(e.message) }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kaynaklar</CardTitle>
        <CardDescription>Taranan RSS akışları. Yalnızca elektrikli araç ve şarj haberleri kuyruğa alınır.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {overview.sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <Switch
                aria-label={`${s.name} kaynağını ${s.enabled ? "kapat" : "aç"}`}
                disabled={!isAdmin}
                checked={s.enabled}
                onCheckedChange={(enabled) => update.mutate({ id: s.id, enabled })}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="title-4 truncate">{s.name}</span>
                {s.lastError ? (
                  <span className="caption-5 truncate text-destructive" title={s.lastError}>
                    Hata: {s.lastError}
                  </span>
                ) : (
                  <span className="caption-5 truncate text-muted-foreground">
                    {s.lastFetchedAt ? `Son tarama ${fmtDateTime(s.lastFetchedAt)}` : new URL(s.feedUrl).hostname}
                  </span>
                )}
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon-sm" aria-label={`${s.name} kaynağını sil`} disabled={remove.isPending} onClick={() => remove.mutate({ id: s.id })}>
                  <TrashIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form
            noValidate
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2 || !/^https?:\/\/\S+$/i.test(feedUrl.trim())) return setError("Kaynak adını ve http ile başlayan RSS adresini girin.");
              add.mutate({ name: name.trim(), feedUrl: feedUrl.trim() });
            }}
          >
            <Label htmlFor="source-name">Yeni kaynak</Label>
            <Input id="source-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yayın adı" />
            <Input aria-label="RSS adresi" type="url" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://ornek.com/feed" />
            {error && (
              <p role="alert" className="caption-1 text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" variant="outline" className="self-start" disabled={add.isPending}>
              <PlusIcon data-icon="inline-start" /> {add.isPending ? "Akış denetleniyor" : "Kaynak ekle"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Queue({ overview }: { overview: Overview }) {
  const trpc = useTRPC();
  const refresh = useRefresh();
  const [status, setStatus] = useState<Status>("NEW");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const items = useQuery(trpc.admin.news.items.queryOptions({ status, page }));

  const fetchNow = useMutation(
    trpc.admin.news.fetchNow.mutationOptions({
      onSuccess: (r) => {
        if (r.errors.length) toast.warning(`${r.added} yeni haber kuyruğa alındı. ${r.errors.length} kaynak okunamadı.`);
        else toast.success(`${r.sources} kaynak tarandı, ${r.added} yeni haber kuyruğa alındı`);
        refresh();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const generate = useMutation(
    trpc.admin.news.generate.mutationOptions({
      onSuccess: (r) => {
        if (r.status === "GENERATED") toast.success("published" in r && r.published ? "Haber yayınlandı" : "Haber taslağı oluşturuldu");
        else toast.warning(`Haber atlandı: ${r.note}`);
      },
      onError: (e) => toast.error(e.message),
      onSettled: () => (setBusy(null), refresh()),
    }),
  );
  const setItemStatus = useMutation(trpc.admin.news.setStatus.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(e.message) }));

  const run = (id: string, publish: boolean) => {
    setBusy(id);
    generate.mutate({ id, publish });
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="queue-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="queue-title" className="heading-6">
            Haber kuyruğu
          </h2>
          <p className="caption-2 text-muted-foreground">Yazılar kaynak haberdeki bilgilerden özgün olarak yazılır ve kaynağa bağlantı verir.</p>
        </div>
        <Button variant="outline" disabled={fetchNow.isPending} onClick={() => fetchNow.mutate()}>
          <ArrowsClockwiseIcon data-icon="inline-start" /> {fetchNow.isPending ? "Kaynaklar taranıyor" : "Kaynakları şimdi tara"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Haber durumu">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={status === t.id}
            onClick={() => (setStatus(t.id), setPage(1))}
            className={cn("chip", status === t.id && "border-foreground bg-foreground text-background hover:border-foreground hover:text-background")}
          >
            {t.label} <span className="caption-2 tabular-nums opacity-60">{overview.counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {items.isLoading && <Skeleton className="h-64 rounded-2xl" />}
      {items.error && (
        <p role="alert" className="body-6 text-destructive">
          {items.error.message}
        </p>
      )}
      {items.data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-surface p-10 text-center">
          <p className="title-3">{status === "NEW" ? "Kuyrukta bekleyen haber yok" : "Bu bölümde haber yok"}</p>
          {status === "NEW" && <p className="body-6 text-muted-foreground">“Kaynakları şimdi tara” ile yeni haberleri kuyruğa alabilirsiniz.</p>}
        </div>
      )}
      {items.data && items.data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.data.items.map((it) => (
            <li key={it.id} className="surface-card flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a href={it.url} target="_blank" rel="noopener" className="title-4 inline-flex items-start gap-1 hover:text-primary">
                  <span className="line-clamp-2">{it.title}</span>
                  <ArrowSquareOutIcon aria-hidden className="mt-0.5 size-3 shrink-0" />
                </a>
                <p className="caption-5 text-muted-foreground">
                  {it.source.name} · {fmtDateTime(it.publishedAt ?? it.createdAt)}
                </p>
                {it.note && <p className={cn("caption-5", it.status === "SKIPPED" ? "text-muted-foreground" : "text-destructive")}>{it.note}</p>}
                {it.post && (
                  <p className="caption-2 flex flex-wrap items-center gap-2">
                    <Badge variant={it.post.status === "PUBLISHED" ? "default" : "secondary"}>{it.post.status === "PUBLISHED" ? "Yayında" : "Taslak"}</Badge>
                    <Link href={`/admin/yazilar/${it.post.id}`} className="text-primary underline-offset-4 hover:underline">
                      {it.post.title}
                    </Link>
                  </p>
                )}
              </div>
              {!it.post && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {(it.status === "NEW" || it.status === "FAILED") && (
                    <>
                      <Button size="sm" disabled={busy !== null || !overview.aiReady} onClick={() => run(it.id, false)}>
                        {busy === it.id ? "Yazılıyor" : "Taslak üret"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy !== null || !overview.aiReady} onClick={() => run(it.id, true)}>
                        Üret ve yayınla
                      </Button>
                    </>
                  )}
                  {it.status === "SKIPPED" ? (
                    <Button size="sm" variant="ghost" onClick={() => setItemStatus.mutate({ id: it.id, status: "NEW" })}>
                      Kuyruğa al
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setItemStatus.mutate({ id: it.id, status: "SKIPPED" })}>
                      Atla
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.data && items.data.pages > 1 && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki sayfa
          </Button>
          <span className="caption-2 tabular-nums text-muted-foreground">
            {page} / {items.data.pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= items.data.pages} onClick={() => setPage((p) => p + 1)}>
            Sonraki sayfa
          </Button>
        </div>
      )}
    </section>
  );
}

export default function NewsPage() {
  const trpc = useTRPC();
  const overview = useQuery(trpc.admin.news.overview.queryOptions());

  return (
    <>
      <AdminPageTitle
        title="Haber akışı"
        description="Türkiye'deki otomobil ve teknoloji yayınlarından elektrikli araç haberlerini toplar, yapay zekâ ile özgün haber yazısına dönüştürür."
      />
      {overview.isLoading && <Skeleton className="h-96 rounded-2xl" />}
      {overview.error && (
        <p role="alert" className="body-6 text-destructive">
          {overview.error.message}
        </p>
      )}
      {overview.data && (
        <div className="flex flex-col gap-8">
          {!overview.data.aiReady && (
            <p role="alert" className="caption-1 flex gap-2 rounded-2xl border bg-surface p-4 text-warning">
              <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                Haber yazısı üretmek için anahtarlı bir yapay zekâ sağlayıcısı gerekli.{" "}
                <Link href="/admin/yapay-zeka" className="underline underline-offset-4">
                  Yapay zekâ sayfasından
                </Link>{" "}
                ücretsiz bir Gemini veya Groq anahtarı kaydedin. Kaynakları taramak anahtar gerektirmez.
              </span>
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <SettingsCard overview={overview.data} isAdmin={overview.data.isAdmin} />
            <SourcesCard overview={overview.data} isAdmin={overview.data.isAdmin} />
          </div>
          <Queue overview={overview.data} />
        </div>
      )}
    </>
  );
}
