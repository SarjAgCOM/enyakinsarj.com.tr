// Migration öncesi bağlantı kontrolü: hata olursa nedenini ve çözümünü açıkça yazar.
// (Deploy logları yalnızca "exit 1" gösterdiği için asıl mesaj bu konteynerin logunda görünür.)
import pg from "pg";

const host = process.env.POSTGRES_HOST?.trim();
const config = host
  ? {
      host,
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER?.trim() || "enyakinsarj",
      password: process.env.POSTGRES_PASSWORD ?? "",
      database: process.env.POSTGRES_DB?.trim() || "enyakinsarj",
    }
  : { connectionString: process.env.DATABASE_URL };

const where = host ? `${config.user}@${config.host}:${config.port}/${config.database}` : "DATABASE_URL";

if (host && !config.password) {
  console.error("✗ POSTGRES_PASSWORD tanımlı değil. Ortam değişkenlerine ekleyin.");
  process.exit(1);
}
if (!host && !process.env.DATABASE_URL) {
  console.error("✗ Ne POSTGRES_HOST ne de DATABASE_URL tanımlı.");
  process.exit(1);
}

let lastError;
for (let attempt = 1; attempt <= 10; attempt++) {
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    console.log(`✓ Veritabanına bağlanıldı (${where})`);
    process.exit(0);
  } catch (e) {
    lastError = e;
    await client.end().catch(() => {});
    // Şifre veya veritabanı adı hatası beklemekle düzelmez.
    if (e.code === "28P01" || e.code === "3D000" || e.code === "28000") break;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

console.error(`✗ Veritabanına bağlanılamadı (${where}): ${lastError?.message ?? lastError}`);
if (lastError?.code === "28P01") {
  console.error(
    [
      "",
      "  Şifre kabul edilmedi. En sık nedeni: POSTGRES_PASSWORD, veritabanı ilk kez oluşturulduktan SONRA değiştirildi.",
      "  PostgreSQL şifreyi yalnızca volume ilk oluşturulurken okur; sonradan değişen değeri dikkate almaz.",
      "",
      "  Çözüm (veri kaybı olmadan): db konteynerinin terminalinde şunu çalıştırın:",
      `    psql -U ${config.user} -d ${config.database} -c "ALTER USER \\"${config.user}\\" WITH PASSWORD 'YENI_SIFRENIZ'"`,
      "  ve YENI_SIFRENIZ yerine POSTGRES_PASSWORD değerini yazın. Ya da POSTGRES_PASSWORD'u ilk değerine geri alın.",
      "",
    ].join("\n"),
  );
} else if (lastError?.code === "3D000") {
  console.error("\n  Veritabanı bulunamadı. POSTGRES_DB değeri, volume ilk oluşturulurken kullanılan adla aynı olmalı.\n");
}
process.exit(1);
