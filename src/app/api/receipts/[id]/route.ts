// GET /api/receipts/[id] — fetch printable receipt details by payment ID or receiptNumber
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server/auth'
import { apiHandler, success, notFound, forbidden } from '@/lib/server/api'

export const GET = apiHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireAuth()
    const { id } = await params

    const payment = await db.payment.findFirst({
      where: {
        organizationId: ctx.user.organizationId,
        OR: [{ id }, { receiptNumber: id }, { paymentNumber: id }],
      },
      include: {
        loan: true,
        candidate: true,
        recordedBy: { select: { id: true, name: true, email: true, phone: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true, logoUrl: true } },
      },
    })

    if (!payment) return notFound('Receipt not found')

    // Enforce RBAC
    if (ctx.user.role === 'CANDIDATE') {
      if (!ctx.user.candidateId || payment.candidateId !== ctx.user.candidateId) {
        return forbidden('You do not have permission to view this receipt')
      }
    } else if (ctx.user.role === 'AGENT') {
      if (payment.recordedById !== ctx.user.id) {
        const agentProfile = await db.agentProfile.findUnique({
          where: { userId: ctx.user.id },
        })
        if (!agentProfile || payment.candidate.assignedAgentId !== agentProfile.id) {
          return forbidden('You do not have permission to view this receipt')
        }
      }
    }

    const totalOutstanding =
      payment.loan.outstandingPrincipal +
      payment.loan.outstandingInterest +
      payment.loan.outstandingFees

    return success({
      id: payment.id,
      receiptNumber: payment.receiptNumber ?? payment.paymentNumber,
      paymentNumber: payment.paymentNumber,
      status: payment.status,
      verificationStatus:
        payment.status === 'VERIFIED' || payment.verifiedAt
          ? 'VERIFIED'
          : payment.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING_VERIFICATION',
      method: payment.method,
      amount: String(payment.amount),
      allocatedFees: String(payment.allocatedFees),
      allocatedInterest: String(payment.allocatedInterest),
      allocatedPrincipal: String(payment.allocatedPrincipal),
      unallocated: String(payment.unallocated),
      reference: payment.reference,
      notes: payment.notes,
      proofUrl: payment.proofUrl,
      rejectionReason: payment.rejectionReason,
      createdAt: payment.createdAt,
      allocatedAt: payment.allocatedAt ?? payment.createdAt,
      verifiedAt: payment.verifiedAt,
      recordedBy: payment.recordedBy
        ? {
            id: payment.recordedBy.id,
            name: payment.recordedBy.name,
            email: payment.recordedBy.email,
            phone: payment.recordedBy.phone,
          }
        : null,
      recordedByName: payment.recordedBy?.name ?? 'Field Agent',
      verifiedBy: payment.verifiedBy
        ? {
            id: payment.verifiedBy.id,
            name: payment.verifiedBy.name,
            email: payment.verifiedBy.email,
          }
        : null,
      verifiedByName: payment.verifiedBy?.name ?? null,
      organization: payment.organization,
      candidate: {
        id: payment.candidate.id,
        fullName: payment.candidate.fullName,
        mobile: payment.candidate.mobile,
        email: payment.candidate.email,
        address: payment.candidate.address,
      },
      loan: {
        id: payment.loan.id,
        loanNumber: payment.loan.loanNumber,
        principalAmount: String(payment.loan.principalAmount),
        totalRepayable: String(payment.loan.totalRepayable),
        outstandingPrincipal: String(payment.loan.outstandingPrincipal),
        outstandingInterest: String(payment.loan.outstandingInterest),
        outstandingFees: String(payment.loan.outstandingFees),
        totalOutstanding: String(totalOutstanding),
        totalCollected: String(payment.loan.totalCollected),
        status: payment.loan.status,
      },
    })
  }
)
