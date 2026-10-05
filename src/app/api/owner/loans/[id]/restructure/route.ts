import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'

const restructureSchema = z.object({}).strict()

import { calculateInstallmentsFromTenure, generateSchedulePreview, type ScheduleInput } from '@/lib/financial-engine'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = validate(restructureSchema, body)
  
  const loan = await db.loan.findUnique({
    where: { id, organizationId: ctx.user.organizationId },
    include: { schedule: { orderBy: { installmentNumber: 'asc' } } }
  })

  if (!loan) return notFound('Loan not found')
  if (loan.status !== 'ACTIVE' && loan.status !== 'DEFAULTED') {
    return badRequest('Only active or defaulted loans can be restructured')
  }
  
  const frequency = parsed.newFrequency || loan.frequency
  if (frequency !== 'DAILY' && frequency !== 'WEEKLY' && frequency !== 'MONTHLY') {
    return badRequest('Invalid frequency')
  }

  const interestType = loan.interestType
  if (interestType !== 'PERCENTAGE' && interestType !== 'FIXED' && interestType !== 'NONE') {
    return badRequest('Invalid interest type')
  }
  
  const unpaidInstallments = loan.schedule.filter(i => 
    i.status !== 'PAID' && i.status !== 'PARTIALLY_PAID'
  )
  
  if (unpaidInstallments.length === 0) return badRequest('No unpaid installments left to restructure')
  
  const installmentsCount = calculateInstallmentsFromTenure(parsed.tenureMonths, frequency)

  // Use financial-engine to generate a new schedule for the remaining principal
  const firstDueDate = new Date(unpaidInstallments[0].dueDate)

  const safeBigInt = (val: any) => val ? BigInt(String(val)) : BigInt(0)

  const scheduleInput: ScheduleInput = {
    principalPaise: safeBigInt(loan.outstandingPrincipal),
    interestType,
    interestRateBps: safeBigInt(loan.interestRate),
    fixedInterestPaise: safeBigInt(loan.fixedInterest), // Note: might need prorating if fixed interest was for full loan
    frequency,
    installments: installmentsCount,
    firstDueDate: firstDueDate,
    processingFeePaise: BigInt(0), // Ignore fees for restructure or prorate
    otherFeesPaise: BigInt(0),
  }

  const preview = generateSchedulePreview(scheduleInput)

  if (!preview || preview.installments.length === 0) {
    return badRequest('Failed to generate restructure schedule')
  }

  const newScheduleData = preview.installments.map(i => ({
    loanId: loan.id,
    installmentNumber: unpaidInstallments[0].installmentNumber + i.number - 1,
    dueDate: i.dueDate,
    openingPrincipal: Number(i.openingPrincipal),
    principalComponent: Number(i.principal),
    interestComponent: Number(i.interest),
    feesComponent: Number(i.fees),
    totalDue: Number(i.totalDue),
    closingPrincipal: Number(i.closingPrincipal),
    status: 'UPCOMING' as const,
  }))

  const newInstallmentAmount = Number(preview.installmentAmount)

  await db.$transaction(async (tx) => {
    await tx.installment.deleteMany({
      where: {
        loanId: loan.id,
        installmentNumber: { gte: unpaidInstallments[0].installmentNumber }
      }
    })
    
    for (const data of newScheduleData) {
      await tx.installment.create({
        data
      })
    }
    
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        installmentAmount: newInstallmentAmount,
        frequency: frequency,
        installments: (loan.schedule.length - unpaidInstallments.length) + newScheduleData.length,
        finalDueDate: newScheduleData[newScheduleData.length - 1].dueDate,
      }
    })
  })

  await audit(ctx, 'RESTRUCTURE', 'Loan', loan.id, 'Restructured loan to new tenure ' + parsed.tenureMonths + ' months (' + frequency + ')')

  return success({ message: 'Loan successfully restructured' })
})
