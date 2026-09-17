// Mock data layer - simulates backend API responses
// In production, replace these with actual fetch() calls to /api/* endpoints.
// All monetary values are in paise.

export type Status =
  | 'ACTIVE' | 'PENDING_DISBURSEMENT' | 'CLOSED' | 'OVERDUE' | 'UPCOMING' | 'DUE'
  | 'PARTIALLY_PAID' | 'PAID' | 'FULFILLED' | 'BROKEN' | 'OPEN' | 'RESOLVED'
  | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUESTED'
  | 'INITIATED' | 'VERIFIED' | 'ALLOCATED' | 'PENDING_VERIFICATION'

export interface KPISet {
  totalCandidates: number
  activeCandidates: number
  totalApplications: number
  pendingApplications: number
  approvedApplications: number
  rejectedApplications: number
  activeLoans: number
  completedLoans: number
  totalDisbursed: number
  outstandingPrincipal: number
  totalInterestScheduled: number
  totalCollected: number
  totalOverdue: number
  overdueLoans: number
  collectionRate: number
  // Operational
  appsWaitingReview: number
  loansReadyForDisbursement: number
  paymentsDueToday: number
  paymentsOverdue: number
  ptpDueToday: number
  brokenPtp: number
  openTasks: number
  openEscalations: number
  pendingCashVerification: number
}

export const ownerKPIs: KPISet = {
  totalCandidates: 1284,
  activeCandidates: 932,
  totalApplications: 318,
  pendingApplications: 27,
  approvedApplications: 248,
  rejectedApplications: 43,
  activeLoans: 612,
  completedLoans: 184,
  totalDisbursed: 2840000000, // paise → ₹28.4 Cr
  outstandingPrincipal: 1240000000,
  totalInterestScheduled: 426000000,
  totalCollected: 1920000000,
  totalOverdue: 84200000,
  overdueLoans: 38,
  collectionRate: 94.2,
  appsWaitingReview: 12,
  loansReadyForDisbursement: 8,
  paymentsDueToday: 42,
  paymentsOverdue: 38,
  ptpDueToday: 14,
  brokenPtp: 6,
  openTasks: 24,
  openEscalations: 4,
  pendingCashVerification: 9,
}

export interface RecentActivity {
  id: string
  type: 'APPLICATION' | 'LOAN' | 'PAYMENT' | 'PTP' | 'ESCALATION' | 'CASH' | 'DISBURSEMENT' | 'AUDIT'
  title: string
  description: string
  actor: string
  amount?: number
  timestamp: string
  status?: string
}

export const recentActivity: RecentActivity[] = [
  { id: 'a1', type: 'APPLICATION', title: 'New application submitted', description: 'Home improvement loan ₹1,20,000', actor: 'Priya Sharma', amount: 12000000, timestamp: '2m ago', status: 'SUBMITTED' },
  { id: 'a2', type: 'PAYMENT', title: 'Payment received', description: 'UPI payment for LON-2024-0892', actor: 'Rahul Verma', amount: 520000, timestamp: '12m ago', status: 'VERIFIED' },
  { id: 'a3', type: 'DISBURSEMENT', title: 'Disbursement completed', description: 'Offline cash disbursed to LON-2024-0884', actor: 'Owner', amount: 50000000, timestamp: '34m ago', status: 'COMPLETED' },
  { id: 'a4', type: 'PTP', title: 'PTP created', description: 'Promised ₹8,000 by 22 Sep', actor: 'Agent: Arjun Nair', amount: 800000, timestamp: '1h ago', status: 'ACTIVE' },
  { id: 'a5', type: 'ESCALATION', title: 'Escalation opened', description: 'Long overdue > 30 days for LON-2024-0712', actor: 'Agent: Sneha Kapoor', timestamp: '2h ago', status: 'OPEN' },
  { id: 'a6', type: 'CASH', title: 'Cash pending verification', description: '₹4,500 cash collection awaiting supervisor review', actor: 'Agent: Vikram Singh', amount: 450000, timestamp: '2h ago', status: 'PENDING_VERIFICATION' },
  { id: 'a7', type: 'AUDIT', title: 'Agreement accepted', description: 'Agreement v3.1 accepted by candidate', actor: 'Anjali Reddy', timestamp: '3h ago' },
  { id: 'a8', type: 'LOAN', title: 'Loan closed', description: 'LON-2024-0521 fully repaid', actor: 'System', amount: 100000, timestamp: '4h ago', status: 'CLOSED' },
]

