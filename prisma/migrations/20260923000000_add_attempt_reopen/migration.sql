-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN     "penaltyBaseline" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reopenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reopenedAt" TIMESTAMP(3);
