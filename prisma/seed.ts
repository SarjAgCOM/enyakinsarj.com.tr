import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl } from "../src/lib/database-url";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

const CATEGORIES = [
  { slug: "sarj-rehberi", name: "Şarj Rehberi", description: "Elektrikli araç şarjı hakkında pratik rehberler." },
  { slug: "sarj-aglari", name: "Şarj Ağları", description: "Türkiye'deki şarj ağları, tarifeler ve karşılaştırmalar." },
  { slug: "elektrikli-araclar", name: "Elektrikli Araçlar", description: "Elektrikli araç incelemeleri ve haberleri." },
  { slug: "haberler", name: "Haberler", description: "Şarj altyapısı ve e-mobilite dünyasından haberler." },
];

async function main() {
  for (const c of CATEGORIES) {
    await db.category.upsert({ where: { slug: c.slug }, create: c, update: {} });
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const exists = await db.user.findUnique({ where: { email } });
    if (!exists) {
      await db.user.create({
        data: {
          email,
          name: process.env.ADMIN_NAME ?? "Yönetici",
          role: "ADMIN",
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      console.log(`✓ Yönetici oluşturuldu: ${email}`);
    } else {
      console.log(`• Yönetici zaten var: ${email}`);
    }
  } else {
    console.warn("! ADMIN_EMAIL / ADMIN_PASSWORD tanımlı değil, yönetici oluşturulmadı.");
  }
  console.log("✓ Kategoriler hazır");
  await migrateMediaUrls();
}

/**
 * Eski kayıtlardaki doğrudan bucket adreslerini (objectstorage…/n/…/b/…/o/…) site üzerinden sunulan
 * `/medya/…` adresine çevirir. Bucket özel olduğunda doğrudan adres 404 verir ve görseller kırık görünür.
 * Tekrar çalıştırmak zararsızdır; OCI_PUBLIC_BASE_URL (CDN) kullanılıyorsa dokunulmaz.
 */
async function migrateMediaUrls() {
  const { OCI_NAMESPACE: ns, OCI_BUCKET: bucket, OCI_PUBLIC_BASE_URL: cdn } = process.env;
  if (!ns || !bucket || cdn) return;
  const prefix = `https://objectstorage.${process.env.OCI_REGION || "eu-frankfurt-1"}.oraclecloud.com/n/${ns}/b/${bucket}/o/`;
  const media = await db.$executeRaw`
    UPDATE "Media" SET "url" = '/medya/' || substr("url", ${prefix.length + 1}) WHERE starts_with("url", ${prefix})`;
  const covers = await db.$executeRaw`
    UPDATE "Post" SET "coverImageUrl" = '/medya/' || substr("coverImageUrl", ${prefix.length + 1})
    WHERE starts_with("coverImageUrl", ${prefix})`;
  const bodies = await db.$executeRaw`
    UPDATE "Post" SET "content" = replace("content", ${prefix}, '/medya/') WHERE position(${prefix} in "content") > 0`;
  if (media + covers + bodies > 0) {
    console.log(`✓ Görsel adresleri güncellendi: ${media} medya, ${covers} kapak, ${bodies} yazı içeriği`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
