"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC, type RouterOutputs } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type GeneratedPost = RouterOutputs["admin"]["ai"]["generatePost"];

export function AiGenerateDialog({
  categoryId,
  onGenerated,
}: {
  categoryId?: string | null;
  onGenerated: (p: GeneratedPost) => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState<"bilgilendirici" | "samimi" | "teknik" | "haber">("bilgilendirici");
  const [length, setLength] = useState<"kisa" | "orta" | "uzun">("orta");
  const [instructions, setInstructions] = useState("");
  const [useSiteData, setUseSiteData] = useState(true);

  const gen = useMutation(
    trpc.admin.ai.generatePost.mutationOptions({
      onSuccess: (data) => {
        onGenerated(data);
        toast.success("Yazı taslağı oluşturuldu. Kontrol edip kaydedin.");
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !gen.isPending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <SparklesIcon data-icon="inline-start" /> Yapay zekâ ile yaz
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yapay zekâ ile blog yazısı oluştur</DialogTitle>
          <DialogDescription>
            Claude; başlık, SEO meta, içerik, etiketler ve X/Instagram metinlerini birlikte üretir. Sitedeki güncel istasyon ve
            fiyat verileri bağlam olarak eklenebilir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-topic">Konu</Label>
            <Textarea
              id="ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ör. Kışın elektrikli araç menzili neden düşer, şarj planı nasıl yapılır?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-keywords">Hedef anahtar kelimeler (virgülle)</Label>
            <Input id="ai-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="kışın şarj, elektrikli araç menzil" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ton</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bilgilendirici">Bilgilendirici</SelectItem>
                  <SelectItem value="samimi">Samimi</SelectItem>
                  <SelectItem value="teknik">Teknik</SelectItem>
                  <SelectItem value="haber">Haber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Uzunluk</Label>
              <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kisa">Kısa (600–800 kelime)</SelectItem>
                  <SelectItem value="orta">Orta (1000–1400 kelime)</SelectItem>
                  <SelectItem value="uzun">Uzun (1800–2400 kelime)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-instructions">Ek talimatlar (isteğe bağlı)</Label>
            <Textarea id="ai-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ai-data" checked={useSiteData} onCheckedChange={(v) => setUseSiteData(Boolean(v))} />
            <Label htmlFor="ai-data" className="font-normal">
              Güncel istasyon ve fiyat verilerini bağlam olarak kullan
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={topic.trim().length < 5 || gen.isPending}
            onClick={() =>
              gen.mutate({
                topic,
                keywords: keywords
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
                tone,
                length,
                instructions: instructions || undefined,
                categoryId: categoryId ?? null,
                useSiteData,
              })
            }
          >
            {gen.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            {gen.isPending ? "Yazılıyor… (1-2 dk sürebilir)" : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
