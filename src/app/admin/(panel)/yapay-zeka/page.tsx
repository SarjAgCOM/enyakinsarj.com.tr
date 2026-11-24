"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOutIcon, CheckCircleIcon, PlugsConnectedIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useTRPC, type RouterOutputs } from "@/trpc/react";
import { AdminPageTitle } from "@/components/admin/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Settings = RouterOutputs["admin"]["ai"]["settings"];
type ProviderId = Settings["providers"][number]["id"];

function SettingsForm({ settings, onChanged }: { settings: Settings; onChanged: (runTest: boolean) => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  // Panelde kayıt yoksa en çok işe yarayan seçenek (ücretsiz Gemini) önerilir.
  const [provider, setProvider] = useState<ProviderId>(settings.provider ?? "gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(settings.model ?? "");
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  const info = settings.providers.find((p) => p.id === provider)!;
  const keySaved = settings.hasKey && settings.provider === provider;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: trpc.admin.ai.settings.queryKey() });
    void qc.invalidateQueries({ queryKey: trpc.admin.ai.status.queryKey() });
    void qc.invalidateQueries({ queryKey: trpc.admin.dashboard.overview.queryKey() });
  };

  const save = useMutation(
    trpc.admin.ai.saveSettings.mutationOptions({
      onSuccess: (r) => {
        setApiKey("");
        setError(null);
        toast.success(r.label ? `Kaydedildi: ${r.label}` : "Kaydedildi: yapay zekâ kapalı");
        refresh();
        // Kayıttan sonra anahtar ve model hemen sınanır.
        onChanged(Boolean(r.label));
      },
      onError: (e) => setError(e.message),
    }),
  );
  const reset = useMutation(
    trpc.admin.ai.resetSettings.mutationOptions({
      onSuccess: () => {
        toast.success("Panel ayarı silindi. Ortam değişkenleri kullanılıyor.");
        refresh();
        onChanged(false);
      },
      onError: (e) => setError(e.message),
    }),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (info.needsKey && !apiKey.trim() && !keySaved) {
      setError(`${info.label} için API anahtarı girin.`);
      return;
    }
    if (provider === "custom" && (!baseUrl.trim() || !model.trim())) {
      setError("Özel servis için adres ve model adı zorunludur.");
      return;
    }
    save.mutate({
      provider,
      apiKey: apiKey.trim() || undefined,
      model: model.trim() || undefined,
      baseUrl: provider === "custom" ? baseUrl.trim() : undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sağlayıcı ayarı</CardTitle>
        <CardDescription>
          Buradan kaydedilen ayar ortam değişkenlerinin önüne geçer ve yeniden deploy gerektirmez. Anahtar veritabanında
          şifreli saklanır ve bu ekranda bir daha gösterilmez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-provider">Sağlayıcı</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as ProviderId);
                setApiKey("");
                setModel("");
                setError(null);
              }}
            >
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="caption-2 text-muted-foreground">{info.note}</p>
          </div>

          {info.needsKey && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ai-key">API anahtarı</Label>
                {info.keyUrl && (
                  <a
                    href={info.keyUrl}
                    target="_blank"
                    rel="noopener"
                    className="caption-1 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    Anahtar al <ArrowSquareOutIcon aria-hidden className="size-3" />
                  </a>
                )}
              </div>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keySaved ? `Kayıtlı anahtar: ••••${settings.keyHint}` : "Anahtarı buraya yapıştırın"}
              />
              {keySaved && <p className="caption-2 text-muted-foreground">Değiştirmek istemiyorsanız boş bırakın.</p>}
            </div>
          )}

          {provider === "custom" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-base">Servis adresi</Label>
              <Input
                id="ai-base"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://ornek.com/v1"
              />
            </div>
          )}

          {info.needsKey && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-model">Model {provider === "custom" ? "" : "(isteğe bağlı)"}</Label>
              <Input
                id="ai-model"
                spellCheck={false}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={info.defaultModel ? `Varsayılan: ${info.defaultModel}` : "Model adı"}
              />
              {provider !== "custom" && (
                <p className="caption-2 text-muted-foreground">
                  Boş bırakırsanız varsayılan model kullanılır. “Model bulunamadı” hatası alırsanız sağlayıcının güncel
                  listesinden bir ad yazın.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="caption-1 text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Kaydediliyor" : "Ayarı kaydet"}
            </Button>
            {settings.source === "panel" && (
              <Button type="button" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
                Panel ayarını sil
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type TestMutation = ReturnType<typeof useTestMutation>;

function useTestMutation() {
  const trpc = useTRPC();
  return useMutation(trpc.admin.ai.test.mutationOptions());
}

function StatusCard({ settings, test }: { settings: Settings; test: TestMutation }) {
  const eff = settings.effective;
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Etkin servis</CardTitle>
        <CardDescription>
          {settings.source === "panel"
            ? "Bu ekrandan kaydedilen ayar kullanılıyor."
            : "Ortam değişkenleri kullanılıyor."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {eff ? (
          <div className="flex flex-col gap-1">
            <p className="title-3">{eff.label}</p>
            <p className="caption-5 font-mono text-muted-foreground">{eff.model}</p>
          </div>
        ) : (
          <p className="title-3">Yapay zekâ kapalı</p>
        )}
        {eff?.limited && (
          <p className="caption-2 flex gap-2 text-warning">
            <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            Anahtarsız servis yalnızca SEO ve sosyal medya metni üretir. Blog yazısı ve yapay zekâ destekli arama için
            ücretsiz bir Gemini veya Groq anahtarı kaydedin.
          </p>
        )}
        <Button type="button" variant="outline" disabled={!eff || test.isPending} onClick={() => test.mutate()}>
          <PlugsConnectedIcon data-icon="inline-start" />
          {test.isPending ? "Test ediliyor" : "Bağlantıyı test et"}
        </Button>
        {test.isPending && eff?.limited && (
          <p className="caption-2 text-muted-foreground">Anahtarsız serviste yanıt bir dakikayı bulabilir.</p>
        )}
        {test.data?.ok && (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Badge variant="secondary" className="bg-success/10 text-success">
              <CheckCircleIcon data-icon="inline-start" /> Çalışıyor, {(test.data.ms / 1000).toFixed(1)} sn
            </Badge>
            <p className="caption-2 text-muted-foreground">Örnek yanıt: {test.data.reply}</p>
          </div>
        )}
        {test.data && !test.data.ok && (
          <p role="alert" className="caption-1 text-destructive">
            {test.data.message}
          </p>
        )}
        {test.error && (
          <p role="alert" className="caption-1 text-destructive">
            {test.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiSettingsPage() {
  const trpc = useTRPC();
  const settings = useQuery(trpc.admin.ai.settings.queryOptions());
  // Test sonucu, kayıttan sonra form yeniden kurulsa da ekranda kalsın diye burada tutulur.
  const test = useTestMutation();

  return (
    <>
      <AdminPageTitle
        title="Yapay zekâ"
        description="Blog yazısı üretimi, SEO ve sosyal medya metinleri ile arama kutusunun kullandığı servisi seçin."
      />
      {settings.isLoading && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]" aria-busy>
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      )}
      {settings.error && (
        <p role="alert" className="body-6 text-destructive">
          {settings.error.message}
        </p>
      )}
      {settings.data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Kayıt veya silme sonrasında form yeni değerlerle baştan kurulur. */}
          <SettingsForm
            key={`${settings.data.source}:${settings.data.provider}:${settings.data.keyHint}:${settings.data.model}`}
            settings={settings.data}
            onChanged={(runTest) => (runTest ? test.mutate() : test.reset())}
          />
          <StatusCard settings={settings.data} test={test} />
        </div>
      )}
    </>
  );
}