export interface AIAlert {
  id: string
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  candidateName: string
  loanNumber: string
  reasons: string[]
  suggestedAction: string
}

export const aiAlerts: AIAlert[] = [
  {
    id: 'ai1',
    level: 'HIGH',
    title: 'Candidate requires immediate attention',
    candidateName: 'Karthik Iyer',
    loanNumber: 'LON-2024-0812',
    reasons: ['2 missed installments', 'Recent payment failure', 'PTP due tomorrow'],
    suggestedAction: 'Assign senior agent for collection follow-up',
  },
  {
    id: 'ai2',
    level: 'MEDIUM',
    title: 'Upcoming payment risk signal',
    candidateName: 'Meena Desai',
    loanNumber: 'LON-2024-0834',
    reasons: ['Cash payment rejected last week', 'No contact in 7 days'],
    suggestedAction: 'Send WhatsApp reminder & schedule call',
  },
  {
    id: 'ai3',
    level: 'HIGH',
    title: 'Broken PTP pattern detected',
    candidateName: 'Suresh Patel',
    loanNumber: 'LON-2024-0698',
    reasons: ['2 broken PTPs in 30 days', 'Outstanding > ₹50,000'],
    suggestedAction: 'Escalate & consider field visit',
  },
]

export interface PortfolioTrendPoint {
  label: string
  disbursed: number
  collected: number
  outstanding: number
}

export const portfolioTrend: PortfolioTrendPoint[] = [
  { label: 'Apr', disbursed: 384000000, collected: 312000000, outstanding: 980000000 },
  { label: 'May', disbursed: 412000000, collected: 348000000, outstanding: 1050000000 },
  { label: 'Jun', disbursed: 468000000, collected: 392000000, outstanding: 1120000000 },
  { label: 'Jul', disbursed: 524000000, collected: 416000000, outstanding: 1180000000 },
  { label: 'Aug', disbursed: 492000000, collected: 478000000, outstanding: 1210000000 },
  { label: 'Sep', disbursed: 562000000, collected: 502000000, outstanding: 1240000000 },
]

export interface OverdueAgingBucket {
  bucket: string
  count: number
  amount: number
}

export const overdueAging: OverdueAgingBucket[] = [
  { bucket: '1-7 days', count: 14, amount: 18500000 },
  { bucket: '8-15 days', count: 9, amount: 24800000 },
  { bucket: '16-30 days', count: 7, amount: 19800000 },
  { bucket: '31-60 days', count: 5, amount: 14200000 },
  { bucket: '60+ days', count: 3, amount: 6900000 },
]

export interface AgentPerformanceRow {
  id: string
  agentName: string
  zone: string
  tasksAssigned: number
  tasksCompleted: number
  followUps: number
  ptpCreated: number
  ptpFulfilled: number
  ptpBroken: number
  collectionAmount: number
  outstandingAssigned: number
  successRate: number
}

export const agentPerformance: AgentPerformanceRow[] = [
  { id: 'ap1', agentName: 'Arjun Nair', zone: 'Mumbai South', tasksAssigned: 48, tasksCompleted: 42, followUps: 124, ptpCreated: 18, ptpFulfilled: 14, ptpBroken: 3, collectionAmount: 42800000, outstandingAssigned: 84200000, successRate: 87.5 },
  { id: 'ap2', agentName: 'Sneha Kapoor', zone: 'Mumbai West', tasksAssigned: 52, tasksCompleted: 38, followUps: 156, ptpCreated: 22, ptpFulfilled: 15, ptpBroken: 5, collectionAmount: 38400000, outstandingAssigned: 96800000, successRate: 73.1 },
  { id: 'ap3', agentName: 'Vikram Singh', zone: 'Pune', tasksAssigned: 44, tasksCompleted: 40, followUps: 108, ptpCreated: 14, ptpFulfilled: 12, ptpBroken: 1, collectionAmount: 51200000, outstandingAssigned: 72400000, successRate: 90.9 },
  { id: 'ap4', agentName: 'Divya Menon', zone: 'Thane', tasksAssigned: 38, tasksCompleted: 35, followUps: 92, ptpCreated: 16, ptpFulfilled: 13, ptpBroken: 2, collectionAmount: 46200000, outstandingAssigned: 68400000, successRate: 92.1 },
  { id: 'ap5', agentName: 'Rohit Gupta', zone: 'Nashik', tasksAssigned: 36, tasksCompleted: 28, followUps: 86, ptpCreated: 12, ptpFulfilled: 7, ptpBroken: 4, collectionAmount: 28600000, outstandingAssigned: 81200000, successRate: 77.8 },
]

