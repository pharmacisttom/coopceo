# Database Architecture & Migration Specification
## PostgreSQL 16 Schema for Savings Cooperative Governance

---

## 1. Entity Relationship Overview

```mermaid
erDiagram
    ROLES ||--o{ USERS : assigns
    USERS ||--o{ INVESTMENT_PROPOSALS : creates_as_maker
    USERS ||--o{ INVESTMENT_PROPOSALS : approves_as_checker
    USERS ||--o{ NOTIFICATIONS : targets
    USERS ||--o{ AUDIT_LOGS : records
    INVESTMENT_PROPOSALS ||--o{ AUDIT_LOGS : references
    INVESTMENT_PROPOSALS ||--o{ OUTBOX_EVENTS : triggers

    ROLES {
        int id PK
        enum name "ADMIN, MAKER, CHECKER, AUDITOR, EXECUTIVE"
        string description
    }

    USERS {
        uuid id PK
        string email UK
        string full_name
        int role_id FK
        boolean is_active
        string google_sub
        text webauthn_credential_id
        text webauthn_public_key
    }

    INVESTMENT_PROPOSALS {
        uuid id PK
        string reference_id UK
        string investment_type
        numeric amount "18, 2"
        numeric expected_yield "5, 2"
        int tenor_months
        enum status "PENDING_CHECKER, APPROVED, REJECTED"
        uuid maker_id FK
        uuid checker_id FK
        boolean checker_stepup_verified
        int version "Optimistic Concurrency Lock"
    }

    NOTIFICATIONS {
        uuid id PK
        string event_id UK "Deduplication Key"
        enum category "NEW_BANK_DATA, BOND_MATURITY, LOW_LIQUIDITY, INVESTMENT_PENDING_APPROVAL"
        enum priority "INFORMATION, WARNING, CRITICAL"
        enum status "UNREAD, READ, ACKNOWLEDGED"
        string title
        text message
        uuid target_user_id FK
        uuid acknowledged_by FK
        timestamp acknowledged_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string action
        string entity_name
        string entity_id
        jsonb old_state
        jsonb new_state
        string ip_address
        timestamp created_at
    }

    OUTBOX_EVENTS {
        uuid id PK
        string aggregate_type
        string aggregate_id
        string event_type
        jsonb payload
        enum status "PENDING, PROCESSED, FAILED"
        int retry_count
        timestamp created_at
    }
```

---

## 2. Integrity Constraints & Concurrency Controls

1. **Row-Level Lock:** Approvals lock the target row via `SELECT ... FOR UPDATE` ensuring single-threaded resolution per investment record.
2. **Segregation of Duties Constraint:**
   ```sql
   CONSTRAINT chk_maker_checker_segregation CHECK (maker_id != checker_id OR checker_id IS NULL)
   ```
3. **Event Deduplication Constraint:**
   `event_id` in `notifications` is constrained by a `UNIQUE` index.
4. **Optimistic Versioning:**
   The `version` integer in `investment_proposals` is incremented on every state transition to detect concurrent writes.
