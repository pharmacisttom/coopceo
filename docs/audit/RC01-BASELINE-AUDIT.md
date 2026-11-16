# RC01 Baseline Security & Architecture Audit Report
**Project:** RYCOOP Smart Finance & Investment Governance Platform (COOPCEO)  
**Repository:** `https://github.com/pharmacisttom/coopceo.git`  
**Baseline Commit SHA:** `60049945347cd5421d1b920afa2dd719fe5e0800`  
**Audit Date:** 2026-11-16  
**Auditor:** Team of Principal Full-Stack Architect & Senior Cybersecurity Engineers  
**Target Environment:** TEST Environment Only  

---

## 1. Executive Summary

This audit establishes an evidence-based baseline of the initial codebase for RYCOOP Smart Finance. While the initial scaffolding defined high-level concepts (SweetAlert2 theme, Next.js frontend, NestJS backend stubs, PostgreSQL schema, Docker compose, and docs), the deep code inspection identified **Critical vulnerabilities** that would allow complete authorization bypass, impersonation, unverified financial approvals, and host port conflicts with existing Production systems.

All identified vulnerabilities are classified according to OWASP Top 10 API Security Risks (2023) and CVSS v3.1 standards.

---

## 2. File Inventory & Implementation Status

| Component | Path | Status | Finding Summary |
|---|---|---|---|
| **Investment Controller** | `backend/src/modules/investment/investment.controller.ts` | Incomplete / Vulnerable | No AuthGuard, client-supplied user IDs, no session context. |
| **Investment Service** | `backend/src/modules/investment/investment.service.ts` | Incomplete / Vulnerable | In-memory `Map` storage, dummy Step-up token length check, race conditions. |
| **Notification Controller** | `backend/src/modules/notifications/notifications.controller.ts` | Incomplete / Vulnerable | Unauthenticated SSE defaults to `CHECKER` role, query-param token leak, unauthenticated public `/emit` endpoint. |
| **Notification Service** | `backend/src/modules/notifications/notifications.service.ts` | Partially Implemented | In-memory cache, lacks persistent outbox integration. |
| **Audit Service** | `backend/src/modules/audit/audit.service.ts` | Stub / Logging only | Logs to logger console; does not execute transactional DB inserts. |
| **Authentication Module** | `backend/src/modules/auth/` | Missing Implementation | No Google OIDC strategy, no WebAuthn/Passkey registration/verification. |
| **Database Schemas** | `database/migrations/init_schema.sql` | Defined | PostgreSQL tables defined, but not wired into NestJS repository transactions. |
| **Docker Compose** | `docker/docker-compose.yml` | Dangerous Configuration | Binds host ports `80:80` and `443:443` conflicting directly with live VPS Production Nginx. |
| **Nginx Config** | `docker/nginx/nginx.conf` | Functional Stub | Good SSE directives, but uses mock certs and generic CSP. |
| **Frontend Alert Service** | `frontend/src/components/alert/alert.service.ts` | Implemented | SweetAlert2 wrapper with Thai defaults and non-dismissible loading. |
| **Frontend SSE Hook** | `frontend/src/hooks/useSSE.ts` | Incomplete | Uses token in query parameter, unbounded reconnect on 401/403. |
| **Analytics Worker** | `analytics-worker/app/main.py` | Implemented Stub | FastAPI liquidity & bond evaluation, emits to backend `/emit`. |

---

## 3. Confirmed Vulnerability Register

