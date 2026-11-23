"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  ImageIcon,
  Loader2Icon,
  SaveIcon,
  SendIcon,
  Share2Icon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC, type RouterOutputs } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/site/markdown";
import { slugify } from "@/lib/slug";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AiGenerateDialog, type GeneratedPost } from "./ai-generate-dialog";
import { MediaPickerDialog, UploadButton } from "./media-library";

type Post = RouterOutputs["admin"]["post"]["byId"];

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  coverImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  tags: string;
  categoryId: string | null;
  autoShare: boolean;
  socialX: string;
  socialInstagram: string;
  aiGenerated: boolean;
}

const empty: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  coverImageAlt: "",
  seoTitle: "",
  seoDescription: "",
  keywords: "",
  tags: "",
  categoryId: null,
  autoShare: true,
  socialX: "",
  socialInstagram: "",
  aiGenerated: false,
};

const fromPost = (p: Post): FormState => ({
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt ?? "",
  content: p.content,
  coverImageUrl: p.coverImageUrl ?? "",
  coverImageAlt: p.coverImageAlt ?? "",
  seoTitle: p.seoTitle ?? "",
  seoDescription: p.seoDescription ?? "",
  keywords: p.keywords.join(", "),
  tags: p.tags.join(", "),
  categoryId: p.categoryId,
  autoShare: p.autoShare,
  socialX: p.socialX ?? "",
  socialInstagram: p.socialInstagram ?? "",
  aiGenerated: p.aiGenerated,
});

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.length;
  return (
    <span className={cn("text-xs tabular-nums", n === 0 ? "text-muted-foreground" : n < min || n > max ? "text-amber-600" : "text-green-600")}>
      {n} / {min}–{max}
    </span>
  );
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Taslak", variant: "outline" },
  SCHEDULED: { label: "Planlandı", variant: "secondary" },
  PUBLISHED: { label: "Yayında", variant: "default" },
};