export interface ApplicationRow {
  id: string
  applicationNumber: string
  candidateName: string
  mobile: string
  principalAmount: number
  purpose: string
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  installments: number
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUESTED'
  submittedAt: string
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
}

export const applications: ApplicationRow[] = [
  { id: 'app1', applicationNumber: 'APP-2024-1024', candidateName: 'Priya Sharma', mobile: '+91 98202 77889', principalAmount: 12000000, purpose: 'Home renovation', frequency: 'WEEKLY', installments: 20, status: 'SUBMITTED', submittedAt: '2 hours ago', kycStatus: 'VERIFIED' },
  { id: 'app2', applicationNumber: 'APP-2024-1023', candidateName: 'Rahul Verma', mobile: '+91 98203 22119', principalAmount: 7500000, purpose: 'Two-wheeler purchase', frequency: 'MONTHLY', installments: 12, status: 'UNDER_REVIEW', submittedAt: '5 hours ago', kycStatus: 'PENDING' },
  { id: 'app3', applicationNumber: 'APP-2024-1022', candidateName: 'Anjali Reddy', mobile: '+91 98204 55662', principalAmount: 25000000, purpose: 'Working capital', frequency: 'WEEKLY', installments: 26, status: 'SUBMITTED', submittedAt: '1 day ago', kycStatus: 'VERIFIED' },
  { id: 'app4', applicationNumber: 'APP-2024-1021', candidateName: 'Imran Khan', mobile: '+91 98205 88334', principalAmount: 5000000, purpose: 'Medical expenses', frequency: 'MONTHLY', installments: 6, status: 'INFORMATION_REQUESTED', submittedAt: '1 day ago', kycStatus: 'REJECTED' },
  { id: 'app5', applicationNumber: 'APP-2024-1020', candidateName: 'Sneha Bhat', mobile: '+91 98206 11227', principalAmount: 18000000, purpose: 'Business expansion', frequency: 'WEEKLY', installments: 30, status: 'APPROVED', submittedAt: '2 days ago', kycStatus: 'VERIFIED' },
  { id: 'app6', applicationNumber: 'APP-2024-1019', candidateName: 'Vivek Joshi', mobile: '+91 98207 33994', principalAmount: 8500000, purpose: 'Education fees', frequency: 'MONTHLY', installments: 18, status: 'REJECTED', submittedAt: '3 days ago', kycStatus: 'VERIFIED' },
  { id: 'app7', applicationNumber: 'APP-2024-1018', candidateName: 'Meena Desai', mobile: '+91 98208 66771', principalAmount: 15000000, purpose: 'Festival inventory', frequency: 'DAILY', installments: 60, status: 'UNDER_REVIEW', submittedAt: '3 days ago', kycStatus: 'PENDING' },
  { id: 'app8', applicationNumber: 'APP-2024-1017', candidateName: 'Karthik Iyer', mobile: '+91 98209 22448', principalAmount: 32000000, purpose: 'Shop setup', frequency: 'WEEKLY', installments: 24, status: 'APPROVED', submittedAt: '4 days ago', kycStatus: 'VERIFIED' },
]

export interface LoanRow {
  id: string
  loanNumber: string
  candidateName: string
  mobile: string
  principalAmount: number
  interestType: 'PERCENTAGE' | 'FIXED' | 'NONE'
  interestRate?: number
  fixedInterest?: number
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  installments: number
  installmentAmount: number
  totalRepayable: number
  outstandingPrincipal: number
  totalCollected: number
  status: 'PENDING_DISBURSEMENT' | 'ACTIVE' | 'CLOSED' | 'DEFAULTED' | 'WRITTEN_OFF'
  disbursedAt?: string
  nextDueDate?: string
  agentName?: string
}

