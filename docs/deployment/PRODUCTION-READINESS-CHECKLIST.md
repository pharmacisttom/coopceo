# Production Readiness Hardening Checklist (RC01.1 Gate)
## RYCOOP Smart Finance — Enterprise Production Gate

> **GOVERNANCE NOTICE:** No production deployment is permitted until 100% of the checklist items below are certified and approved by the Cooperative Board of Directors and the Head of Information Security.

---

### Phase 1: Security & Identity Gate (RC01.1 Remediated)
- [x] All investment endpoints derive Maker/Checker identities strictly from server-side sessions.
- [x] Client-supplied user identifiers are completely removed from controller signatures.
- [x] Maker is strictly prohibited from approving their own investment proposals (`maker_id != checker_id`).
- [x] Step-Up MFA requires cryptographically bound, single-use challenges stored in Redis with 120s TTL.
- [x] Replay of previous Step-Up assertions is rejected via atomic `getDel` consumption.
- [x] Rate limiting locks user accounts after 5 failed MFA attempts for 15 minutes.
- [x] Google Login enforces exact `@rycoop.coop` domain allowlist and verifies ID token signatures.
- [x] The insecure `/api/v1/auth/test-login` mock endpoint has been completely eliminated from codebase.
- [x] **BLOCKER NOTICE:** Cooperative IT must formally confirm Google Workspace ownership and delegation of `@rycoop.coop` before live OAuth production activation.
- [x] Sessions use `HttpOnly; SameSite=Strict; Secure` cookies with 30-minute idle and 8-hour absolute timeouts.

---

### Phase 2: Real-time SSE & Notification Gate (RC01.1 Remediated)
- [x] SSE endpoint requires authentication and enforces Default-Deny role filtering.
- [x] Token passing via URL query strings is eliminated.
- [x] Event deduplication prevents duplicate alert triggers.
- [x] Automated bank account number masking is active across title, message, and metadata JSON (`xxx-x-xx56789-0`).
- [x] Notification acknowledgment updates database and records immutable audit log.
- [x] Predictable fallback internal secret removed; system fails closed if secret is under 32 characters.
- [x] Notification dispatch is decoupled via Transactional Outbox; failures do not disrupt transactions.

---

### Phase 3: Infrastructure & Production Isolation Gate (RC01.1 Remediated)
- [x] Host ports 80 and 443 are untouched; TEST Nginx binds safely to `127.0.0.1:8080/8443`.
- [x] Separate Docker Compose project name: `rycoop-smart-finance-test`.
- [x] Network segmentation: `ingress_net`, `app_net`, `data_net` (`internal: true`).
- [x] Database and cache ports are NOT published to host network.
- [x] Containers have explicit CPU and Memory resource limits.
- [x] Containers enforce `no-new-privileges: true` and health checks.
- [x] Automated daily backup and restore drill scripts tested and verified.

---

### Phase 4: Financial Calculation Integrity Gate (RC01.1 Remediated)
- [x] Overdraft facility is strictly separated from cash assets.
- [x] Missing financial sources are marked as `PENDING_DATA` instead of zero defaults.
- [x] File import enforces SHA256 duplicate rejection and supported file formats (PDF, XLSX, CSV).
