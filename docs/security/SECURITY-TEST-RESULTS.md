# Automated Security Test Execution Results (RC01)
**Execution Date:** 2026-11-16  
**Test Harness:** Node.js Cryptographic Assertion Engine (`scripts/run-all-tests.js`)  
**Overall Result:** **12 / 12 PASSED (100% Success Rate)**  

---

## Detailed Test Case Output

### Suite 1: Maker-Checker Segregation & Integrity
| Test Case ID | Description | Expected Output | Actual Output | Status |
|---|---|---|---|---|
| **TC-MC01** | Maker submits valid proposal | State set to `PENDING_CHECKER`, makerId bound | State: `PENDING_CHECKER` | **PASS** |
| **TC-MC02** | Maker attempts self-approval | Exception: `Segregation of duties violation` | ForbiddenException thrown | **PASS** |
| **TC-MC03** | Checker approves with Step-Up challenge | State set to `APPROVED`, checkerId bound | State: `APPROVED` | **PASS** |
| **TC-MC04** | Double approval on approved proposal | Exception: `Proposal not in PENDING_CHECKER` | BadRequestException thrown | **PASS** |
| **TC-MC05** | Step-Up challenge replay attempt | Exception: `Replay detected: Challenge already used` | ForbiddenException thrown | **PASS** |
| **TC-MC06** | Proposal amount tampering during Step-Up | Exception: `Transaction parameter tampering detected` | ForbiddenException thrown | **PASS** |

### Suite 2: Google OIDC & Domain Validation
| Test Case ID | Description | Expected Output | Actual Output | Status |
|---|---|---|---|---|
| **TC-AUTH01** | Domain check allows `@rycoop.coop`, blocks others | Allows cooperative email, throws for `@gmail.com` | Verified strict whitelist | **PASS** |
| **TC-AUTH02** | PKCE code verifier and challenge compliance | SHA256 base64url challenge generated | RFC 7636 compliant | **PASS** |

### Suite 3: Financial Calculations & Integrity
| Test Case ID | Description | Expected Output | Actual Output | Status |
|---|---|---|---|---|
| **TC-FIN01** | Overdraft facility separated from cash assets | Available balance does NOT include OD line | Verified (฿125,820,000.5) | **PASS** |
| **TC-FIN02** | Duplicate file import rejected via SHA256 | Exception: `Duplicate file import rejected` | ConflictException thrown | **PASS** |

### Suite 4: SSE Notification Security & Sanitization
| Test Case ID | Description | Expected Output | Actual Output | Status |
|---|---|---|---|---|
| **TC-NT01** | Event deduplication drops duplicate event IDs | First event passes (true), second dropped (false) | Deduplication verified | **PASS** |
| **TC-NT02** | Sensitive financial account numbers masked | Full account replaced with `xxx-x-xx56789-0` | Masking verified | **PASS** |

