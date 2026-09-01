-- CreateEnum
CREATE TYPE "LaboratoryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LaboratorySubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- CreateTable
CREATE TABLE "laboratories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "markdownSource" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER,
    "status" "LaboratoryStatus" NOT NULL DEFAULT 'DRAFT',
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratory_submissions" (
    "id" TEXT NOT NULL,
    "laboratoryId" TEXT NOT NULL,
    "laboratoryVersion" INTEGER NOT NULL,
    "markdownSnapshot" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "LaboratorySubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "grading" JSONB NOT NULL DEFAULT '{}',
    "totalScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboratory_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratory_ai_evaluations" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "suggestedScore" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laboratory_ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laboratories_createdById_idx" ON "laboratories"("createdById");

-- CreateIndex
CREATE INDEX "laboratories_subjectId_idx" ON "laboratories"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_createdById_slug_key" ON "laboratories"("createdById", "slug");

-- CreateIndex
CREATE INDEX "laboratory_submissions_laboratoryId_status_idx" ON "laboratory_submissions"("laboratoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "laboratory_submissions_laboratoryId_studentId_key" ON "laboratory_submissions"("laboratoryId", "studentId");

-- CreateIndex
CREATE INDEX "laboratory_ai_evaluations_submissionId_idx" ON "laboratory_ai_evaluations"("submissionId");

-- AddForeignKey
ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratory_submissions" ADD CONSTRAINT "laboratory_submissions_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratory_submissions" ADD CONSTRAINT "laboratory_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratory_ai_evaluations" ADD CONSTRAINT "laboratory_ai_evaluations_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "laboratory_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
