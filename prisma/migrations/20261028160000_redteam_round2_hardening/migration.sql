-- Red-team round 2 hardening:
-- 1. User.totpLastStep — last accepted TOTP time-step, for replay protection.
-- 2. Unique (organizationId, mobile) on Candidate — one record per mobile
--    per organization; closes the duplicate-mobile apply race. Mobiles are
--    stored only in canonical 10-digit form (src/lib/mobile.ts).
--    NOTE for existing databases: if duplicate (organizationId, mobile)
--    rows were ever created, they must be merged before this migration
--    can apply — the unique index creation will fail loudly otherwise.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpLastStep" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_organizationId_mobile_key" ON "Candidate"("organizationId", "mobile");
