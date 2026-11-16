# Security Patch & Remediation Report (RC01)
## RYCOOP Smart Finance — Technical Code Changes

---

### 1. Patch 01: Maker-Checker Dual-Control Hardening
- **Files Modified:**
  - `backend/src/modules/investment/investment.controller.ts`
  - `backend/src/modules/investment/investment.service.ts`
  - `frontend/src/components/investment/MakerCheckerModal.tsx`
  - `frontend/src/components/investment/InvestmentApprovalTable.tsx`
- **Technical Description:**
  - Client-supplied `makerUserId` and `checkerUserId` parameters were completely eliminated from all endpoint payloads.
  - Endpoints were guarded using `@UseGuards(SessionAuthGuard, RolesGuard)` with `@Roles('MAKER')` on submission and `@Roles('CHECKER')` on approval.
  - The Maker and Checker identities are derived strictly on the server from `req.user`.
  - Added strict check: `if (proposal.makerId === checkerUser.id) throw new ForbiddenException(...)`.
  - Added row-level lock (`activeLocks.has(referenceId)`) to serialize concurrent approval attempts.

---

### 2. Patch 02: Transaction-Bound Step-Up MFA & Replay Protection
- **Files Modified:**
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/auth/auth.controller.ts`
  - `frontend/src/hooks/useAuth.ts`
- **Technical Description:**
  - Replaced the placeholder 6-character length check with cryptographic challenge generation bound to proposal ID, amount, and Checker ID.
  - Verification validates challenge ID, expiration (120 seconds), target reference ID, and expected amount.
  - Single-use challenge invalidation: challenge is deleted immediately upon verification to prevent replay attacks.
  - Implemented 5-attempt rate-limiting lockout (15 minutes).

---

### 3. Patch 03: SSE Stream & Notification Center Security
- **Files Modified:**
  - `backend/src/modules/notifications/notifications.controller.ts`
  - `backend/src/modules/notifications/notifications.service.ts`
  - `frontend/src/hooks/useSSE.ts`
- **Technical Description:**
  - Applied `SessionAuthGuard` to `GET /api/v1/notifications/stream`.
  - Removed bearer token passing in URL query parameters.
  - Eliminated the fallback `userRole = 'CHECKER'`. Only verified session roles are authorized.
  - Applied `x-internal-service-key` header verification to `POST /api/v1/notifications/emit`.
  - Added automatic bank account number masking (`xxx-x-xx56789-0`).

---

### 4. Patch 04: Zero Production Interference on VPS
- **Files Modified:**
  - `docker/docker-compose.yml`
  - `docker/nginx/nginx.conf`
  - `scripts/vps-check.sh`
- **Technical Description:**
  - Changed container port bindings from host `80:80` and `443:443` to `127.0.0.1:8080:80` and `127.0.0.1:8443:443`.
  - Ensured host ports 80 and 443 are untouched, leaving existing live Production Nginx intact.
  - Added `security_opt: [ "no-new-privileges:true" ]` across all containers.

