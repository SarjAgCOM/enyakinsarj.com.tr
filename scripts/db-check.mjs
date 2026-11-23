// Migration öncesi bağlantı kontrolü.
//
// 1) Veritabanına POSTGRES_* değerleriyle bağlanmayı dener.
// 2) Şifre kabul edilmezse (en sık neden: POSTGRES_PASSWORD, veritabanı ilk oluşturulduktan SONRA
//    değiştirildi; PostgreSQL şifreyi yalnızca volume ilk oluşturulurken okur) veritabanındaki şifreyi
//    ortam değişkenindeki değerle eşitler. Bunun için db konteyneriyle paylaşılan unix soketi kullanılır:
//    resmi postgres imajında yerel soket bağlantıları şifresizdir. Veri silinmez.
// 3) Hâlâ bağlanamıyorsa nedenini ve çözümünü açıkça yazar.
import { existsSync } from "node:fs";
import pg from "pg";

const host = process.env.POSTGRES_HOST?.trim();
const port = Number(process.env.POSTGRES_PORT || 5432);
const user = process.env.POSTGRES_USER?.trim() || "enyakinsarj";
const password = process.env.POSTGRES_PASSWORD ?? "";
const database = process.env.POSTGRES_DB?.trim() || "enyakinsarj";
const socketDir = process.env.POSTGRES_SOCKET_DIR?.trim() || "/var/run/postgresql";

const config = host ? { host, port, user, password, database } : { connectionString: process.env.DATABASE_URL };
const where = host ? `${user}@${host}:${port}/${database}` : "DATABASE_URL";

// Beklemekle düzelmeyen hatalar: yanlış şifre, olmayan rol, olmayan veritabanı
const FATAL = new Set(["28P01", "28000", "3D000"]);

if (host && !password) {
  console.error("✗ POSTGRES_PASSWORD tanımlı değil. Ortam değişkenlerine ekleyin.");
  process.exit(1);
}
if (!host && !process.env.DATABASE_URL) {
  console.error("✗ Ne POSTGRES_HOST ne de DATABASE_URL tanımlı.");
  process.exit(1);
}

async function connectOnce(cfg) {
  const client = new pg.Client({ ...cfg, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("select 1");
  } finally {
    await client.end().catch(() => {});
  }
}

/** Geçici hatalarda (db henüz hazır değil) birkaç kez dener; kalıcı hatada hemen döner. */
async function connectWithRetry(cfg, attempts = 10) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      await connectOnce(cfg);
      return null;
    } catch (e) {
      lastError = e;
      if (FATAL.has(e.code)) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return lastError;
}

/** db konteynerinin yerel soketi üzerinden (şifresiz) kullanıcı şifresini ortam değişkenine eşitler. */
async function syncPasswordViaSocket() {
  if (!existsSync(`${socketDir}/.s.PGSQL.${port}`)) {
    return { ok: false, reason: `yerel soket bulunamadı (${socketDir})` };
  }
  const client = new pg.Client({ host: socketDir, port, user, database, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    // ALTER USER parametre kabul etmez; kimlik ve değer sürücünün kaçışlama işlevleriyle güvenle gömülür.
    await client.query(`ALTER USER ${client.escapeIdentifier(user)} WITH PASSWORD ${client.escapeLiteral(password)}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    await client.end().catch(() => {});
  }
}

let error = await connectWithRetry(config);

if (error?.code === "28P01" && host) {
  console.warn("! Veritabanı POSTGRES_PASSWORD değerini kabul etmedi (şifre, veritabanı oluşturulduktan sonra değişmiş).");
  console.warn("  Veritabanındaki şifre ortam değişkenindeki değerle eşitleniyor…");
  const sync = await syncPasswordViaSocket();
  if (sync.ok) {
    console.log("✓ Veritabanı şifresi güncellendi.");
    error = await connectWithRetry(config, 3);
  } else {
    console.error(`✗ Şifre eşitlenemedi: ${sync.reason}`);
  }
}

if (!error) {
  console.log(`✓ Veritabanına bağlanıldı (${where})`);
  process.exit(0);
}

console.error(`✗ Veritabanına bağlanılamadı (${where}): ${error.message ?? error}`);
if (error.code === "28P01") {
  console.error(
    [
      "",
      "  Şifre kabul edilmedi ve otomatik eşitleme yapılamadı.",
      "  Elle çözüm (veri kaybı olmadan): db konteynerinin terminalinde",
      `    psql -U ${user} -d ${database} -c "ALTER USER \\"${user}\\" WITH PASSWORD 'YENI_SIFRENIZ'"`,
      "  komutunu çalıştırın ve YENI_SIFRENIZ yerine POSTGRES_PASSWORD değerini yazın.",
      "",
    ].join("\n"),
  );
} else if (error.code === "28000") {
  console.error(
    `\n  "${user}" rolü veritabanında yok. POSTGRES_USER, veritabanı ilk oluşturulurken kullanılan değerle aynı olmalı.\n`,
  );
} else if (error.code === "3D000") {
  console.error(
    `\n  "${database}" veritabanı yok. POSTGRES_DB, veritabanı ilk oluşturulurken kullanılan değerle aynı olmalı.\n`,
  );
}
process.exit(1);
