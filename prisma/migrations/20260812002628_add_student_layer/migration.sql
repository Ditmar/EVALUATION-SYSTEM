-- CreateEnum
CREATE TYPE "ExamAccessMode" AS ENUM ('OPEN', 'REGISTERED');

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN     "studentId" TEXT;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "accessMode" "ExamAccessMode" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "subjectId" TEXT;

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "correo" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_refresh_tokens" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subjects_createdById_idx" ON "subjects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_createdById_name_key" ON "subjects"("createdById", "name");

-- CreateIndex
CREATE UNIQUE INDEX "students_ci_key" ON "students"("ci");

-- CreateIndex
CREATE INDEX "enrollments_subjectId_idx" ON "enrollments"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_subjectId_key" ON "enrollments"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "student_refresh_tokens_studentId_idx" ON "student_refresh_tokens"("studentId");

-- CreateIndex
CREATE INDEX "student_refresh_tokens_familyId_idx" ON "student_refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "exam_attempts_studentId_idx" ON "exam_attempts"("studentId");

-- CreateIndex
CREATE INDEX "exams_subjectId_idx" ON "exams"("subjectId");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_refresh_tokens" ADD CONSTRAINT "student_refresh_tokens_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
