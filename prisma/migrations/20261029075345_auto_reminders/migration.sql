-- CreateEnum
CREATE TYPE "ReminderStage" AS ENUM ('DUE_SOON_3', 'DUE_SOON_1', 'DUE_TODAY', 'OVERDUE_1', 'OVERDUE_3', 'OVERDUE_7', 'OVERDUE_15', 'OVERDUE_30', 'RECEIPT');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('PORTAL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SENT', 'QUEUED', 'SKIPPED_PTP', 'FAILED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentId" TEXT,
    "paymentId" TEXT,
    "stage" "ReminderStage" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderLog_organizationId_createdAt_idx" ON "ReminderLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderLog_organizationId_status_idx" ON "ReminderLog"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ReminderLog_candidateId_idx" ON "ReminderLog"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_installmentId_stage_channel_key" ON "ReminderLog"("installmentId", "stage", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_paymentId_stage_channel_key" ON "ReminderLog"("paymentId", "stage", "channel");

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
