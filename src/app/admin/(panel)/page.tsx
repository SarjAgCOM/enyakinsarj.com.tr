"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircleIcon, PlusIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import { useTRPC } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDateTime, fmtInt } from "@/lib/format";

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircleIcon className="mt-0.5 size-4 text-green-600" /> : <WarningIcon className="mt-0.5 size-4 text-amber-500" />}
      <span>
        <span className="font-medium">{label}</span>
        {!ok && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </li>
  );
}

export default function DashboardPage() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.admin.dashboard.overview.queryOptions());
  const me = useQuery(trpc.admin.sync.sarjagMe.queryOptions());

  return (
    <>
      <AdminPageTitle
        title="Pano"
        description="Site, istasyon verisi ve içerik durumuna genel bakış"
        actions={
          <Button asChild>
            <Link href="/admin/yazilar/yeni">
              <PlusIcon data-icon="inline-start" /> Yeni yazı
            </Link>
          </Button>
        }
      />
      {!data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "İstasyon", value: fmtInt(data.stats.stations), hint: `${fmtInt(data.stats.dc)} DC` },
              { label: "Şarj ağı", value: fmtInt(data.stats.providers), hint: `${data.stats.cities} il` },
              { label: "Yayındaki yazı", value: fmtInt(data.posts.published), hint: `${data.posts.drafts} taslak · ${data.posts.scheduled} planlı` },
              {
                label: "Şarjağ token bakiyesi",
                value: me.data?.ok ? fmtInt(me.data.tokens.balance) : "—",
                hint: me.data?.ok ? me.data.project.name : (me.data?.error ?? "yükleniyor…"),
              },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">{s.hint}</CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Kurulum durumu</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <Check ok={me.data?.ok ?? false} label="Şarjağ API" hint="SARJAG_API_KEY tanımlayın" />
                  <Check ok={data.stats.stations > 0} label="İstasyon verisi" hint="Şarj ağları sayfasından senkron başlatın" />
                  <Check ok={data.ai} label="Yapay zekâ (Claude)" hint="ANTHROPIC_API_KEY tanımlayın" />
                  <Check ok={data.storage} label="Oracle Object Storage" hint="OCI_* değişkenlerini tanımlayın" />
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Son senkron</CardTitle>
                <CardDescription>{data.lastRun ? fmtDateTime(data.lastRun.startedAt) : "Henüz çalışmadı"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.lastRun ? (
                  <>
                    <Badge variant={data.lastRun.status === "FAILED" ? "destructive" : "secondary"}>{data.lastRun.status}</Badge>
                    <p>
                      {data.lastRun.providersOk} ağ başarılı, {data.lastRun.providersFailed} hatalı ·{" "}
                      {fmtInt(data.lastRun.stationsUpserted)} istasyon
                    </p>
                  </>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/istasyonlar">Senkron yönetimi</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>En çok okunan yazılar</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {data.topPosts.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <Link href={`/admin/yazilar/${p.id}`} className="truncate hover:text-primary">
                        {p.title}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">{fmtInt(p.viewCount)}</span>
                    </li>
                  ))}
                  {data.topPosts.length === 0 && <li className="text-muted-foreground">Henüz yazı yok.</li>}
                </ol>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Son sosyal medya paylaşımları</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {data.recentShares.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {s.status === "SUCCESS" ? (
                        <CheckCircleIcon className="size-4 shrink-0 text-green-600" />
                      ) : (
                        <XCircleIcon className="size-4 shrink-0 text-destructive" />
                      )}
                      <Badge variant="outline">{s.platform === "X" ? "X" : "Instagram"}</Badge>
                      <span className="truncate">{s.post.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(s.createdAt)}</span>
                  </li>
                ))}
                {data.recentShares.length === 0 && <li className="py-2 text-muted-foreground">Henüz paylaşım yok.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
