-- CreateEnum
CREATE TYPE "OperationLogResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "result" "OperationLogResult" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationLog_createdAt_idx" ON "OperationLog"("createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_result_createdAt_idx" ON "OperationLog"("result", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_module_createdAt_idx" ON "OperationLog"("module", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_actorType_createdAt_idx" ON "OperationLog"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_targetType_targetId_idx" ON "OperationLog"("targetType", "targetId");
