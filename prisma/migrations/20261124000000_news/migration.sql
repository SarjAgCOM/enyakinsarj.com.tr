-- CreateEnum
CREATE TYPE "NewsItemStatus" AS ENUM ('NEW', 'GENERATED', 'SKIPPED', 'FAILED');
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceUrl" TEXT;
-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "NewsItemStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "NewsSource_feedUrl_key" ON "NewsSource"("feedUrl");
-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_postId_key" ON "NewsItem"("postId");
-- CreateIndex
CREATE INDEX "NewsItem_status_publishedAt_idx" ON "NewsItem"("status", "publishedAt");
-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_sourceId_guid_key" ON "NewsItem"("sourceId", "guid");
-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
