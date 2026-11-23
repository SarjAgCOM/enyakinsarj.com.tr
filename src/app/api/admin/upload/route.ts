import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, isStorageConfigured, uploadObject } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Yönetim paneli görsel yükleme → Oracle Object Storage. multipart/form-data: file, alt?, folder? */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Oracle bucket ayarları (.env) eksik." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Desteklenmeyen dosya türü (${file.type || "bilinmiyor"}).` }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Dosya 10 MB'tan büyük olamaz." }, { status: 413 });

  const folder = String(form?.get("folder") ?? "blog").replace(/[^a-z0-9-]/gi, "") || "blog";
  const alt = String(form?.get("alt") ?? "").slice(0, 300) || null;

  try {
    const { key, url } = await uploadObject(
      { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
      folder,
    );
    const media = await db.media.create({
      data: { key, url, fileName: file.name, mimeType: file.type, size: file.size, alt, uploadedById: user.id },
    });
    return NextResponse.json(media);
  } catch (e) {
    console.error("upload failed", e);
    return NextResponse.json({ error: `Yükleme başarısız: ${(e as Error).message}` }, { status: 500 });
  }
}
