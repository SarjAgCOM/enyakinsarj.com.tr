import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