### VULN-01: Client-Controlled Maker and Checker Identity (BOLA / Broken Object Level Authorization)
- **Status:** `CONFIRMED`
- **Severity:** `CRITICAL` (CVSS 9.8 - AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
- **File:** [`backend/src/modules/investment/investment.controller.ts#L11-L24`](file:///D:/ceocoop/backend/src/modules/investment/investment.controller.ts#L11-L24), [`backend/src/modules/investment/investment.service.ts#L43-L126`](file:///D:/ceocoop/backend/src/modules/investment/investment.service.ts#L43-L126)
- **Description:** 
  The endpoints `POST /api/v1/investments/maker-submit` and `POST /api/v1/investments/:referenceId/checker-approve` accept `makerUserId` and `checkerUserId` directly inside the request JSON body. The controller does not extract user identity from an authenticated session (`req.user`).
- **Reproduction / Proof of Concept:**
  An attacker can craft an HTTP request:
  ```json
  POST /api/v1/investments/maker-submit
  {
    "referenceId": "INV-P01",
    "amount": 50000000,
    "investmentType": "BOND",
    "issuerName": "Corp",
    "makerUserId": "victim-maker-01"
  }
  ```
  Followed by:
  ```json
  POST /api/v1/investments/INV-P01/checker-approve
  {
    "checkerUserId": "victim-director-checker",
    "stepUpToken": "123456"
  }
  ```
  Because the backend compares `proposal.makerId === dto.checkerUserId`, the attacker easily supplies two different arbitrary user IDs and completely bypasses the Maker-Checker segregation of duties.

---

### VULN-02: Pseudo-Step-Up MFA Validation (Security Misconfiguration & Cryptographic Absence)
- **Status:** `CONFIRMED`
- **Severity:** `CRITICAL` (CVSS 9.1 - AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H)
- **File:** [`backend/src/modules/investment/investment.service.ts#L102-L104`](file:///D:/ceocoop/backend/src/modules/investment/investment.service.ts#L102-L104)
- **Description:**
  Step-Up verification was checked solely via:
  ```typescript
  if (!dto.stepUpToken || dto.stepUpToken.length < 6) {
    throw new ForbiddenException('จำเป็นต้องยืนยันตัวตนระดับสูง (Step-Up 2FA) ก่อนอนุมัติรายการ');
  }
  ```
  Any arbitrary 6-character string (e.g. `"000000"` or `"abcdef"`) satisfies this condition. No TOTP algorithm, no WebAuthn assertion signature validation, no challenge-response verification, and no replay protection exists.

---

### VULN-03: In-Memory State & Race Condition in Concurrent Approvals
- **Status:** `CONFIRMED`
- **Severity:** `HIGH` (CVSS 8.1 - AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N)
- **File:** [`backend/src/modules/investment/investment.service.ts#L29`](file:///D:/ceocoop/backend/src/modules/investment/investment.service.ts#L29)
- **Description:**
  Proposals are stored in a JavaScript `Map<string, any>()`. If multiple instances run or if two concurrent requests hit `checkerApprove()` simultaneously, both requests can pass the state check before the first one completes, leading to double-approvals and uncoordinated financial record state. No database transaction or `SELECT ... FOR UPDATE` row lock is implemented.

---

### VULN-04: Unauthenticated SSE Stream & Privileged Role Escalation by Default
- **Status:** `CONFIRMED`
- **Severity:** `CRITICAL` (CVSS 9.3 - AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N)
- **File:** [`backend/src/modules/notifications/notifications.controller.ts#L22-L28`](file:///D:/ceocoop/backend/src/modules/notifications/notifications.controller.ts#L22-L28)
- **Description:**
  The SSE endpoint `GET /api/v1/notifications/stream` defaults an unauthenticated user to the privileged role `'CHECKER'`:
  ```typescript
  const userRole = req?.user?.role || 'CHECKER';
  ```
  Any anonymous internet client connecting to this SSE endpoint immediately receives confidential financial alerts intended for Cooperative Directors and Checkers.

---

### VULN-05: Unauthenticated Public Notification Injection Endpoint
- **Status:** `CONFIRMED`
- **Severity:** `HIGH` (CVSS 8.2 - AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:L)
- **File:** [`backend/src/modules/notifications/notifications.controller.ts#L69-L75`](file:///D:/ceocoop/backend/src/modules/notifications/notifications.controller.ts#L69-L75)
- **Description:**
  `POST /api/v1/notifications/emit` has no guard, no authentication, and no network binding limitation. Anyone can POST synthetic or malicious notifications to all connected clients.

---

### VULN-06: Dangerous Host Port Conflict on Cooperative VPS
- **Status:** `CONFIRMED`
- **Severity:** `CRITICAL (Operational / Availability)`
- **File:** [`docker/docker-compose.yml#L10-L13`](file:///D:/ceocoop/docker/docker-compose.yml#L10-L13)
- **Description:**
  The cooperative VPS is currently hosting the live RYCOOPWEB production on host ports 80 and 443 with MySQL. `docker/docker-compose.yml` binds `80:80` and `443:443`. If started, this would fail to bind due to port collision or could crash the existing production web server if Nginx was restarted.

---

### VULN-07: Missing Google OIDC & WebAuthn Libraries and Handlers
- **Status:** `CONFIRMED`
- **Severity:** `HIGH` (Incomplete Specification Implementation)
- **Description:**
  `backend/package.json` contains no OAuth2/OIDC libraries or WebAuthn libraries (`@simplewebauthn/server`). Authentication guards were conceptual only.

---

## 4. Proposed Patch Plan & Milestones

1. **Milestone 1 — Maker-Checker Core Security Patch (Phase 1):**
   - Implement true PostgreSQL transaction with row-level lock (`SELECT ... FOR UPDATE`).
   - Eliminate client-provided user IDs. Require validated session user from `req.user`.
   - Implement atomic outbox insertion inside the same database transaction.
   - Enforce Maker != Checker segregation of duties.

2. **Milestone 2 — Google OIDC Authentication Engine (Phase 2):**
   - Add OAuth2 Authorization Code flow with PKCE, state/nonce validation, and Google ID token validation.
   - Enforce exact email domain validation (`@rycoop.coop`).
   - Issue server-managed, HttpOnly, SameSite=Strict session cookies.

3. **Milestone 3 — WebAuthn / Passkey & Real TOTP Engine (Phase 3):**
   - Integrate `@simplewebauthn/server` and `@simplewebauthn/browser`.
   - Transaction-bound challenges: Challenge is cryptographically bound to `proposalId`, `amount`, `issuer`, and `checkerId`.
   - Integrate real TOTP (`otplib`) with replay protection and rate limiting.

4. **Milestone 4 — SSE Security & Data Isolation (Phase 4):**
   - Guard `/api/v1/notifications/stream` with SessionAuthGuard.
   - Remove query-parameter token leaks. Default-Deny policy.
   - Protect `/api/v1/notifications/emit` so only internal backend workers can dispatch.

5. **Milestone 5 — Docker & Nginx Hardening (Phase 5):**
   - Change test ports from host `80:80` and `443:443` to dedicated test ports `8080:80` and `8443:443`.
   - Enforce non-root users, drop capabilities, set `no-new-privileges: true`.

6. **Milestone 6 — Automated Testing & Evidence Generation (Phase 8):**
   - Run typecheck, unit tests, integration tests, concurrency tests, and MFA replay tests.

---
*Report certified by Principal Architect & Lead Security Engineer.*

