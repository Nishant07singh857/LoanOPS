// Idempotent seed script — creates demo organization, users (with hashed passwords),
// sample candidates, applications, loans, schedules, agreements, and notifications.
// All money in paise. Run with: bun run scripts/seed.ts
//
// Seed account passwords come ONLY from the environment — there are no
// hardcoded defaults. The operator must set:
//   SEED_OWNER_PASSWORD, SEED_AGENT_PASSWORD, SEED_AGENT2_PASSWORD,
//   SEED_CANDIDATE_PASSWORD
// Accounts created: owner@loanops.in (OWNER), agent@loanops.in and
// agent2@loanops.in (AGENT), and Priya Sharma (CANDIDATE, mobile login).

import { PrismaClient, UserRole, InterestType, RepaymentFrequency, ApplicationStatus, LoanStatus, InstallmentStatus, PaymentMethod, PaymentStatus, PtpStatus, EscalationReason, EscalationStatus, TaskStatus, TaskPriority, AuditAction, NotificationType, DocumentType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { encryptPII } from '../src/lib/server/crypto'
import { generateSchedule } from '../src/lib/server/financial'
import { maskAadhaar, maskPan } from '../src/lib/utils'

// --- Safety: seed only against DATABASE_URL_TEST, never the main DB ---
const testUrl = process.env.DATABASE_URL_TEST
if (!testUrl) {
  console.error('❌ DATABASE_URL_TEST is not set. Seed refuses to run without a dedicated test database.')
  process.exit(1)
}
if (process.env.DATABASE_URL) {
  try {
    const mainUrl = new URL(process.env.DATABASE_URL)
    const testUrlParsed = new URL(testUrl)
    if (mainUrl.host === testUrlParsed.host && mainUrl.pathname === testUrlParsed.pathname && mainUrl.username === testUrlParsed.username) {
      console.error('❌ DATABASE_URL_TEST must point to a different database or host or project-ref than DATABASE_URL.')
      process.exit(1)
    }
  } catch (e: any) {
    console.error('❌ Invalid Database URLs provided: ' + e.message)
    process.exit(1)
  }
}

const db = new PrismaClient({ datasourceUrl: testUrl })

function requireSeedPassword(envName: string): string {
  const value = process.env[envName]
  if (!value) {
    throw new Error(
      `${envName} is not set. Seed refuses to create accounts with a default or hardcoded password — ` +
        `set ${envName} (and SEED_OWNER_PASSWORD, SEED_AGENT_PASSWORD, SEED_AGENT2_PASSWORD, SEED_CANDIDATE_PASSWORD) in the environment before running the seed.`
    )
  }
  return value
}

const SEED_PASSWORDS = {
  owner: requireSeedPassword('SEED_OWNER_PASSWORD'),
  agent: requireSeedPassword('SEED_AGENT_PASSWORD'),
  agent2: requireSeedPassword('SEED_AGENT2_PASSWORD'),
  candidate: requireSeedPassword('SEED_CANDIDATE_PASSWORD'),
}

async function hash(p: string) {
  return bcrypt.hash(p, 12)
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.error('❌ Refusing to run seed in production without ALLOW_PROD_SEED=true')
    process.exit(1)
  }

  console.log('🌱 Seeding database...')

  // --- Organization ---
  const org = await db.organization.upsert({
    where: { id: 'demo-org-001' },
    update: { name: 'Sterling Lending', isActive: true },
    create: {
      id: 'demo-org-001',
      name: 'Sterling Lending',
      isActive: true,
    },
  })
  console.log(`  ✓ Organization: ${org.name}`)

  // --- Users (Owner + 2 Agents) ---
  const ownerHash = await hash(SEED_PASSWORDS.owner)
  const owner = await db.user.upsert({
    where: { email: 'owner@loanops.in' },
    update: {},
    create: {
      id: 'user-owner-001',
      organizationId: org.id,
      email: 'owner@loanops.in',
      passwordHash: ownerHash,
      name: 'Ravi Mehta',
      phone: '+91 98200 11223',
      role: UserRole.OWNER,
    },
  })

  const agentHash = await hash(SEED_PASSWORDS.agent)
  const agentUser = await db.user.upsert({
    where: { email: 'agent@loanops.in' },
    update: {},
    create: {
      id: 'user-agent-001',
      organizationId: org.id,
      email: 'agent@loanops.in',
      passwordHash: agentHash,
      name: 'Arjun Nair',
      phone: '+91 98201 44556',
      role: UserRole.AGENT,
    },
  })

  const agent2Hash = await hash(SEED_PASSWORDS.agent2)
  const agent2User = await db.user.upsert({
    where: { email: 'agent2@loanops.in' },
    update: {},
    create: {
      id: 'user-agent-002',
      organizationId: org.id,
      email: 'agent2@loanops.in',
      passwordHash: agent2Hash,
      name: 'Sneha Kapoor',
      phone: '+91 98201 44557',
      role: UserRole.AGENT,
    },
  })

  // Agent profiles
  const agent1 = await db.agentProfile.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      id: 'agent-profile-001',
      userId: agentUser.id,
      organizationId: org.id,
      employeeCode: 'AG-001',
      zone: 'Mumbai South',
    },
  })

  const agent2 = await db.agentProfile.upsert({
    where: { userId: agent2User.id },
    update: {},
    create: {
      id: 'agent-profile-002',
      userId: agent2User.id,
      organizationId: org.id,
      employeeCode: 'AG-002',
      zone: 'Mumbai West',
    },
  })
  console.log(`  ✓ Users: owner, agent (Arjun), agent2 (Sneha)`)

  // --- Agreement template ---
  const agreement = await db.agreementTemplate.upsert({
    where: { organizationId_version: { organizationId: org.id, version: '3.1' } },
    update: {},
    create: {
      id: 'agreement-001',
      organizationId: org.id,
      name: 'Standard Personal Loan Agreement',
      version: '3.1',
      effectiveDate: new Date('2024-09-01'),
      isActive: true,
      body: `# Loan Agreement v3.1

This Loan Agreement ("Agreement") is entered into between **Sterling Lending** ("Lender") and the Borrower identified in the application record.

## 1. Loan Terms
The Lender agrees to disburse the principal amount stated in the application to the Borrower, repayable in equal installments as per the agreed schedule.

## 2. Interest
Interest shall accrue at the rate stated in the application, calculated on the reducing principal balance (or as otherwise configured), and shall be payable along with each installment.

## 3. Repayment Schedule
The Borrower agrees to repay the loan in the number of installments specified, on the due dates set out in the repayment schedule generated upon approval.

## 4. Late Payment
Late payments may attract additional charges and impact the Borrower's credit standing with the Lender.

## 5. Default
In case of default, the Lender reserves the right to initiate collection proceedings including but not limited to reminders, follow-ups, escalations, and legal action where applicable.

## 6. Governing Law
This Agreement is governed by the laws of the Republic of India.

By accepting this Agreement, the Borrower confirms that all information provided is true and accurate to the best of their knowledge.`,
    },
  })

  // --- Candidates (3 sample candidates) ---
  const candidateHash = await hash(SEED_PASSWORDS.candidate)
  const candidateUser = await db.user.upsert({
    where: { email: 'candidate@loanops.in' },
    update: {},
    create: {
      id: 'user-candidate-001',
      organizationId: org.id,
      email: 'candidate@loanops.in',
      passwordHash: candidateHash,
      name: 'Priya Sharma',
      phone: '+91 98202 77889',
      role: UserRole.CANDIDATE,
    },
  })

  const candidate1 = await db.candidate.upsert({
    where: { id: 'candidate-001' },
    update: {
      bankAccount: encryptPII('50100123456789'),
      aadhaarMasked: maskAadhaar('234567897892'),
      panMasked: maskPan('ABCDP1234E'),
    },
    create: {
      id: 'candidate-001',
      organizationId: org.id,
      userId: candidateUser.id,
      fullName: 'Priya Sharma',
      mobile: '9820277789',
      email: 'candidate@loanops.in',
      dob: new Date('1992-03-15'),
      address: 'B-12 Hill View Apartments, Andheri West, Mumbai 400058',
      occupation: 'Salaried',
      employer: 'Infosys Ltd',
      monthlyIncome: 7500000, // ₹75,000 in paise
      existingObligations: 500000, // ₹5,000 in paise
      bankName: 'HDFC Bank',
      bankAccount: encryptPII('50100123456789'),
      bankIfsc: 'HDFC0001234',
      upiId: 'priya@hdfcbank',
      aadhaarMasked: maskAadhaar('234567897892'),
      panMasked: maskPan('ABCDP1234E'),
      assignedAgentId: agent1.id,
      status: 'ACTIVE',
    },
  })

  const candidate2 = await db.candidate.upsert({
    where: { id: 'candidate-002' },
    update: {
      bankAccount: encryptPII('ICICI002345678'),
      aadhaarMasked: maskAadhaar('345678904521'),
      panMasked: maskPan('BPMPR5678F'),
    },
    create: {
      id: 'candidate-002',
      organizationId: org.id,
      fullName: 'Rahul Verma',
      mobile: '9820322119',
      email: 'rahul.verma@example.com',
      dob: new Date('1988-07-22'),
      address: 'Flat 4, Raj Apartment, Bandra East, Mumbai 400051',
      occupation: 'Salaried',
      employer: 'TCS',
      monthlyIncome: 6800000,
      bankName: 'ICICI Bank',
      bankAccount: encryptPII('ICICI002345678'),
      bankIfsc: 'ICIC0000234',
      upiId: 'rahul@icici',
      aadhaarMasked: maskAadhaar('345678904521'),
      panMasked: maskPan('BPMPR5678F'),
      assignedAgentId: agent1.id,
      status: 'ACTIVE',
    },
  })

  const candidate3 = await db.candidate.upsert({
    where: { id: 'candidate-003' },
    update: {
      bankAccount: encryptPII('AXIS99001234'),
      aadhaarMasked: maskAadhaar('456789011122'),
      panMasked: maskPan('CPIIK9012G'),
    },
    create: {
      id: 'candidate-003',
      organizationId: org.id,
      fullName: 'Karthik Iyer',
      mobile: '9820922448',
      email: 'karthik.iyer@example.com',
      dob: new Date('1990-11-12'),
      address: '12 Lake Road, Powai, Mumbai 400076',
      occupation: 'Self-employed',
      employer: 'Iyer Trading Co',
      monthlyIncome: 9500000,
      bankName: 'Axis Bank',
      bankAccount: encryptPII('AXIS99001234'),
      bankIfsc: 'AXIS0000990',
      upiId: 'karthik@axis',
      aadhaarMasked: maskAadhaar('456789011122'),
      panMasked: maskPan('CPIIK9012G'),
      assignedAgentId: agent2.id,
      status: 'ACTIVE',
    },
  })

  console.log(`  ✓ Candidates: Priya, Rahul, Karthik`)

  // --- KYC documents ---
  const seedRawKyc: Record<string, { aadhaar: string; pan: string }> = {
    'candidate-001': { aadhaar: '234567897892', pan: 'ABCDP1234E' },
    'candidate-002': { aadhaar: '345678904521', pan: 'BPMPR5678F' },
    'candidate-003': { aadhaar: '456789011122', pan: 'CPIIK9012G' },
  }
  for (const c of [candidate1, candidate2, candidate3]) {
    const raw = seedRawKyc[c.id]
    await db.kycDocument.upsert({
      where: { id: `kyc-${c.id}` },
      update: {
        panNumber: encryptPII(raw.pan),
      },
      create: {
        id: `kyc-${c.id}`,
        candidateId: c.id,
        panNumber: encryptPII(raw.pan),
        status: 'VERIFIED',
        verifiedAt: new Date(),
      },
    })
  }

  // --- Sample applications ---
  // Application 1: PENDING for candidate1 (Priya, not yet submitted — pending KYC)
  const app1 = await db.application.upsert({
    where: { applicationNumber: 'APP-2024-1024' },
    update: {
      kycPan: encryptPII('ABCDP1234E'),
    },
    create: {
      id: 'app-001',
      organizationId: org.id,
      candidateId: candidate1.id,
      applicationNumber: 'APP-2024-1024',
      principalAmount: 7500000, // ₹75,000
      currency: 'INR',
      purpose: 'Home renovation',
      interestType: InterestType.PERCENTAGE,
      interestRate: 1800, // 18%
      frequency: RepaymentFrequency.MONTHLY,
      tenureCount: 12,
      installments: 12,
      firstDueDate: new Date('2024-09-20'),
      processingFee: 75000,
      otherFees: 0,
      status: ApplicationStatus.SUBMITTED,
      kycPan: encryptPII('ABCDP1234E'),
      kycStatus: 'VERIFIED',
      agreementTemplateId: agreement.id,
      agreementVersion: '3.1',
      agreementAcceptedAt: new Date(),
      submittedAt: new Date(),
    },
  })

  // Application 2: APPROVED for candidate2 (Rahul, already approved & has loan)
  const app2 = await db.application.upsert({
    where: { applicationNumber: 'APP-2024-0892' },
    update: {
      kycPan: encryptPII('BPMPR5678F'),
    },
    create: {
      id: 'app-002',
      organizationId: org.id,
      candidateId: candidate2.id,
      applicationNumber: 'APP-2024-0892',
      principalAmount: 7500000,
      currency: 'INR',
      purpose: 'Two-wheeler purchase',
      interestType: InterestType.PERCENTAGE,
      interestRate: 1800,
      frequency: RepaymentFrequency.MONTHLY,
      tenureCount: 12,
      installments: 12,
      firstDueDate: new Date('2024-08-20'),
      processingFee: 75000,
      otherFees: 0,
      status: ApplicationStatus.APPROVED,
      kycPan: encryptPII('BPMPR5678F'),
      kycStatus: 'VERIFIED',
      agreementTemplateId: agreement.id,
      agreementVersion: '3.1',
      agreementAcceptedAt: new Date('2024-08-12'),
      submittedAt: new Date('2024-08-12'),
      reviewedAt: new Date('2024-08-12'),
      reviewedById: owner.id,
      reviewNotes: 'KYC verified, income sufficient, low obligations.',
    },
  })

  // --- Approved loan for candidate2 ---
  // The schedule, loan totals and payment allocation are ALL derived from
  // the real server engine (src/lib/server/financial.ts generateSchedule),
  // so the seeded loan row, its installments and its payment can never
  // disagree: feesComponent carries the processing fee, and the loan's
  // outstanding*/totalCollected are exactly the schedule sums minus the
  // first (paid) installment's components.
  const principal2 = 7500000
  const interestRate2 = 1800 // bps
  const installments2 = 12
  const processingFee2 = 75000

  const schedule2 = generateSchedule({
    principalPaise: BigInt(principal2),
    interestType: InterestType.PERCENTAGE,
    interestRateBps: BigInt(interestRate2),
    fixedInterestPaise: BigInt(0),
    frequency: RepaymentFrequency.MONTHLY,
    installments: installments2,
    firstDueDate: new Date('2024-08-20'),
    processingFeePaise: BigInt(processingFee2),
    otherFeesPaise: BigInt(0),
  })
  const installmentAmount2 = Number(schedule2.installmentAmount)
  const totalRepayable2 = Number(schedule2.totalRepayable)
  const firstInstallment2 = schedule2.installments[0]
  // Installment #1 is the one paid installment in this seed.
  const totalCollected2 = Number(firstInstallment2.totalDue)
  const outstandingPrincipal2 = principal2 - Number(firstInstallment2.principalComponent)
  const outstandingInterest2 = Number(schedule2.totalInterest) - Number(firstInstallment2.interestComponent)
  const outstandingFees2 = Number(schedule2.totalFees) - Number(firstInstallment2.feesComponent)

  const termsSnapshot = {
    principalAmount: principal2,
    interestType: 'PERCENTAGE',
    interestRate: interestRate2,
    frequency: 'MONTHLY',
    installments: installments2,
    firstDueDate: new Date('2024-08-20').toISOString(),
    finalDueDate: schedule2.finalDueDate.toISOString(),
    processingFee: processingFee2,
    otherFees: 0,
    totalRepayable: totalRepayable2,
    installmentAmount: installmentAmount2,
  }

  const loan2 = await db.loan.upsert({
    where: { loanNumber: 'LON-2024-0892' },
    update: {},
    create: {
      id: 'loan-001',
      organizationId: org.id,
      loanNumber: 'LON-2024-0892',
      candidateId: candidate2.id,
      applicationId: app2.id,
      principalAmount: principal2,
      interestType: InterestType.PERCENTAGE,
      interestRate: interestRate2,
      frequency: RepaymentFrequency.MONTHLY,
      installments: installments2,
      firstDueDate: new Date('2024-08-20'),
      finalDueDate: schedule2.finalDueDate,
      processingFee: processingFee2,
      otherFees: 0,
      totalRepayable: totalRepayable2,
      installmentAmount: installmentAmount2,
      termsSnapshot,
      status: LoanStatus.ACTIVE,
      disbursedAt: new Date('2024-08-12'),
      outstandingPrincipal: outstandingPrincipal2,
      outstandingInterest: outstandingInterest2,
      outstandingFees: outstandingFees2,
      totalCollected: totalCollected2,
    },
  })

  // --- Generate schedule for loan-001 (12 monthly installments, from the engine) ---
  for (let i = 0; i < schedule2.installments.length; i++) {
    const plan = schedule2.installments[i]
    const isPaid = i === 0
    const isDue = i === 1

    const status: InstallmentStatus = isPaid
      ? InstallmentStatus.PAID
      : isDue
        ? InstallmentStatus.DUE
        : InstallmentStatus.UPCOMING

    await db.installment.upsert({
      where: { loanId_installmentNumber: { loanId: loan2.id, installmentNumber: plan.installmentNumber } },
      update: {},
      create: {
        loanId: loan2.id,
        installmentNumber: plan.installmentNumber,
        dueDate: plan.dueDate,
        openingPrincipal: Number(plan.openingPrincipal),
        principalComponent: Number(plan.principalComponent),
        interestComponent: Number(plan.interestComponent),
        feesComponent: Number(plan.feesComponent),
        totalDue: Number(plan.totalDue),
        closingPrincipal: Number(plan.closingPrincipal),
        paidFees: isPaid ? Number(plan.feesComponent) : 0,
        paidInterest: isPaid ? Number(plan.interestComponent) : 0,
        paidPrincipal: isPaid ? Number(plan.principalComponent) : 0,
        paidAmount: isPaid ? Number(plan.totalDue) : 0,
        status,
        paidAt: isPaid ? new Date('2024-08-20') : null,
      },
    })
  }

  // --- Payment for installment 1 (already captured) ---
  // Allocation follows the engine's Fees -> Interest -> Principal waterfall
  // for installment #1, so it matches the installment's paid* fields exactly.
  await db.payment.upsert({
    where: { paymentNumber: 'PAY-2024-8841' },
    update: {},
    create: {
      id: 'payment-001',
      organizationId: org.id,
      paymentNumber: 'PAY-2024-8841',
      loanId: loan2.id,
      candidateId: candidate2.id,
      method: PaymentMethod.ONLINE_UPI,
      amount: installmentAmount2,
      reference: 'UPI-9876543210',
      status: PaymentStatus.ALLOCATED,
      allocatedFees: Number(firstInstallment2.feesComponent),
      allocatedInterest: Number(firstInstallment2.interestComponent),
      allocatedPrincipal: Number(firstInstallment2.principalComponent),
      unallocated: 0,
      allocatedAt: new Date('2024-08-20'),
      receiptNumber: 'RCP-2024-8841',
      idempotencyKey: 'idem-pay-001',
      providerEventId: 'evt-mock-001',
    },
  })

  // --- Collection task (assigned to agent1) for next due installment ---
  const nextDueDate = new Date('2024-09-20')
  await db.collectionTask.upsert({
    where: { id: 'task-001' },
    update: {},
    create: {
      id: 'task-001',
      organizationId: org.id,
      candidateId: candidate2.id,
      loanId: loan2.id,
      assignedToId: agent1.id,
      title: 'Installment #2 reminder — Rahul Verma',
      description: 'Reminder for next monthly installment',
      amount: installmentAmount2,
      dueDate: nextDueDate,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.ASSIGNED,
    },
  })

  // --- PTP ---
  await db.ptp.upsert({
    where: { id: 'ptp-001' },
    update: {},
    create: {
      id: 'ptp-001',
      candidateId: candidate2.id,
      loanId: loan2.id,
      agentId: agentUser.id,
      promisedAmount: 500000,
      promiseDate: new Date('2024-09-25'),
      status: PtpStatus.ACTIVE,
      notes: 'Will pay after shop revenue comes in',
    },
  })

  // --- Notifications ---
  await db.notification.createMany({
    data: [
      {
        id: 'notif-001',
        organizationId: org.id,
        userId: candidateUser.id,
        candidateId: candidate1.id,
        type: NotificationType.PAYMENT_REMINDER,
        title: 'Application received',
        message: 'Your loan application APP-2024-1024 is under review.',
        isRead: false,
      },
      {
        id: 'notif-002',
        organizationId: org.id,
        userId: owner.id,
        type: NotificationType.APPLICATION_SUBMITTED,
        title: 'New application submitted',
        message: 'Priya Sharma submitted APP-2024-1024 for ₹75,000.',
        isRead: false,
      },
      {
        id: 'notif-003',
        organizationId: org.id,
        userId: agentUser.id,
        type: NotificationType.COLLECTION_REMINDER,
        title: 'Payment due reminder',
        message: 'Rahul Verma installment #2 (₹7,437.50) due 20 Sep.',
        isRead: false,
      },
    ],
    skipDuplicates: true,
  })

  // --- Audit logs ---
  await db.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        userId: owner.id,
        action: AuditAction.CREATE,
        entityType: 'Application',
        entityId: app1.id,
        description: 'Owner created application APP-2024-1024',
      },
      {
        organizationId: org.id,
        userId: owner.id,
        action: AuditAction.APPROVE,
        entityType: 'Application',
        entityId: app2.id,
        description: 'Owner approved APP-2024-0892',
      },
      {
        organizationId: org.id,
        userId: owner.id,
        action: AuditAction.CREATE,
        entityType: 'Loan',
        entityId: loan2.id,
        description: 'Loan LON-2024-0892 originated from approved application',
      },
      {
        organizationId: org.id,
        userId: owner.id,
        action: AuditAction.DISBURSE,
        entityType: 'Loan',
        entityId: loan2.id,
        description: 'Loan disbursed (offline ₹75,000)',
      },
      {
        organizationId: org.id,
        userId: owner.id,
        action: AuditAction.ALLOCATE,
        entityType: 'Payment',
        entityId: 'payment-001',
        description: 'Payment PAY-2024-8841 allocated to installment #1',
      },
    ],
    skipDuplicates: true,
  })

  // --- Sample QR link ---
  await db.qrLink.upsert({
    where: { token: 'a3f8d2e91b7c4f0a8e2d1b6c9f4a3e8d' },
    update: {},
    create: {
      organizationId: org.id,
      token: 'a3f8d2e91b7c4f0a8e2d1b6c9f4a3e8d',
      createdById: owner.id,
      prePrincipal: 10000000,
      preInterestType: InterestType.PERCENTAGE,
      preInterestRate: 1800,
      preFrequency: RepaymentFrequency.WEEKLY,
      preInstallments: 20,
      prePurpose: 'Working capital for shop',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
      isUsed: false,
    },
  })

  // --- Documents ---
  await db.document.createMany({
    data: [
      {
        id: 'doc-001',
        organizationId: org.id,
        candidateId: candidate1.id,
        type: DocumentType.AADHAAR,
        fileName: 'priya_aadhaar.pdf',
        fileUrl: 'mock://docs/priya_aadhaar.pdf',
        status: 'VERIFIED',
      },
      {
        id: 'doc-002',
        organizationId: org.id,
        candidateId: candidate1.id,
        type: DocumentType.PAN,
        fileName: 'priya_pan.pdf',
        fileUrl: 'mock://docs/priya_pan.pdf',
        status: 'VERIFIED',
      },
    ],
    skipDuplicates: true,
  })

  // --- Support ticket ---
  await db.supportTicket.createMany({
    data: [
      {
        id: 'sup-001',
        organizationId: org.id,
        candidateId: candidate1.id,
        ticketNumber: 'SUP-2024-128',
        category: 'Application Status',
        subject: 'When will my application be reviewed?',
        description: 'I submitted my application 2 hours ago. Please let me know the status.',
        status: 'OPEN',
      },
    ],
    skipDuplicates: true,
  })

  console.log(`  ✓ Sample applications, loan, schedule, payment, tasks, notifications, audit, QR link`)
  console.log(`✅ Seeded successfully.`)
  console.log(`\n📋 Seeded accounts (passwords are the SEED_*_PASSWORD values you set — never printed here):`)
  console.log(`   Owner:   owner@loanops.in`)
  console.log(`   Agent:   agent@loanops.in`)
  console.log(`   Agent2:  agent2@loanops.in`)
  console.log(`   Candidate (mobile login): 9820277789`)
  console.log(`   Secure application link: /apply/a3f8d2e91b7c4f0a8e2d1b6c9f4a3e8d`)
}

function agent1User_id_or(_profile: any, _user: any) {
  return _user.id
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
