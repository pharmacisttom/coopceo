# Production Readiness Hardening Checklist (Gate 01)
## RYCOOP Smart Finance — Enterprise Production Gate

> **GOVERNANCE NOTICE:** No production deployment is permitted until 100% of the checklist items below are certified and approved by the Cooperative Board of Directors and the Head of Information Security.

---

### Phase 1: Security & Identity Gate
- [x] All investment endpoints derive Maker/Checker identities strictly from server-side sessions.
- [x] Client-supplied user identifiers are completely removed from controller signatures.
- [x] Maker is strictly prohibited from approving their own investment proposals (`makerId != checkerId`).
- [x] Step-Up MFA requires cryptographically bound, single-use challenges.
- [x] Replay of previous Step-Up assertions is rejected.
- [x] Rate limiting locks user accounts after 5 failed MFA attempts.
- [x] Google Login enforces exact `@rycoop.coop` domain allowlist.
- [x] **BLOCKER NOTICE:** Cooperative IT must formally confirm Google Workspace ownership and delegation of `@rycoop.coop`.
- [x] Sessions use `HttpOnly; SameSite=Strict; Secure` cookies with 30-minute idle and 8-hour absolute timeouts.

---

### Phase 2: Real-time SSE & Notification Gate
- [x] SSE endpoint requires authentication and enforces Default-Deny role filtering.
- [x] Token passing via URL query strings is eliminated.
- [x] Event deduplication prevents duplicate alert triggers.
- [x] Automated bank account number masking is active (`xxx-x-xx56789-0`).
- [x] Notification acknowledgment updates database and records immutable audit log.
- [x] Notification dispatch is decoupled via Transactional Outbox; failures do not disrupt transactions.

---

### Phase 3: Infrastructure & Production Isolation Gate
- [x] Host ports 80 and 443 are untouched; TEST Nginx binds safely to `127.0.0.1:8080/8443`.
- [x] Separate Docker Compose project name: `rycoop-smart-finance-test`.
- [x] Database ports are NOT published to host network.
- [x] Containers have explicit CPU and Memory resource limits.
- [x] Containers enforce `no-new-privileges: true` and health checks.
- [x] Automated daily backup and restore drill scripts tested and verified.

---

### Phase 4: Financial Calculation Integrity Gate
- [x] Overdraft facility is strictly separated from cash assets.
- [x] Missing financial sources are marked as `PENDING_DATA` instead of zero defaults.
- [x] File import enforces SHA256 duplicate rejection and supported file formats (PDF, XLSX, CSV).

