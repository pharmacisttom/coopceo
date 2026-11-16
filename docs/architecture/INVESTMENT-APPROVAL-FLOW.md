# Maker–Checker Investment Approval Workflow
## Dual-Control Governance & Transaction-Bound Step-Up MFA

---

## 1. Sequence Diagram: Dual-Control Approval Flow

```mermaid
sequenceDiagram
    autonumber
    actor Maker as Maker (Finance Officer)
    actor Checker as Checker (Coop Director)
    participant UI as Next.js Web UI
    participant Backend as NestJS Investment Engine
    participant DB as PostgreSQL (ACID Transaction)
    participant Notif as SSE Outbox

    Note over Maker,DB: Step 1: Proposal Submission (Maker)
    Maker->>UI: Fills Investment Form (Bond, ฿15,000,000)
    Maker->>UI: Clicks "Submit for Approval"
    UI->>UI: Displays Non-Dismissible SweetAlert2 Loading
    UI->>Backend: POST /api/v1/investments/maker-submit { details }
    Note right of Backend: Extracts makerId strictly from Session Context
    Backend->>DB: INSERT INTO investment_proposals (status='PENDING_CHECKER')
    Backend->>DB: INSERT INTO audit_logs (action='MAKER_SUBMIT')
    Backend->>Notif: Publish INVESTMENT_PENDING_APPROVAL to Checkers
    Backend-->>UI: Proposal Created (INV-889102)
    UI-->>Maker: Displays Success Modal

    Note over Checker,DB: Step 2: Review & Step-Up MFA (Checker)
    Notif-->>Checker: Real-Time SSE Alert received on Bell Icon
    Checker->>UI: Reviews proposal details
    Checker->>UI: Clicks "Approve (Step-Up)"
    UI->>Backend: POST /api/v1/auth/stepup/challenge { refId, amount }
    Backend->>Backend: Generate Challenge bound to (refId, amount, checkerId)
    Backend-->>UI: Returns Challenge & Timeout
    UI->>Checker: Prompts WebAuthn Passkey (or TOTP 6-digit PIN)
    Checker->>UI: Taps Security Key / Biometric Passkey
    UI->>Backend: POST /api/v1/investments/:refId/checker-approve { challengeId, assertion }
    
    Note right of Backend: Transaction Begin (SELECT ... FOR UPDATE)
    Backend->>DB: Acquire Row Lock on Proposal
    Backend->>Backend: Verify makerId != checkerId (Segregation of Duties)
    Backend->>Backend: Verify Step-Up Assertion matches bound parameters
    Backend->>Backend: Invalidate challenge (Replay Protection)
    Backend->>DB: UPDATE investment_proposals SET status='APPROVED'
    Backend->>DB: INSERT INTO audit_logs (action='CHECKER_APPROVE')
    Backend->>DB: INSERT INTO outbox_events (event='INV_APPROVED')
    Backend->>DB: COMMIT Transaction
    Note right of Backend: Transaction Committed Atomically
    
    Backend-->>UI: Approval Completed
    UI-->>Checker: Displays Approved Confirmation Modal
```

---

## 2. Mathematical Integrity & Accounting Separation Rules

1. **No Overdraft as Cash:** Overdraft facility is recorded as contingent credit lines, never as cooperative cash or liquid reserves.
2. **Deterministic Calculations:** Bond carrying value, accrued interest, and weighted average yields are calculated using deterministic standard formulas with exact rounding rules.
3. **No Zero Defaults for Missing Data:** Sources that have not yet transmitted balances are marked as `PENDING_DATA` rather than assumed to be zero.
