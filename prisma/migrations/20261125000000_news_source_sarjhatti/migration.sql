-- Şarj Hattı forumunu haber kaynağı olarak ekler.
-- Varsayılan kaynaklar yalnızca tablo boşken eklendiği için mevcut kurulumlarda bu satır ayrıca gerekir.
-- Tablo boşsa dokunulmaz: o durumda tüm varsayılanlar (bu kaynak dahil) uygulama tarafından eklenir.
INSERT INTO "NewsSource" ("id", "name", "feedUrl", "enabled")
SELECT 'src_sarjhatti', 'Şarj Hattı', 'https://sarjhatti.com/forums/-/index.rss', true
WHERE EXISTS (SELECT 1 FROM "NewsSource")
ON CONFLICT ("feedUrl") DO NOTHING;
