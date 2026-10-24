-- Industry hardening (2026-10-24)
-- Matches prisma/schema.prisma changes in the same change set.
--
-- NOTE: Candidate (organizationId, mobile) uniqueness is intentionally NOT
-- added here. Legacy data may contain duplicate (organizationId, mobile)
-- rows, so a database-level unique constraint could fail on existing
-- deployments and would break legitimate historical records. Borrower
-- identity / candidate claiming is enforced in the application layer
-- (claim-code flow using Candidate.claimCodeHash / claimCodeExpiresAt).

-- Candidate: claim-code borrower linking
ALTER TABLE "Candidate" ADD COLUMN "claimCodeHash" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "claimCodeExpiresAt" TIMESTAMP(3);

-- WebhookEvent: enforce provider event idempotency at the database level.
-- PostgreSQL unique indexes treat NULL eventId values as distinct, which
-- matches Prisma @@unique semantics for the nullable eventId column.
DROP INDEX "WebhookEvent_provider_eventId_idx";
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- Refund: link a refund to the payment it reverses + status lookup index
ALTER TABLE "Refund" ADD COLUMN "paymentId" TEXT;
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- FinancialCorrection: record the correction amount (paise)
ALTER TABLE "FinancialCorrection" ADD COLUMN "amount" INTEGER;

-- LedgerEntry: joinable loan / payment references
ALTER TABLE "LedgerEntry" ADD COLUMN "loanId" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "paymentId" TEXT;
CREATE INDEX "LedgerEntry_reference_idx" ON "LedgerEntry"("reference");
CREATE INDEX "LedgerEntry_loanId_idx" ON "LedgerEntry"("loanId");

-- Payment: hot-path composite indexes
CREATE INDEX "Payment_loanId_status_idx" ON "Payment"("loanId", "status");
CREATE INDEX "Payment_organizationId_createdAt_idx" ON "Payment"("organizationId", "createdAt");

-- Installment: hot-path composite indexes (per-loan status, overdue scans)
CREATE INDEX "Installment_loanId_status_idx" ON "Installment"("loanId", "status");
CREATE INDEX "Installment_status_dueDate_idx" ON "Installment"("status", "dueDate");

-- ReconciliationRun: run numbers must be unique
CREATE UNIQUE INDEX "ReconciliationRun_runNumber_key" ON "ReconciliationRun"("runNumber");

-- CHECK constraints: monetary amounts must never be negative.
-- Column names below are the real column names from prisma/schema.prisma.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_principalAmount_non_negative" CHECK ("principalAmount" >= 0);
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_totalDue_non_negative" CHECK ("totalDue" >= 0);
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_principalComponent_non_negative" CHECK ("principalComponent" >= 0);
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_interestComponent_non_negative" CHECK ("interestComponent" >= 0);
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_feesComponent_non_negative" CHECK ("feesComponent" >= 0);
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amount_non_negative" CHECK ("amount" >= 0);
