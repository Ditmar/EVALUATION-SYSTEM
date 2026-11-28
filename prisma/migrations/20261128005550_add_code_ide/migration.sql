-- CreateEnum
CREATE TYPE "CodeRunContext" AS ENUM ('EXAM', 'LAB', 'ADMIN');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'CODE_IDE';

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "codeFiles" JSONB;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "ideConfig" JSONB;

-- CreateTable
CREATE TABLE "code_runs" (
    "id" TEXT NOT NULL,
    "context" "CodeRunContext" NOT NULL,
    "attemptId" TEXT,
    "submissionId" TEXT,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "filesHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "exitCode" INTEGER,
    "stdout" TEXT NOT NULL,
    "stderr" TEXT NOT NULL,
    "compileOut" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_runs_attemptId_questionId_idx" ON "code_runs"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "code_runs_submissionId_questionId_idx" ON "code_runs"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "code_runs" ADD CONSTRAINT "code_runs_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_runs" ADD CONSTRAINT "code_runs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "laboratory_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
