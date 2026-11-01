// Unit tests for the live-audit fix PR's shared helpers:
// - summarizeApplication (borrower EMI/total-repayable math, finding A.1)
// - money formatters (exactly-2-decimals everywhere, finding B)
// - paise/rupee conversion used by the profile income field (finding A.2)
// - pluralize (finding G.1) and frequency period labels (finding D.4)
import assert from 'node:assert/strict'
import { summarizeApplication } from '../../src/lib/application-summary'
import {
  formatPaiseToINR,
  formatPaiseToPlain,
  paiseToRupees,
  rupeesToPaise,
  pluralize,
} from '../../src/lib/money'
import { frequencyPeriodNoun, frequencyAdjective } from '../../src/lib/financial-engine'

interface TestCase {
  name: string
  run: () => void
}

const tests: TestCase[] = [
  {
    name: 'A.1: application with null stored totals computes EMI + repayable from terms (Priya: 75000 @ 18% x12, fee 750)',
    run: () => {
      const s = summarizeApplication({
        principalAmount: 7500000,
        interestType: 'PERCENTAGE',
        interestRate: 1800,
        frequency: 'MONTHLY',
        installments: 12,
        processingFee: 75000,
        otherFees: 0,
        firstDueDate: new Date('2026-01-20'),
        installmentAmount: null,
        totalRepayable: null,
      })
      assert.equal(s.installmentAmount, 743750) // ₹7,437.50
      assert.equal(s.totalRepayable, 8925000) // ₹89,250 = 75,000 + 13,500 interest + 750 fee
      assert.equal(s.totalInterest, 1350000)
      assert.equal(s.totalFees, 75000)
      assert.equal(s.computed, true)
    },
  },
  {
    name: 'A.1: stored totals win when present',
    run: () => {
      const s = summarizeApplication({
        principalAmount: 7500000,
        interestType: 'PERCENTAGE',
        interestRate: 1800,
        frequency: 'MONTHLY',
        installments: 12,
        processingFee: 75000,
        installmentAmount: 743750,
        totalRepayable: 8925000,
      })
      assert.equal(s.installmentAmount, 743750)
      assert.equal(s.totalRepayable, 8925000)
      assert.equal(s.computed, false)
    },
  },
  {
    name: 'A.1: no-interest application repays principal only',
    run: () => {
      const s = summarizeApplication({
        principalAmount: 1200000,
        interestType: 'NONE',
        frequency: 'WEEKLY',
        installments: 10,
        installmentAmount: null,
        totalRepayable: null,
      })
      assert.equal(s.totalRepayable, 1200000)
      assert.equal(s.installmentAmount, 120000)
      assert.equal(s.totalInterest, 0)
    },
  },
  {
    name: 'A.1: fixed-interest application spreads the fixed amount',
    run: () => {
      const s = summarizeApplication({
        principalAmount: 1000000,
        interestType: 'FIXED',
        fixedInterest: 50000,
        frequency: 'MONTHLY',
        installments: 5,
        installmentAmount: null,
        totalRepayable: null,
      })
      assert.equal(s.totalRepayable, 1050000)
      assert.equal(s.installmentAmount, 210000)
    },
  },
  {
    name: 'B: formatPaiseToINR always renders exactly 2 decimals',
    run: () => {
      assert.equal(formatPaiseToINR(743750), '₹7,437.50')
      assert.equal(formatPaiseToINR(8181250), '₹81,812.50')
      assert.equal(formatPaiseToINR(6250), '₹62.50')
      assert.equal(formatPaiseToINR(7500000), '₹75,000.00')
      assert.equal(formatPaiseToINR(0), '₹0.00')
    },
  },
  {
    name: 'B: formatPaiseToPlain groups Indian-style with 2 decimals',
    run: () => {
      assert.equal(formatPaiseToPlain(743750), '7,437.50')
      assert.equal(formatPaiseToPlain(10000000), '1,00,000.00')
    },
  },
  {
    name: 'A.2: income conversion round-trips paise <-> rupees',
    run: () => {
      assert.equal(paiseToRupees(7500000), 75000)
      assert.equal(rupeesToPaise(75000), 7500000)
      assert.equal(rupeesToPaise(paiseToRupees(7500000)), 7500000)
      assert.equal(paiseToRupees(rupeesToPaise(43210.5)), 43210.5)
    },
  },
  {
    name: 'G.1: pluralize singular/plural incl. irregular',
    run: () => {
      assert.equal(pluralize(1, 'application'), '1 application')
      assert.equal(pluralize(2, 'application'), '2 applications')
      assert.equal(pluralize(0, 'payment'), '0 payments')
      assert.equal(pluralize(1, 'entry', 'entries'), '1 entry')
      assert.equal(pluralize(7, 'entry', 'entries'), '7 entries')
    },
  },
  {
    name: 'D.4: frequency period labels name the real period',
    run: () => {
      assert.equal(frequencyPeriodNoun('MONTHLY'), 'month')
      assert.equal(frequencyPeriodNoun('WEEKLY'), 'week')
      assert.equal(frequencyPeriodNoun('DAILY'), 'day')
      assert.equal(frequencyAdjective('MONTHLY'), 'monthly')
      assert.equal(frequencyAdjective('WEEKLY'), 'weekly')
      assert.equal(frequencyAdjective('DAILY'), 'daily')
    },
  },
]

async function runTests() {
  let passed = 0
  for (const t of tests) {
    try {
      t.run()
      passed++
      console.log(`✓ ${t.name}`)
    } catch (err) {
      console.error(`✗ ${t.name}`)
      console.error(err)
      process.exit(1)
    }
  }
  console.log(`\nAll ${passed}/${tests.length} audit-fix unit tests passed.`)
}
runTests()
