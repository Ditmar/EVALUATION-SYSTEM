-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ASSISTANT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "subject_assistant_access" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_assistant_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_assistant_access_assistantId_idx" ON "subject_assistant_access"("assistantId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_assistant_access_subjectId_assistantId_key" ON "subject_assistant_access"("subjectId", "assistantId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assistant_access" ADD CONSTRAINT "subject_assistant_access_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assistant_access" ADD CONSTRAINT "subject_assistant_access_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
