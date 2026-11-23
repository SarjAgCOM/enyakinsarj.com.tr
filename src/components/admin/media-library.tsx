"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface UploadedMedia {
  id: string;
  url: string;
  alt: string | null;
  fileName: string;
}

export async function uploadFile(file: File, opts: { alt?: string; folder?: string } = {}): Promise<UploadedMedia> {
  const fd = new FormData();
  fd.set("file", file);
  if (opts.alt) fd.set("alt", opts.alt);
  fd.set("folder", opts.folder ?? "blog");
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const body = await res.json().catch(() => ({ error: "Yükleme başarısız" }));
  if (!res.ok) throw new Error(body.error ?? "Yükleme başarısız");
  return body as UploadedMedia;
}

export function UploadButton({ onUploaded, label = "Görsel yükle" }: { onUploaded: (m: UploadedMedia) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          for (const f of files) {
            try {
              onUploaded(await uploadFile(f));
              toast.success(`${f.name} yüklendi`);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }
          setBusy(false);
        }}
      />
      <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
        {label}
      </Button>
    </>
  );
}

export function MediaGrid({ onPick, selectable }: { onPick?: (m: UploadedMedia) => void; selectable?: boolean }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const list = useQuery(trpc.admin.media.list.queryOptions({ page, q: q || undefined }));
  const del = useMutation(
    trpc.admin.media.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Silindi");
        void qc.invalidateQueries({ queryKey: trpc.admin.media.list.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const refresh = () => void qc.invalidateQueries({ queryKey: trpc.admin.media.list.queryKey() });

  return (
    <div className="space-y-4">
      {list.data && !list.data.storageReady && (
        <Alert>
          <AlertDescription>
            Oracle Object Storage ayarlanmamış. <code>.env</code> dosyasında OCI_NAMESPACE, OCI_BUCKET, OCI_ACCESS_KEY_ID ve
            OCI_SECRET_ACCESS_KEY değerlerini tanımlayın.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Dosya adına göre ara" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <UploadButton
          onUploaded={(m) => {
            refresh();
            if (selectable) onPick?.(m);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {list.data?.items.map((m) => (
          <div key={m.id} className={cn("group relative overflow-hidden rounded-lg border bg-card", selectable && "cursor-pointer hover:ring-2 hover:ring-primary")}>
            <button
              type="button"
              className="block aspect-square w-full bg-muted"
              onClick={() => onPick?.(m)}
              disabled={!selectable}
              aria-label={selectable ? `${m.fileName} seç` : m.fileName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt ?? m.fileName} className="size-full object-cover" loading="lazy" />
            </button>
            <div className="flex items-center justify-between gap-1 p-2">
              <p className="truncate text-xs" title={m.fileName}>
                {m.fileName}
              </p>
              {!selectable && (
                <div className="flex shrink-0">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="URL kopyala"
                    onClick={() => void navigator.clipboard.writeText(m.url).then(() => toast.success("URL kopyalandı"))}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Sil"
                    onClick={() => confirm("Görsel bucket'tan silinsin mi?") && del.mutate({ id: m.id })}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {list.data && list.data.items.length === 0 && <p className="text-sm text-muted-foreground">Henüz görsel yok.</p>}
      {list.data && list.data.pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {list.data.pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= list.data.pages} onClick={() => setPage((p) => p + 1)}>
            Sonraki
          </Button>
        </div>
      )}
    </div>
  );
}

export function MediaPickerDialog({ onPick, trigger }: { onPick: (m: UploadedMedia) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Medya kütüphanesi</DialogTitle>
        </DialogHeader>
        <MediaGrid
          selectable
          onPick={(m) => {
            onPick(m);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
