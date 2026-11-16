# Comprehensive Quality Assurance Test Matrix (RC01)
## RYCOOP Smart Finance — Savings Cooperative Governance

| Module | Test Level | Target Specification | Automation Tool | Coverage Goal |
|---|---|---|---|---|
| **Maker-Checker** | Unit / Concurrency | Segregation of duties, Row-level lock, OCC versioning | Node.js Test Engine | 100% Core Logic |
| **Authentication** | Integration | Google OIDC, PKCE, Domain check, Session cookies | Node.js Test Engine | 100% Auth Guards |
| **Step-Up MFA** | Security / Unit | Transaction-bound challenge, Replay prevention | Node.js Cryptography | 100% Verification |
| **Real-time SSE** | Integration | Default Deny filtering, Deduplication, Reconnect | Node.js / Playwright | 100% SSE Handlers |
| **Treasury & Bonds** | Unit | Deterministic LCR, Overdraft exclusion, Yields | Financial Service Tests | 100% Formulas |
| **File Import** | Unit | SHA256 checksum duplicate rejection, Type check | Crypto Hash Engine | 100% Import Handlers |
| **UI SweetAlert2** | E2E | Non-dismissible loading, Navy/Cyan/Gold theme, ARIA | Playwright | 100% Critical Modals |
| **Infrastructure** | DevOps Audit | Port isolation (8080/8443), Non-root, Healthchecks | Bash pre-flight script | 100% Containers |