export const loans: LoanRow[] = [
  { id: 'l1', loanNumber: 'LON-2024-0892', candidateName: 'Rahul Verma', mobile: '+91 98203 22119', principalAmount: 7500000, interestType: 'PERCENTAGE', interestRate: 1800, frequency: 'MONTHLY', installments: 12, installmentAmount: 742500, totalRepayable: 8910000, outstandingPrincipal: 6240000, totalCollected: 1485000, status: 'ACTIVE', disbursedAt: '12 Aug 2024', nextDueDate: '20 Sep 2024', agentName: 'Arjun Nair' },
  { id: 'l2', loanNumber: 'LON-2024-0884', candidateName: 'Imran Khan', mobile: '+91 98205 88334', principalAmount: 5000000, interestType: 'PERCENTAGE', interestRate: 2400, frequency: 'WEEKLY', installments: 20, installmentAmount: 285000, totalRepayable: 5700000, outstandingPrincipal: 4500000, totalCollected: 855000, status: 'ACTIVE', disbursedAt: '18 Aug 2024', nextDueDate: '19 Sep 2024', agentName: 'Vikram Singh' },
  { id: 'l3', loanNumber: 'LON-2024-0812', candidateName: 'Karthik Iyer', mobile: '+91 98209 22448', principalAmount: 32000000, interestType: 'PERCENTAGE', interestRate: 1500, frequency: 'WEEKLY', installments: 24, installmentAmount: 1430000, totalRepayable: 34320000, outstandingPrincipal: 28600000, totalCollected: 4290000, status: 'ACTIVE', disbursedAt: '22 Jul 2024', nextDueDate: '18 Sep 2024 (OVERDUE)', agentName: 'Sneha Kapoor' },
  { id: 'l4', loanNumber: 'LON-2024-0834', candidateName: 'Meena Desai', mobile: '+91 98208 66771', principalAmount: 15000000, interestType: 'FIXED', fixedInterest: 1200000, frequency: 'DAILY', installments: 60, installmentAmount: 270000, totalRepayable: 16200000, outstandingPrincipal: 12450000, totalCollected: 3750000, status: 'ACTIVE', disbursedAt: '05 Aug 2024', nextDueDate: 'Today', agentName: 'Divya Menon' },
  { id: 'l5', loanNumber: 'LON-2024-0698', candidateName: 'Suresh Patel', mobile: '+91 98210 44551', principalAmount: 8000000, interestType: 'PERCENTAGE', interestRate: 2000, frequency: 'WEEKLY', installments: 26, installmentAmount: 369000, totalRepayable: 9594000, outstandingPrincipal: 7380000, totalCollected: 1107000, status: 'ACTIVE', disbursedAt: '14 Jun 2024', nextDueDate: 'OVERDUE 18 days', agentName: 'Rohit Gupta' },
  { id: 'l6', loanNumber: 'LON-2024-0521', candidateName: 'Anita Pawar', mobile: '+91 98211 88223', principalAmount: 4000000, interestType: 'NONE', frequency: 'MONTHLY', installments: 6, installmentAmount: 667000, totalRepayable: 4000000, outstandingPrincipal: 0, totalCollected: 4000000, status: 'CLOSED', disbursedAt: '15 Mar 2024', agentName: 'Arjun Nair' },
  { id: 'l7', loanNumber: 'LON-2024-0915', candidateName: 'Sneha Bhat', mobile: '+91 98206 11227', principalAmount: 18000000, interestType: 'PERCENTAGE', interestRate: 1600, frequency: 'WEEKLY', installments: 30, installmentAmount: 696000, totalRepayable: 20880000, outstandingPrincipal: 18000000, totalCollected: 0, status: 'PENDING_DISBURSEMENT', agentName: 'Divya Menon' },
  { id: 'l8', loanNumber: 'LON-2024-0712', candidateName: 'Sahil Khan', mobile: '+91 98212 66778', principalAmount: 12000000, interestType: 'PERCENTAGE', interestRate: 2200, frequency: 'MONTHLY', installments: 12, installmentAmount: 1220000, totalRepayable: 14640000, outstandingPrincipal: 11000000, totalCollected: 1220000, status: 'ACTIVE', disbursedAt: '28 Jun 2024', nextDueDate: 'OVERDUE 32 days', agentName: 'Sneha Kapoor' },
]

