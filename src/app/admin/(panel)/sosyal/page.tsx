"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC, type RouterOutputs } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/format";

type Account = RouterOutputs["admin"]["social"]["accounts"][number];

const FIELDS = {
  X: [
    { key: "apiKey", label: "API Key (Consumer Key)" },
    { key: "apiSecret", label: "API Key Secret" },
    { key: "accessToken", label: "Access Token" },
    { key: "accessTokenSecret", label: "Access Token Secret" },
  ],
  INSTAGRAM: [
    { key: "igUserId", label: "Instagram Business hesap ID" },
    { key: "accessToken", label: "Uzun ömürlü erişim anahtarı (Page/User token)" },
  ],
} as const;

const HELP = {
  X: "developer.x.com → Proje → App → Keys and tokens. Uygulama izinleri 'Read and Write' olmalı; izin değiştikten sonra Access Token'ı yeniden üretin.",
  INSTAGRAM:
    "Instagram Business/Creator hesabı bir Facebook sayfasına bağlı olmalı. Meta for Developers → uygulama → instagram_basic ve instagram_content_publish izinleriyle uzun ömürlü token alın. Görseller herkese açık URL olmalı (Oracle bucket public).",
};

function AccountCard({ account }: { account: Account }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState(account.template);
  const refresh = () => void qc.invalidateQueries({ queryKey: trpc.admin.social.accounts.queryKey() });

  const save = useMutation(
    trpc.admin.social.saveCredentials.mutationOptions({
      onSuccess: (r) => {
        if (r.verified) toast.success(`Bağlandı: ${r.accountName}`);
        else toast.warning("Kaydedildi ancak hesap doğrulanamadı; bilgileri kontrol edin.");
        setCreds({});
        refresh();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const update = useMutation(
    trpc.admin.social.update.mutationOptions({ onSuccess: () => (toast.success("Güncellendi"), refresh()), onError: (e) => toast.error(e.message) }),
  );

  const fields = FIELDS[account.platform];
  const complete = fields.every((f) => creds[f.key]?.trim());
  const name = account.platform === "X" ? "X (Twitter)" : "Instagram";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {name}
          {account.hasCredentials ? (
            <Badge variant="secondary">
              <CheckCircle2Icon data-icon="inline-start" /> {account.accountName ?? "Bağlı"}
            </Badge>
          ) : (
            <Badge variant="outline">Bağlı değil</Badge>
          )}
        </CardTitle>
        <CardDescription>{HELP[account.platform]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor={`en-${account.platform}`}>Paylaşım etkin</Label>
          <Switch
            id={`en-${account.platform}`}
            checked={account.enabled}
            disabled={!account.hasCredentials}
            onCheckedChange={(v) => update.mutate({ platform: account.platform, enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor={`auto-${account.platform}`}>Yazı yayınlanınca otomatik paylaş</Label>
          <Switch
            id={`auto-${account.platform}`}
            checked={account.autoShareOnPublish}
            onCheckedChange={(v) => update.mutate({ platform: account.platform, autoShareOnPublish: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>Varsayılan paylaşım şablonu</Label>
          <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} />
          <p className="text-xs text-muted-foreground">
            Değişkenler: {"{title} {excerpt} {url} {tags}"} — yazıya özel metin girilmişse o kullanılır.
          </p>
          <Button size="sm" variant="outline" onClick={() => update.mutate({ platform: account.platform, template })}>
            Şablonu kaydet
          </Button>
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">{account.hasCredentials ? "Kimlik bilgilerini güncelle" : "Hesabı bağla"}</p>
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`${account.platform}-${f.key}`}>{f.label}</Label>
              <Input
                id={`${account.platform}-${f.key}`}
                type="password"
                autoComplete="off"
                value={creds[f.key] ?? ""}
                onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button
            disabled={!complete || save.isPending}
            onClick={() =>
              save.mutate(
                account.platform === "X"
                  ? {
                      platform: "X",
                      credentials: {
                        apiKey: creds.apiKey,
                        apiSecret: creds.apiSecret,
                        accessToken: creds.accessToken,
                        accessTokenSecret: creds.accessTokenSecret,
                      },
                    }
                  : { platform: "INSTAGRAM", credentials: { igUserId: creds.igUserId, accessToken: creds.accessToken } },
              )
            }
          >
            {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            Kaydet ve doğrula
          </Button>
          <p className="text-xs text-muted-foreground">Bilgiler veritabanında AES-256-GCM ile şifrelenerek saklanır ve bir daha gösterilmez.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialPage() {
  const trpc = useTRPC();
  const accounts = useQuery(trpc.admin.social.accounts.queryOptions());
  const [page, setPage] = useState(1);
  const logs = useQuery(trpc.admin.social.logs.queryOptions({ page }));

  return (
    <>
      <AdminPageTitle
        title="Sosyal medya"
        description="Blog yazıları yayınlandığında X ve Instagram'da otomatik paylaşılır. Planlı yazılar cron ile yayınlanıp paylaşılır."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {accounts.data?.map((a) => (
          <AccountCard key={`${a.platform}-${a.updatedAt?.toString() ?? ""}`} account={a} />
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Paylaşım geçmişi</h2>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Yazı</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.data?.items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.platform === "X" ? "X" : "Instagram"}</TableCell>
                <TableCell className="max-w-sm truncate">
                  <Link href={`/admin/yazilar/${s.post.id}`} className="hover:text-primary">
                    {s.post.title}
                  </Link>
                </TableCell>
                <TableCell>
                  {s.status === "SUCCESS" ? (
                    <span className="flex items-center gap-1.5 text-green-700">
                      <CheckCircle2Icon className="size-4" />
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener" className="hover:underline">
                          Gönderi
                        </a>
                      ) : (
                        "Başarılı"
                      )}
                    </span>
                  ) : s.status === "FAILED" ? (
                    <span className="flex items-center gap-1.5 text-destructive" title={s.error ?? ""}>
                      <XCircleIcon className="size-4" /> <span className="max-w-xs truncate">{s.error}</span>
                    </span>
                  ) : (
                    "Bekliyor"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtDateTime(s.createdAt)}</TableCell>
              </TableRow>
            ))}
            {logs.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Henüz paylaşım yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {logs.data && logs.data.pages > 1 && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </Button>
          <Button size="sm" variant="outline" disabled={page >= logs.data.pages} onClick={() => setPage((p) => p + 1)}>
            Sonraki
          </Button>
        </div>
      )}
    </>
  );
}
