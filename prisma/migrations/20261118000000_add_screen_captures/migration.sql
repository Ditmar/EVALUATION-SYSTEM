-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'SCREEN_SHARE_STARTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'SCREEN_SHARE_STOPPED';

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "requireScreenCapture" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "screen_captures" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "screen_captures_attemptId_createdAt_idx" ON "screen_captures"("attemptId", "createdAt");

-- AddForeignKey
ALTER TABLE "screen_captures" ADD CONSTRAINT "screen_captures_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
