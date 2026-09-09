-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommentAuthorType" AS ENUM ('STUDENT', 'STAFF');

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "tags" TEXT[],
    "markdownSource" TEXT NOT NULL,
    "readingTimeMinutes" INTEGER NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_claps" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clapperId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_claps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_comments" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorType" "CommentAuthorType" NOT NULL,
    "studentId" TEXT,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_authorId_idx" ON "articles"("authorId");

-- CreateIndex
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "article_claps_articleId_idx" ON "article_claps"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "article_claps_articleId_clapperId_key" ON "article_claps"("articleId", "clapperId");

-- CreateIndex
CREATE INDEX "article_comments_articleId_createdAt_idx" ON "article_comments"("articleId", "createdAt");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_claps" ADD CONSTRAINT "article_claps_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
