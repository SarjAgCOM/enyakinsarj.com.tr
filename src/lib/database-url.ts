/**
 * PostgreSQL bağlantı adresi.
 *
 * Docker / Coolify ortamında adres POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD ve POSTGRES_DB
 * parçalarından kurulur ve her parça URL kaçışlanır. Böylece şifrede `/ @ # ? : +` gibi karakterler
 * bulunsa bile adres bozulmaz. POSTGRES_HOST tanımlı değilse (yerel geliştirme) DATABASE_URL kullanılır.
 *
 * Bu dosya Next.js dışında da (prisma.config.ts, prisma/seed.ts) içe aktarıldığı için bağımlılığı yoktur.
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  const host = env.POSTGRES_HOST?.trim();
  if (host) {
    const user = encodeURIComponent(env.POSTGRES_USER?.trim() || "enyakinsarj");
    const password = encodeURIComponent(env.POSTGRES_PASSWORD ?? "");
    const database = encodeURIComponent(env.POSTGRES_DB?.trim() || "enyakinsarj");
    const port = env.POSTGRES_PORT?.trim() || "5432";
    return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
  }
  return env.DATABASE_URL ?? "";
}
