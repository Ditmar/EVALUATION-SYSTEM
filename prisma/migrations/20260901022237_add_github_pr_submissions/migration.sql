-- AlterTable
ALTER TABLE "laboratory_ai_evaluations" ADD COLUMN     "evidence" JSONB;

-- CreateTable
CREATE TABLE "laboratory_repositories" (
    "id" TEXT NOT NULL,
    "laboratoryId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "repositoryUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboratory_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_submission_attempts" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "sourceRepositoryUrl" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "headRepositoryOwner" TEXT NOT NULL,
    "headRepositoryName" TEXT NOT NULL,
    "headBranch" TEXT NOT NULL,
    "pullRequestUrl" TEXT NOT NULL,
    "pullRequestNumber" INTEGER NOT NULL,
    "pullRequestState" TEXT NOT NULL,
    "baseCommitSha" TEXT NOT NULL,
    "submittedCommitSha" TEXT NOT NULL,
    "filesChanged" INTEGER NOT NULL,
    "commitsCount" INTEGER NOT NULL,
    "additions" INTEGER NOT NULL,
    "deletions" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_submission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laboratory_repositories_laboratoryId_idx" ON "laboratory_repositories"("laboratoryId");

-- CreateIndex
CREATE UNIQUE INDEX "laboratory_repositories_laboratoryId_resourceId_key" ON "laboratory_repositories"("laboratoryId", "resourceId");

-- CreateIndex
CREATE INDEX "github_submission_attempts_submissionId_questionId_idx" ON "github_submission_attempts"("submissionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "github_submission_attempts_submissionId_questionId_attemptN_key" ON "github_submission_attempts"("submissionId", "questionId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "laboratory_repositories" ADD CONSTRAINT "laboratory_repositories_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_submission_attempts" ADD CONSTRAINT "github_submission_attempts_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "laboratory_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