export function PostEditor({ postId }: { postId?: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [dirty, setDirty] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [sharePlatforms, setSharePlatforms] = useState<("X" | "INSTAGRAM")[]>(["X", "INSTAGRAM"]);

  const post = useQuery({ ...trpc.admin.post.byId.queryOptions({ id: postId ?? "" }), enabled: Boolean(postId) });
  const categories = useQuery(trpc.admin.category.list.queryOptions());
  const preview = useQuery({ ...trpc.admin.post.sharePreview.queryOptions({ id: postId ?? "" }), enabled: Boolean(postId) });

  // Sunucudan yeni sürüm geldiğinde formu güncelle (render sırasında state ayarlama kalıbı)
  const [loadedStamp, setLoadedStamp] = useState<string | null>(null);
  const stamp = post.data ? new Date(post.data.updatedAt).toISOString() : null;
  if (post.data && stamp !== loadedStamp) {
    setLoadedStamp(stamp);
    setForm(fromPost(post.data));
    setDirty(false);
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.admin.post.pathKey() });
  };

  const payload = () => ({
    title: form.title,
    slug: form.slug || undefined,
    excerpt: form.excerpt,
    content: form.content,
    coverImageUrl: form.coverImageUrl,
    coverImageAlt: form.coverImageAlt,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    keywords: list(form.keywords),
    tags: list(form.tags),
    categoryId: form.categoryId,
    autoShare: form.autoShare,
    socialX: form.socialX,
    socialInstagram: form.socialInstagram,
    aiGenerated: form.aiGenerated,
  });

  const create = useMutation(
    trpc.admin.post.create.mutationOptions({
      onSuccess: (p) => {
        toast.success("Taslak kaydedildi");
        setDirty(false);
        invalidate();
        router.replace(`/admin/yazilar/${p.id}`);
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const update = useMutation(
    trpc.admin.post.update.mutationOptions({
      onSuccess: () => {
        toast.success("Kaydedildi");
        setDirty(false);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const publish = useMutation(
    trpc.admin.post.publish.mutationOptions({
      onSuccess: ({ shares }) => {
        toast.success("Yazı yayınlandı");
        for (const s of shares) {
          if (s.ok) toast.success(`${s.platform === "X" ? "X" : "Instagram"} paylaşımı yapıldı`);
          else toast.error(`${s.platform === "X" ? "X" : "Instagram"}: ${s.error}`);
        }
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const unpublish = useMutation(
    trpc.admin.post.unpublish.mutationOptions({ onSuccess: () => (toast.success("Yayından kaldırıldı"), invalidate()), onError: (e) => toast.error(e.message) }),
  );
  const schedule = useMutation(
    trpc.admin.post.schedule.mutationOptions({ onSuccess: () => (toast.success("Yayın planlandı"), invalidate()), onError: (e) => toast.error(e.message) }),
  );
  const share = useMutation(
    trpc.admin.post.share.mutationOptions({
      onSuccess: (results) => {
        if (!results.length) toast.info("Etkin sosyal medya hesabı yok. Sosyal medya sayfasından bağlayın.");
        for (const s of results) {
          if (s.ok) toast.success(`${s.platform === "X" ? "X" : "Instagram"} paylaşımı yapıldı`);
          else toast.error(`${s.platform === "X" ? "X" : "Instagram"}: ${s.error}`);
        }
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const remove = useMutation(
    trpc.admin.post.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Silindi");
        invalidate();
        router.push("/admin/yazilar");
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const seoAi = useMutation(
    trpc.admin.ai.seoMeta.mutationOptions({
      onSuccess: (d) => {
        setForm((f) => ({
          ...f,
          seoTitle: d.seoTitle,
          seoDescription: d.seoDescription,
          excerpt: f.excerpt || d.excerpt,
          keywords: d.keywords.join(", "),
          tags: f.tags || d.tags.join(", "),
        }));
        setDirty(true);
        toast.success("SEO alanları dolduruldu");
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const socialAi = useMutation(
    trpc.admin.ai.socialCopy.mutationOptions({
      onSuccess: (d) => {
        setForm((f) => ({ ...f, socialX: d.socialX, socialInstagram: d.socialInstagram }));
        setDirty(true);
        toast.success("Sosyal medya metinleri üretildi");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const applyGenerated = (g: GeneratedPost) => {
    setForm((f) => ({
      ...f,
      title: g.title,
      slug: g.slug,
      excerpt: g.excerpt,
      content: g.content,
      seoTitle: g.seoTitle,
      seoDescription: g.seoDescription,
      keywords: g.keywords.join(", "),
      tags: g.tags.join(", "),
      coverImageAlt: f.coverImageAlt || g.coverImageAlt,
      socialX: g.socialX,
      socialInstagram: g.socialInstagram,
      aiGenerated: true,
    }));
    setDirty(true);
  };

  const save = () => {
    if (form.title.trim().length < 3 || !form.content.trim()) {
      toast.error("Başlık ve içerik zorunlu");
      return;
    }
    if (postId) update.mutate({ id: postId, ...payload() });
    else create.mutate(payload());
  };

  const saving = create.isPending || update.isPending;
  const status = post.data?.status ?? "DRAFT";

  if (postId && post.isLoading) return <p className="text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      {/* Üst çubuk */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
        {post.data?.publishedAt && (
          <span className="text-xs text-muted-foreground">
            {status === "SCHEDULED" ? "Planlanan" : "Yayın"}: {fmtDateTime(post.data.publishedAt)}
          </span>
        )}
        {dirty && <span className="text-xs text-amber-600">Kaydedilmemiş değişiklikler</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <AiGenerateDialog categoryId={form.categoryId} onGenerated={applyGenerated} />
          {status === "PUBLISHED" && post.data && (
            <Button asChild variant="outline">
              <a href={`/blog/${post.data.slug}`} target="_blank" rel="noopener">
                <ExternalLinkIcon data-icon="inline-start" /> Görüntüle
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            Kaydet
          </Button>
          {postId &&
            (status === "PUBLISHED" ? (
              <Button variant="outline" onClick={() => unpublish.mutate({ id: postId })} disabled={unpublish.isPending}>
                Yayından kaldır
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (dirty) {
                    toast.error("Önce değişiklikleri kaydedin");
                    return;
                  }
                  publish.mutate({ id: postId });
                }}
                disabled={publish.isPending}
              >
                {publish.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
                Yayınla
              </Button>
            ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Ana içerik */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="title">Başlık</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({ ...f, title, slug: postId || f.slug !== slugify(f.title, 90) ? f.slug : slugify(title, 90) }));
                    setDirty(true);
                  }}
                  className="h-11 text-lg font-semibold"
                  placeholder="Yazı başlığı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL (slug)</Label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">/blog/</span>
                  <Input id="slug" value={form.slug} onChange={(e) => set("slug", slugify(e.target.value, 90))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Özet</Label>
                <Textarea id="excerpt" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="write">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="write">Yaz (Markdown)</TabsTrigger>
                    <TabsTrigger value="preview">Önizleme</TabsTrigger>
                  </TabsList>
                  <span className="text-xs text-muted-foreground">{form.content.split(/\s+/).filter(Boolean).length} kelime</span>
                </div>
                <TabsContent value="write" className="mt-4">
                  <Textarea
                    value={form.content}
                    onChange={(e) => set("content", e.target.value)}
                    className="min-h-[560px] font-mono text-sm leading-6"
                    placeholder={"## Alt başlık\n\nParagraf metni…\n\n## Sık sorulan sorular\n\n### Soru?\n\nCevap."}
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-4 min-h-[560px] rounded-lg border p-6">
                  {form.content ? <Markdown content={form.content} /> : <p className="text-muted-foreground">İçerik yok.</p>}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Yan panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kapak görseli</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.coverImageUrl ? (
                <div className="relative overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.coverImageUrl} alt={form.coverImageAlt} className="aspect-video w-full object-cover" />
                  <Button size="icon-sm" variant="secondary" className="absolute right-2 top-2" onClick={() => set("coverImageUrl", "")} aria-label="Görseli kaldır">
                    <XIcon />
                  </Button>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImageIcon className="size-8" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <UploadButton onUploaded={(m) => set("coverImageUrl", m.url)} />
                <MediaPickerDialog
                  onPick={(m) => {
                    set("coverImageUrl", m.url);
                    if (m.alt && !form.coverImageAlt) set("coverImageAlt", m.alt);
                  }}
                  trigger={
                    <Button variant="ghost" type="button">
                      Kütüphaneden seç
                    </Button>
                  }
                />
              </div>
              <Input value={form.coverImageAlt} onChange={(e) => set("coverImageAlt", e.target.value)} placeholder="Alt metin (erişilebilirlik ve SEO)" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kategori ve etiketler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={form.categoryId ?? "none"} onValueChange={(v) => set("categoryId", v === "none" ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kategorisiz</SelectItem>
                  {categories.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <Label htmlFor="tags">Etiketler (virgülle)</Label>
                <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">SEO</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                disabled={seoAi.isPending || form.content.length < 50}
                onClick={() => seoAi.mutate({ title: form.title, content: form.content })}
              >
                {seoAi.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                AI ile doldur
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label htmlFor="seo-title">Meta başlık</Label>
                  <Counter value={form.seoTitle} min={30} max={60} />
                </div>
                <Input id="seo-title" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label htmlFor="seo-desc">Meta açıklama</Label>
                  <Counter value={form.seoDescription} min={120} max={160} />
                </div>
                <Textarea id="seo-desc" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} rows={3} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="keywords">Anahtar kelimeler</Label>
                <Input id="keywords" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Google önizlemesi</p>
                <p className="mt-1 truncate text-sm text-[#1a0dab] dark:text-blue-400">{form.seoTitle || form.title || "Başlık"}</p>
                <p className="truncate text-xs text-green-700">enyakinsarj.com.tr › blog › {form.slug || "…"}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{form.seoDescription || form.excerpt || "Açıklama"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Sosyal medya</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                disabled={socialAi.isPending || form.content.length < 50}
                onClick={() => socialAi.mutate({ title: form.title, excerpt: form.excerpt, content: form.content })}
              >
                {socialAi.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                AI ile yaz
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="autoshare" className="font-normal">
                  Yayınlanınca otomatik paylaş
                </Label>
                <Switch id="autoshare" checked={form.autoShare} onCheckedChange={(v) => set("autoShare", v)} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label htmlFor="sx">X metni</Label>
                  <span className="text-xs text-muted-foreground">{form.socialX.length}/280 · {"{url}"} = bağlantı</span>
                </div>
                <Textarea id="sx" value={form.socialX} onChange={(e) => set("socialX", e.target.value)} rows={3} placeholder="Boş bırakılırsa şablon kullanılır" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label htmlFor="si">Instagram açıklaması</Label>
                  <span className="text-xs text-muted-foreground">{form.socialInstagram.length}/2200</span>
                </div>
                <Textarea id="si" value={form.socialInstagram} onChange={(e) => set("socialInstagram", e.target.value)} rows={5} placeholder="Instagram için kapak görseli gerekir" />
              </div>

              {postId && status === "PUBLISHED" && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Şimdi paylaş</p>
                  <div className="flex gap-4">
                    {(["X", "INSTAGRAM"] as const).map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={sharePlatforms.includes(p)}
                          onCheckedChange={(v) => setSharePlatforms((cur) => (v ? [...cur, p] : cur.filter((x) => x !== p)))}
                        />
                        {p === "X" ? "X" : "Instagram"}
                        {preview.data && !preview.data.find((x) => x.platform === p)?.enabled && (
                          <span className="text-xs text-muted-foreground">(kapalı)</span>
                        )}
                      </label>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={share.isPending || !sharePlatforms.length || dirty}
                    onClick={() => share.mutate({ id: postId, platforms: sharePlatforms })}
                  >
                    {share.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <Share2Icon data-icon="inline-start" />}
                    Paylaş
                  </Button>
                </div>
              )}

              {post.data?.socialPosts.length ? (
                <ul className="space-y-1.5 text-xs">
                  {post.data.socialPosts.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>
                        <Badge variant={s.status === "SUCCESS" ? "secondary" : "destructive"} className="mr-1.5">
                          {s.platform === "X" ? "X" : "IG"}
                        </Badge>
                        {s.status === "SUCCESS" ? (
                          s.url ? (
                            <a href={s.url} target="_blank" rel="noopener" className="text-primary hover:underline">
                              gönderi
                            </a>
                          ) : (
                            "paylaşıldı"
                          )
                        ) : (
                          <span className="text-destructive" title={s.error ?? ""}>
                            hata
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">{fmtDateTime(s.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          {postId && status !== "PUBLISHED" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Yayını planla</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!scheduleAt || schedule.isPending || dirty}
                  onClick={() => schedule.mutate({ id: postId, publishAt: new Date(scheduleAt) })}
                >
                  <CalendarClockIcon data-icon="inline-start" /> Planla
                </Button>
                <p className="text-xs text-muted-foreground">Zamanı gelince cron yayınlar ve otomatik paylaşım açıksa sosyal medyada paylaşır.</p>
              </CardContent>
            </Card>
          )}

          {postId && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => confirm("Yazı kalıcı olarak silinsin mi?") && remove.mutate({ id: postId })}
            >
              <Trash2Icon data-icon="inline-start" /> Yazıyı sil
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
