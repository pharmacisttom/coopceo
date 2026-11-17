# Automated Security & Integration Test Evidence (RC01.1)
**Execution Command:** `node scripts/run-all-tests.js`  
**Execution Timestamp:** 2026-11-16  
**Result:** **19 / 19 PASSED (100%)**  

---

```text
================================================================================
    RYCOOP Smart Finance — RC01.1 Comprehensive Security & Integration Suite    
================================================================================

--- Category 1: Google OIDC Verification & Domain Whitelisting ---
  ✓ [PASS] [TC-OIDC-01] PKCE code challenge and state conform to RFC 7636
  ✓ [PASS] [TC-OIDC-02] Enforce Google Workspace hosted domain hd=rycoop.coop and verified email

--- Category 2: Local User Allowlist & Session Security ---
  ✓ [PASS] [TC-AUTH-01] Reject valid Google identities not enrolled in local cooperative allowlist
  ✓ [PASS] [TC-AUTH-02] Server-side session expiration enforces 30m idle and 8h absolute timeouts

--- Category 3: WebAuthn Passkey Cryptographic Verification ---
  ✓ [PASS] [TC-PASSKEY-01] Transaction-bound challenge incorporates proposal ID, amount, and Checker ID
  ✓ [PASS] [TC-PASSKEY-02] WebAuthn assertion verifies mandatory User Verification flag bit

--- Category 4: Real RFC 6238 TOTP & Single-Use Replay Prevention ---
  ✓ [PASS] [TC-TOTP-01] Generate and verify valid RFC 6238 TOTP code using Base32 secret
  ✓ [PASS] [TC-TOTP-02] Prevent reuse of valid TOTP code within same time-step (Anti-Replay)

--- Category 5: MFA Rate Limiting (5 Attempts -> 15-Minute Lock) ---
  ✓ [PASS] [TC-MFA-01] Enforce 15-minute account lock after 5 consecutive failed MFA attempts

--- Category 6: PostgreSQL Maker-Checker Segregation & Row Locking ---
  ✓ [PASS] [TC-PG-01] Segregation of duties: Maker cannot approve their own proposal in PostgreSQL
  ✓ [PASS] [TC-PG-02] Checker successfully approves with row lock and commits audit & outbox atomically
  ✓ [PASS] [TC-PG-03] Double approval on already approved proposal is rejected
  ✓ [PASS] [TC-PG-04] Database transaction rollback: Error during approval reverts proposal, audit, and outbox

--- Category 7: SSE Role/User Isolation & Sensitive Data Masking ---
  ✓ [PASS] [TC-SSE-01] Default-Deny filters notifications strictly by user role and target user ID
  ✓ [PASS] [TC-SSE-02] Comprehensive financial account masking across title, message, and metadata JSON

--- Category 8: Financial Calculation Determinism & File Integrity ---
  ✓ [PASS] [TC-FIN-01] Overdraft facility is strictly separated from cash assets in treasury balance
  ✓ [PASS] [TC-FIN-02] Financial file import detects and rejects duplicate uploads via SHA256 checksum

--- Category 9: Docker & Infrastructure Isolation Audit ---
  ✓ [PASS] [TC-DOCKER-01] Docker compose binds TEST Nginx strictly to 127.0.0.1 (No port 80/443 conflict)
  ✓ [PASS] [TC-DOCKER-02] Secret scanning: Verify no plaintext passwords or secrets committed in git repository

================================================================================
    EXECUTION COMPLETE: 19 / 19 Passed (100% SUCCESS RATE)
================================================================================
```
