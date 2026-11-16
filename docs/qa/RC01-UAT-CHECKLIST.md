# User Acceptance Testing Checklist (RC01)
## RYCOOP Smart Finance — Savings Cooperative Stakeholder Verification

- **Environment:** Dedicated TEST Environment (`http://127.0.0.1:8080`)
- **Target Audience:** Treasury Officers (Maker), Board of Directors (Checker), Internal Audit (Auditor)

---

### Verification Checklist

#### 1. Session & Role Management
- [x] Maker logs in via Google OIDC or Test Role Switcher.
- [x] Unauthorized email domain is rejected with clear Thai message.
- [x] Session expires after 30 minutes of inactivity.
- [x] Secure logout clears the HttpOnly session cookie.

#### 2. Maker Submission
- [x] Maker creates government bond proposal (`INV-889102`).
- [x] SweetAlert2 modal shows non-dismissible loading during database save.
- [x] Proposal status becomes `PENDING_CHECKER`.
- [x] Real-time notification appears on Checker's notification bell.

#### 3. Checker Dual-Control Review
- [x] Maker cannot approve their own proposal (Blocked with Segregation of Duties error).
- [x] Checker reviews proposal details and clicks "อนุมัติ (Step-Up)".
- [x] System prompts for WebAuthn Passkey or 6-digit Authenticator TOTP.
- [x] Challenge is bound to transaction parameters.
- [x] Replaying the same challenge fails.
- [x] Approval transitions status to `APPROVED` and records immutable audit log.

#### 4. Notification Center
- [x] Bell icon shows unread count badge.
- [x] Critical alerts trigger animated badge pulse.
- [x] Bank account numbers are masked (`xxx-x-xx56789-0`).
- [x] Clicking "รับทราบ" records acknowledgment timestamp and user identity.
- [x] Duplicate events are dropped automatically.

#### 5. Financial Dashboard & Analytics
- [x] Overdraft facility is strictly separated from cash assets.
- [x] Bond carrying value and weighted average yields calculate accurately.
- [x] Liquidity Coverage Ratio (LCR) reflects cooperative regulatory safety margins.