export interface CollectionTaskRow {
  id: string
  candidateName: string
  loanNumber: string
  amount: number
  dueDate: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED'
  assignedTo?: string
  lastContact?: string
  nextFollowUp?: string
}

export const agentTasks: CollectionTaskRow[] = [
  { id: 't1', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', amount: 1430000, dueDate: 'Today', priority: 'URGENT', status: 'ASSIGNED', assignedTo: 'You', lastContact: '2 days ago', nextFollowUp: 'Today 4:00 PM' },
  { id: 't2', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', amount: 1220000, dueDate: 'Today', priority: 'HIGH', status: 'ASSIGNED', assignedTo: 'You', lastContact: '5 days ago', nextFollowUp: 'Today 5:30 PM' },
  { id: 't3', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', amount: 369000, dueDate: 'Tomorrow', priority: 'HIGH', status: 'OPEN', assignedTo: 'You', lastContact: '1 week ago', nextFollowUp: 'Tomorrow 10:00 AM' },
  { id: 't4', candidateName: 'Rahul Verma', loanNumber: 'LON-2024-0892', amount: 742500, dueDate: '20 Sep', priority: 'MEDIUM', status: 'ASSIGNED', assignedTo: 'You', lastContact: '3 days ago', nextFollowUp: '20 Sep 11:00 AM' },
  { id: 't5', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', amount: 270000, dueDate: 'Today', priority: 'MEDIUM', status: 'ASSIGNED', assignedTo: 'You', lastContact: 'Yesterday', nextFollowUp: 'Today 6:00 PM' },
]

export interface AgentCandidateRow {
  id: string
  name: string
  mobile: string
  loanNumber: string
  outstanding: number
  overdue: number
  daysOverdue: number
  nextPayment: string
  ptp?: string
  lastContact: string
  nextFollowUp?: string
}

export const agentCandidates: AgentCandidateRow[] = [
  { id: 'c1', name: 'Karthik Iyer', mobile: '+91 98209 22448', loanNumber: 'LON-2024-0812', outstanding: 28600000, overdue: 2860000, daysOverdue: 4, nextPayment: 'Today', ptp: '₹14,30,000 on 22 Sep', lastContact: '2 days ago', nextFollowUp: 'Today 4:00 PM' },
  { id: 'c2', name: 'Sahil Khan', mobile: '+91 98212 66778', loanNumber: 'LON-2024-0712', outstanding: 11000000, overdue: 2440000, daysOverdue: 32, nextPayment: 'OVERDUE', ptp: 'BROKEN', lastContact: '5 days ago', nextFollowUp: 'Today 5:30 PM' },
  { id: 'c3', name: 'Suresh Patel', mobile: '+91 98210 44551', loanNumber: 'LON-2024-0698', outstanding: 7380000, overdue: 1107000, daysOverdue: 18, nextPayment: 'OVERDUE', lastContact: '1 week ago', nextFollowUp: 'Tomorrow 10:00 AM' },
  { id: 'c4', name: 'Rahul Verma', mobile: '+91 98203 22119', loanNumber: 'LON-2024-0892', outstanding: 6240000, overdue: 0, daysOverdue: 0, nextPayment: '20 Sep', lastContact: '3 days ago', nextFollowUp: '20 Sep 11:00 AM' },
  { id: 'c5', name: 'Meena Desai', mobile: '+91 98208 66771', loanNumber: 'LON-2024-0834', outstanding: 12450000, overdue: 270000, daysOverdue: 1, nextPayment: 'Today', lastContact: 'Yesterday', nextFollowUp: 'Today 6:00 PM' },
  { id: 'c6', name: 'Imran Khan', mobile: '+91 98205 88334', loanNumber: 'LON-2024-0884', outstanding: 4500000, overdue: 0, daysOverdue: 0, nextPayment: '19 Sep', lastContact: '4 days ago' },
]

export interface PtpRow {
  id: string
  candidateName: string
  loanNumber: string
  promisedAmount: number
  promiseDate: string
  status: 'ACTIVE' | 'FULFILLED' | 'BROKEN' | 'CANCELLED'
  notes?: string
}

export const agentPtps: PtpRow[] = [
  { id: 'p1', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', promisedAmount: 1430000, promiseDate: '22 Sep 2024', status: 'ACTIVE', notes: 'Will pay after shop revenue comes in' },
  { id: 'p2', candidateName: 'Rahul Verma', loanNumber: 'LON-2024-0892', promisedAmount: 742500, promiseDate: '20 Sep 2024', status: 'ACTIVE' },
  { id: 'p3', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', promisedAmount: 2440000, promiseDate: '15 Sep 2024', status: 'BROKEN', notes: 'No answer for 3 days' },
  { id: 'p4', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', promisedAmount: 1107000, promiseDate: '10 Sep 2024', status: 'BROKEN' },
  { id: 'p5', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', promisedAmount: 540000, promiseDate: '25 Sep 2024', status: 'ACTIVE' },
]

export interface CashCollectionRow {
  id: string
  candidateName: string
  loanNumber: string
  amount: number
  collectionDate: string
  collectionTime: string
  status: 'RECORDED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'ALLOCATED' | 'REJECTED'
  reference?: string
  notes?: string
}

export const cashCollections: CashCollectionRow[] = [
  { id: 'cc1', candidateName: 'Rahul Verma', loanNumber: 'LON-2024-0892', amount: 742500, collectionDate: 'Today', collectionTime: '11:30 AM', status: 'PENDING_VERIFICATION', reference: 'CASH-2024-4471', notes: 'Collected from shop' },
  { id: 'cc2', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', amount: 540000, collectionDate: 'Today', collectionTime: '1:15 PM', status: 'PENDING_VERIFICATION', reference: 'CASH-2024-4472' },
  { id: 'cc3', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', amount: 369000, collectionDate: 'Yesterday', collectionTime: '4:45 PM', status: 'VERIFIED', reference: 'CASH-2024-4469', notes: 'Verified by supervisor' },
  { id: 'cc4', candidateName: 'Imran Khan', loanNumber: 'LON-2024-0884', amount: 285000, collectionDate: 'Yesterday', collectionTime: '10:00 AM', status: 'ALLOCATED', reference: 'CASH-2024-4468' },
  { id: 'cc5', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', amount: 500000, collectionDate: '15 Sep', collectionTime: '3:00 PM', status: 'REJECTED', reference: 'CASH-2024-4465', notes: 'Amount mismatch with receipt' },
]

export interface CandidateLoanDetail {
  loanNumber: string
  principalAmount: number
  interestType: 'PERCENTAGE' | 'FIXED' | 'NONE'
  interestRate?: number
  fixedInterest?: number
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  installments: number
  installmentAmount: number
  totalRepayable: number
  outstandingPrincipal: number
  outstandingInterest: number
  outstandingFees: number
  totalCollected: number
  nextDueDate: string
  status: 'PENDING_DISBURSEMENT' | 'ACTIVE' | 'CLOSED'
  disbursedAt?: string
}

export const candidateLoan: CandidateLoanDetail = {
  loanNumber: 'LON-2024-0892',
  principalAmount: 7500000,
  interestType: 'PERCENTAGE',
  interestRate: 1800,
  frequency: 'MONTHLY',
  installments: 12,
  installmentAmount: 742500,
  totalRepayable: 8910000,
  outstandingPrincipal: 6240000,
  outstandingInterest: 1185000,
  outstandingFees: 0,
  totalCollected: 1485000,
  nextDueDate: '20 Sep 2024',
  status: 'ACTIVE',
  disbursedAt: '12 Aug 2024',
}

export interface CandidateInstallment {
  number: number
  dueDate: string
  principal: number
  interest: number
  fees: number
  totalDue: number
  status: 'UPCOMING' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
  paidAt?: string
}

export const candidateInstallments: CandidateInstallment[] = [
  { number: 1, dueDate: '12 Aug 2024', principal: 500000, interest: 242500, fees: 0, totalDue: 742500, status: 'PAID', paidAt: '10 Aug 2024' },
  { number: 2, dueDate: '20 Sep 2024', principal: 500000, interest: 242500, fees: 0, totalDue: 742500, status: 'DUE' },
  { number: 3, dueDate: '20 Oct 2024', principal: 500000, interest: 242500, fees: 0, totalDue: 742500, status: 'UPCOMING' },
  { number: 4, dueDate: '20 Nov 2024', principal: 500000, interest: 242500, fees: 0, totalDue: 742500, status: 'UPCOMING' },
  { number: 5, dueDate: '20 Dec 2024', principal: 500000, interest: 242500, fees: 0, totalDue: 742500, status: 'UPCOMING' },
  { number: 6, dueDate: '20 Jan 2025', principal: 500000, interest: 242500, fees: 0, totalDue: 742500, status: 'UPCOMING' },
]

export interface CandidatePaymentRow {
  id: string
  paymentNumber: string
  amount: number
  method: 'ONLINE_UPI' | 'ONLINE_NETBANKING' | 'ONLINE_CARD' | 'CASH' | 'BANK_TRANSFER'
  date: string
  status: 'INITIATED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'ALLOCATED' | 'FAILED' | 'REJECTED'
  receiptNumber?: string
  allocatedPrincipal?: number
  allocatedInterest?: number
}

export const candidatePayments: CandidatePaymentRow[] = [
  { id: 'p1', paymentNumber: 'PAY-2024-8841', amount: 742500, method: 'ONLINE_UPI', date: '10 Aug 2024', status: 'ALLOCATED', receiptNumber: 'RCP-2024-8841', allocatedPrincipal: 500000, allocatedInterest: 242500 },
  { id: 'p2', paymentNumber: 'PAY-2024-9142', amount: 742500, method: 'CASH', date: '20 Sep 2024', status: 'PENDING_VERIFICATION', receiptNumber: 'RCP-2024-9142' },
]

export const candidateNotifications = [
  { id: 'n1', type: 'PAYMENT_REMINDER', title: 'Payment due 20 Sep', message: 'Installment #2 of ₹7,425 is due on 20 Sep 2024', isRead: false, timestamp: '2 hours ago' },
  { id: 'n2', type: 'PAYMENT_CONFIRMATION', title: 'Payment received', message: '₹7,425 received for LON-2024-0892', isRead: true, timestamp: '4 weeks ago' },
  { id: 'n3', type: 'DISBURSEMENT', title: 'Loan disbursed', message: '₹75,000 disbursed to your account', isRead: true, timestamp: '5 weeks ago' },
]

export interface SupportTicketRow {
  id: string
  ticketNumber: string
  category: string
  subject: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  createdAt: string
  resolution?: string
}

export const supportTickets: SupportTicketRow[] = [
  { id: 'st1', ticketNumber: 'SUP-2024-128', category: 'Repayment', subject: 'Need extension for 20 Sep payment', status: 'OPEN', createdAt: '2 hours ago' },
  { id: 'st2', ticketNumber: 'SUP-2024-119', category: 'Receipt', subject: 'Receipt not generated for last payment', status: 'RESOLVED', createdAt: '3 days ago', resolution: 'Receipt re-generated and emailed' },
]

export interface EscalationRow {
  id: string
  candidateName: string
  loanNumber: string
  reason: 'REPEATED_MISSED_PAYMENT' | 'BROKEN_PTP' | 'LONG_OVERDUE' | 'FAILED_CONTACT' | 'HIGH_OUTSTANDING' | 'OTHER'
  description: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  createdAt: string
}

export const escalations: EscalationRow[] = [
  { id: 'e1', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', reason: 'LONG_OVERDUE', description: '32 days overdue, no response for 5 days', status: 'OPEN', createdAt: '2 days ago' },
  { id: 'e2', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', reason: 'BROKEN_PTP', description: 'PTP broken on 10 Sep, no payment received', status: 'IN_REVIEW', createdAt: '5 days ago' },
  { id: 'e3', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', reason: 'REPEATED_MISSED_PAYMENT', description: '2 consecutive missed installments', status: 'OPEN', createdAt: '1 day ago' },
]

export interface LedgerRow {
  id: string
  entryNumber: string
  type: 'DISBURSEMENT' | 'PAYMENT_PRINCIPAL' | 'PAYMENT_INTEREST' | 'PAYMENT_FEES' | 'REFUND' | 'CORRECTION' | 'REVERSAL' | 'FEE'
  debitAccount: string
  creditAccount: string
  amount: number
  description: string
  reference?: string
  date: string
}

export const ledgerEntries: LedgerRow[] = [
  { id: 'le1', entryNumber: 'LED-10241', type: 'DISBURSEMENT', debitAccount: 'Loans Receivable', creditAccount: 'Bank Account', amount: 7500000, description: 'Disbursement LON-2024-0892', reference: 'LON-2024-0892', date: '12 Aug 2024' },
  { id: 'le2', entryNumber: 'LED-10342', type: 'PAYMENT_PRINCIPAL', debitAccount: 'Bank Account', creditAccount: 'Loans Receivable', amount: 500000, description: 'Principal payment for installment #1', reference: 'PAY-2024-8841', date: '10 Aug 2024' },
  { id: 'le3', entryNumber: 'LED-10343', type: 'PAYMENT_INTEREST', debitAccount: 'Bank Account', creditAccount: 'Interest Income', amount: 242500, description: 'Interest payment for installment #1', reference: 'PAY-2024-8841', date: '10 Aug 2024' },
  { id: 'le4', entryNumber: 'LED-10458', type: 'DISBURSEMENT', debitAccount: 'Loans Receivable', creditAccount: 'Cash in Hand', amount: 5000000, description: 'Offline disbursement LON-2024-0884', reference: 'LON-2024-0884', date: '18 Aug 2024' },
  { id: 'le5', entryNumber: 'LED-10521', type: 'PAYMENT_FEES', debitAccount: 'Cash in Hand', creditAccount: 'Fee Income', amount: 50000, description: 'Processing fee LON-2024-0892', reference: 'FEE-2024-0892', date: '12 Aug 2024' },
]

export interface QrLinkRow {
  id: string
  token: string
  prePrincipal?: number
  preFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  preInstallments?: number
  createdBy: string
  createdAt: string
  expiresAt?: string
  isRevoked: boolean
  isUsed: boolean
  submittedAt?: string
  applicationNumber?: string
}

export const qrLinks: QrLinkRow[] = [
  { id: 'q1', token: 'a3f8d2e91b7c4f0a8e2d1b6c9f4a3e8d', prePrincipal: 10000000, preFrequency: 'WEEKLY', preInstallments: 20, createdBy: 'Ravi Mehta', createdAt: '2 hours ago', expiresAt: '7 days', isRevoked: false, isUsed: false },
  { id: 'q2', token: 'b7e3c1f8a2d9406b1e7c8f3a2d5b8e1c', prePrincipal: 25000000, preFrequency: 'WEEKLY', preInstallments: 26, createdBy: 'Ravi Mehta', createdAt: '1 day ago', expiresAt: '6 days', isRevoked: false, isUsed: true, submittedAt: '5 hours ago', applicationNumber: 'APP-2024-1023' },
  { id: 'q3', token: 'c1d4e7f8a2b9c3d0e1f2a3b4c5d6e7f8', createdBy: 'Ravi Mehta', createdAt: '3 days ago', expiresAt: '4 days', isRevoked: false, isUsed: false },
  { id: 'q4', token: 'd2e5f8a9b3c0d1e4f7a8b9c0d1e2f3a4', prePrincipal: 5000000, preFrequency: 'MONTHLY', preInstallments: 12, createdBy: 'Ravi Mehta', createdAt: '5 days ago', expiresAt: '2 days', isRevoked: true, isUsed: false },
]

export interface AgreementTemplateRow {
  id: string
  name: string
  version: string
  effectiveDate: string
  isActive: boolean
  body: string
}

export const agreementTemplates: AgreementTemplateRow[] = [
  {
    id: 'ag1',
    name: 'Standard Personal Loan Agreement',
    version: '3.1',
    effectiveDate: '01 Sep 2024',
    isActive: true,
    body: '# Loan Agreement\n\nThis agreement is entered into between **Sterling Lending** ("Lender") and the candidate ("Borrower")...',
  },
  {
    id: 'ag2',
    name: 'Standard Personal Loan Agreement',
    version: '3.0',
    effectiveDate: '01 Jun 2024',
    isActive: false,
    body: '# Loan Agreement (Previous Version)\n\n...',
  },
  {
    id: 'ag3',
    name: 'Business Loan Agreement',
    version: '2.4',
    effectiveDate: '01 Aug 2024',
    isActive: true,
    body: '# Business Loan Agreement\n\n...',
  },
]
