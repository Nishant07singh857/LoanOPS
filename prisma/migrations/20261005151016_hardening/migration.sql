-- DropIndex
DROP INDEX "Disbursement_loanId_status_key";

-- Create a partial unique index allowing only ONE successful/completed disbursement per loan
CREATE UNIQUE INDEX "Disbursement_loanId_success_key" 
ON "Disbursement"("loanId") 
WHERE status = 'COMPLETED';
