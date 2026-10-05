| Route File | Method(s) | Auth Check | Role Check | Ownership/Params | Strict Zod |
|---|---|---|---|---|---|
| src/app/api/agent/applications/route.ts | POST | Agent | Agent | Org Scoped / Candidate Scoped | Yes |
| src/app/api/agent/candidates/[id]/route.ts | GET | Agent | Agent | Org Scoped / Candidate Scoped | N/A |
| src/app/api/agent/candidates/route.ts | GET | Agent | Agent | Org Scoped | N/A |
| src/app/api/agent/cash-collections/route.ts | GET,POST | Agent | Agent | Org Scoped / Candidate Scoped | Yes |
| src/app/api/agent/dashboard/route.ts | GET | Agent | Agent | N/A | N/A |
| src/app/api/agent/escalations/[id]/route.ts | PATCH | Agent | Agent | N/A | Yes |
| src/app/api/agent/escalations/route.ts | GET,POST | Agent | Agent | Org Scoped / Candidate Scoped | Yes |
| src/app/api/agent/follow-ups/route.ts | GET,POST | Agent | Agent | Org Scoped / Candidate Scoped | Yes |
| src/app/api/agent/performance/route.ts | GET | Agent | Agent | N/A | N/A |
| src/app/api/agent/ptp/[id]/break/route.ts | POST | Agent | Agent | N/A | N/A |
| src/app/api/agent/ptp/[id]/fulfill/route.ts | POST | Agent | Agent | N/A | N/A |
| src/app/api/agent/ptp/route.ts | GET,POST | Agent | Agent | Org Scoped / Candidate Scoped | Yes |
| src/app/api/agent/qr-links/route.ts | GET,POST | Agent | Agent | Org Scoped | Yes |
| src/app/api/agent/tasks/[id]/complete/route.ts | POST | Agent | Agent | Org Scoped | Yes |
| src/app/api/agent/tasks/route.ts | GET,POST | Agent | Agent | Org Scoped / Candidate Scoped | Yes |
| src/app/api/apply/[token]/route.ts | GET,POST | None | N/A | Org Scoped / Candidate Scoped | No |
| src/app/api/auth/candidate-login/route.ts | POST | None | N/A | Org Scoped / Candidate Scoped | N/A |
| src/app/api/auth/forgot-password/route.ts | POST | None | N/A | N/A | N/A |
| src/app/api/auth/login/route.ts | POST | None | N/A | Org Scoped / Candidate Scoped | N/A |
| src/app/api/auth/logout/route.ts | POST | Session | N/A | N/A | N/A |
| src/app/api/auth/me/route.ts | GET | Session | N/A | N/A | N/A |
| src/app/api/auth/reset-password/route.ts | POST | None | N/A | N/A | N/A |
| src/app/api/auth/signup/route.ts | POST | None | N/A | Org Scoped / Candidate Scoped | Yes |
| src/app/api/auth/totp/route.ts | GET,POST | Owner | Owner | N/A | N/A |
| src/app/api/candidate/application/submit/route.ts | POST | Candidate | Candidate | Org Scoped / Candidate Scoped | Yes |
| src/app/api/candidate/data-requests/route.ts | GET,POST | Candidate | Candidate | Org Scoped / Candidate Scoped | Yes |
| src/app/api/candidate/installments/route.ts | GET | Candidate | Candidate | N/A / Candidate Scoped | N/A |
| src/app/api/candidate/loan/route.ts | GET | Candidate | Candidate | N/A / Candidate Scoped | N/A |
| src/app/api/candidate/loans/route.ts | GET | Candidate | Candidate | N/A / Candidate Scoped | N/A |
| src/app/api/candidate/notifications/route.ts | GET,POST | Candidate | Candidate | Org Scoped / Candidate Scoped | Yes |
| src/app/api/candidate/payments/route.ts | GET,POST | Candidate | Candidate | Org Scoped / Candidate Scoped | Yes |
| src/app/api/candidate/profile/route.ts | GET,PATCH | Candidate | Candidate | Org Scoped / Candidate Scoped | Yes |
| src/app/api/candidate/receipts/route.ts | GET | Candidate | Candidate | N/A / Candidate Scoped | N/A |
| src/app/api/candidate/schedule/route.ts | GET | Candidate | Candidate | N/A / Candidate Scoped | N/A |
| src/app/api/candidate/support/route.ts | GET,POST | Candidate | Candidate | Org Scoped / Candidate Scoped | Yes |
| src/app/api/consents/route.ts | GET,POST | Session | N/A | Org Scoped / Candidate Scoped | Yes |
| src/app/api/files/[fileKey]/route.ts |  | Session | N/A | Org Scoped | N/A |
| src/app/api/health/route.ts |  | None | N/A | N/A | N/A |
| src/app/api/notifications/[id]/read/route.ts | POST,PATCH | Session | N/A | N/A | N/A |
| src/app/api/notifications/route.ts | GET,POST | Session | N/A | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/agents/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/agreements/[id]/route.ts | PATCH | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/agreements/route.ts | GET,POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/ai-insights/route.ts | GET | Owner | Owner | Org Scoped / Candidate Scoped | N/A |
| src/app/api/owner/analytics/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/applications/[id]/approve/route.ts | POST | Owner | Owner | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/applications/[id]/reject/route.ts | POST | Owner | Owner | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/applications/[id]/request-info/route.ts | POST | Owner | Owner | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/applications/[id]/route.ts | GET,DELETE | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/applications/route.ts | GET,POST | Owner | Owner | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/audit/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/candidates/[id]/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/candidates/route.ts | GET,POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/cash-collections/[id]/verify/route.ts | POST | Owner | Owner | Org Scoped / Candidate Scoped | No |
| src/app/api/owner/cash-collections/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/corrections/[id]/approve/route.ts | POST | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/corrections/route.ts | GET,POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/dashboard/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/data-requests/route.ts | GET,POST | Owner | Owner | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/disbursements/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/escalations/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/ledger/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/loans/[id]/disburse/route.ts | POST | Owner | Owner | Org Scoped / Candidate Scoped | N/A |
| src/app/api/owner/loans/[id]/restructure/route.ts | POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/loans/[id]/route.ts | GET | Owner | Owner | Org Scoped / Candidate Scoped | N/A |
| src/app/api/owner/loans/route.ts | GET | Owner | Owner | Org Scoped / Candidate Scoped | Yes |
| src/app/api/owner/payments/route.ts | GET | Owner | Owner | Org Scoped / Candidate Scoped | N/A |
| src/app/api/owner/pii/reveal/route.ts | POST | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/qr-links/[id]/regenerate/route.ts | POST | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/qr-links/[id]/revoke/route.ts | POST | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/qr-links/route.ts | GET,POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/reconciliation/exceptions/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/reconciliation/run/route.ts | POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/reconciliation/runs/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/owner/refunds/[id]/complete/route.ts | POST | Owner | Owner | Org Scoped / Candidate Scoped | N/A |
| src/app/api/owner/refunds/route.ts | GET,POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/reports/route.ts | GET | Owner | Owner | Org Scoped / Candidate Scoped | N/A |
| src/app/api/owner/support/[id]/resolve/route.ts | POST | Owner | Owner | Org Scoped | Yes |
| src/app/api/owner/support/route.ts | GET | Owner | Owner | Org Scoped | N/A |
| src/app/api/receipts/[id]/route.ts | GET | Session | N/A | Org Scoped | N/A |
| src/app/api/route.ts |  | None | N/A | N/A | N/A |
| src/app/api/webhooks/payment-mock/route.ts | GET,POST | None | N/A | Org Scoped | N/A |
| src/app/api/webhooks/payment/route.ts | POST | None | N/A | Org Scoped / Candidate Scoped | Yes |
