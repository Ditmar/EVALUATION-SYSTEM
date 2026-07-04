-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CODE');

-- CreateEnum
CREATE TYPE "OnMaxPenalties" AS ENUM ('AUTO_SUBMIT', 'WARN_ONLY', 'LOCK_EXAM');

-- CreateEnum
CREATE TYPE "DifferentIpPolicy" AS ENUM ('OFF', 'WARN_ONLY', 'BLOCK');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('TAB_HIDDEN', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'HEARTBEAT', 'RECONNECT', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "career" TEXT NOT NULL,
    "academicTerm" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "evaluationType" TEXT NOT NULL,
    "maxPenalties" INTEGER NOT NULL DEFAULT 3,
    "onMaxPenalties" "OnMaxPenalties" NOT NULL DEFAULT 'AUTO_SUBMIT',
    "trackFocusEvents" BOOLEAN NOT NULL DEFAULT true,
    "monitorExternalIps" BOOLEAN NOT NULL DEFAULT true,
    "differentIpPolicy" "DifferentIpPolicy" NOT NULL DEFAULT 'OFF',
    "allowAiCodeEvaluation" BOOLEAN NOT NULL DEFAULT true,
    "publicToken" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "statement" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT,
    "correctAnswers" JSONB,
    "language" TEXT,
    "expectedSolution" TEXT,
    "rubric" TEXT,
    "enableAiEvaluation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT true,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "observedIp" TEXT,
    "penaltyCount" INTEGER NOT NULL DEFAULT 0,
    "totalAutoScore" DOUBLE PRECISION,
    "totalManualScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "selectedOptions" JSONB,
    "codeAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "ActivityEventType" NOT NULL,
    "detail" TEXT,
    "isPenalty" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_evaluations" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "suggestedScore" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "exams_publicToken_key" ON "exams"("publicToken");

-- CreateIndex
CREATE INDEX "exams_createdById_idx" ON "exams"("createdById");

-- CreateIndex
CREATE INDEX "questions_examId_idx" ON "questions"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "questions_examId_externalId_key" ON "questions"("examId", "externalId");

-- CreateIndex
CREATE INDEX "exam_attempts_examId_status_idx" ON "exam_attempts"("examId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_examId_ci_key" ON "exam_attempts"("examId", "ci");

-- CreateIndex
CREATE INDEX "answers_attemptId_idx" ON "answers"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_attemptId_questionId_key" ON "answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "activity_events_attemptId_createdAt_idx" ON "activity_events"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_evaluations_answerId_idx" ON "ai_evaluations"("answerId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
