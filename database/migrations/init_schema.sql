-- ============================================================================
-- RYCOOP Smart Finance — Enterprise Database Initialization & Schema
-- PostgreSQL Version 15+
-- Features: RBAC, Notifications Outbox, Audit Trail, Maker-Checker Dual Control
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ROLES & PERMISSIONS
CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'MAKER', 'CHECKER', 'AUDITOR', 'EXECUTIVE');

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name user_role_enum NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
('ADMIN', 'ผู้ดูแลระบบระบบสารสนเทศสหกรณ์'),
('MAKER', 'เจ้าหน้าที่สร้างคำขอธุรกรรมการเงินและการลงทุน'),
('CHECKER', 'ผู้ตรวจสอบและอนุมัติการลงทุน (ต้องมี 2FA Step-up)'),
('AUDITOR', 'ผู้ตรวจสอบกิจการ / สหกรณ์ภายนอก (Read-only Audit)'),
('EXECUTIVE', 'คณะกรรมการ / ผู้บริหารสหกรณ์')
ON CONFLICT (name) DO NOTHING;

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role_id INT NOT NULL REFERENCES roles(id),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    google_sub VARCHAR(255) UNIQUE, -- Google OpenID Connect subject
    totp_secret TEXT,               -- Encrypted TOTP 2FA secret
    webauthn_credential_id TEXT,    -- WebAuthn / Passkey credential ID
    webauthn_public_key TEXT,       -- WebAuthn public key
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- 3. NOTIFICATIONS TABLE (Rule 3, 4, 6: PostgreSQL History, Priority, Roles)
CREATE TYPE notification_priority_enum AS ENUM ('INFORMATION', 'WARNING', 'CRITICAL');
CREATE TYPE notification_status_enum AS ENUM ('UNREAD', 'READ', 'ACKNOWLEDGED');
CREATE TYPE notification_category_enum AS ENUM (
    'NEW_BANK_DATA',
    'BOND_MATURITY',
    'LOW_LIQUIDITY',
    'INVESTMENT_PENDING_APPROVAL',
    'SYSTEM'
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) NOT NULL UNIQUE, -- Deduplication Key (Rule 2 SSE)
    category notification_category_enum NOT NULL,
    priority notification_priority_enum NOT NULL DEFAULT 'INFORMATION',
    status notification_status_enum NOT NULL DEFAULT 'UNREAD',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_role user_role_enum,            -- RBAC target role (e.g. CHECKER)
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_url VARCHAR(500),
    metadata JSONB DEFAULT '{}'::jsonb,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 4. INVESTMENTS & MAKER-CHECKER TRANSACTIONS (Rule 8, 9: Maker-Checker Dual Control)
CREATE TYPE investment_status_enum AS ENUM (
    'DRAFT',
    'PENDING_CHECKER',
    'APPROVED',
    'REJECTED',
    'SETTLED',
    'CANCELLED'
);

CREATE TABLE IF NOT EXISTS investment_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(50) NOT NULL UNIQUE,
    investment_type VARCHAR(100) NOT NULL,
    issuer_name VARCHAR(255) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    expected_yield NUMERIC(5, 2) NOT NULL,
    tenor_months INT NOT NULL,
    purpose TEXT,
    status investment_status_enum NOT NULL DEFAULT 'PENDING_CHECKER',
    
    -- Maker details
    maker_id UUID NOT NULL REFERENCES users(id),
    maker_notes TEXT,
    maker_submitted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Checker details (Enforce Segregation of Duties: checker_id != maker_id)
    checker_id UUID REFERENCES users(id),
    checker_action_notes TEXT,
    checker_stepup_verified BOOLEAN DEFAULT FALSE,
    checker_stepup_type VARCHAR(50), -- 'TOTP' or 'WEBAUTHN_PASSKEY'
    checker_decided_at TIMESTAMPTZ,
    
    CONSTRAINT chk_maker_checker_segregation CHECK (maker_id != checker_id OR checker_id IS NULL),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_ref_id ON investment_proposals(reference_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investment_proposals(status);
CREATE INDEX IF NOT EXISTS idx_investments_maker ON investment_proposals(maker_id);
CREATE INDEX IF NOT EXISTS idx_investments_checker ON investment_proposals(checker_id);

-- 5. AUDIT LOGS (Rule 7 Notification, Rule 8 Security)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'MAKER_SUBMIT', 'CHECKER_APPROVE', 'NOTIF_ACKNOWLEDGE'
    entity_name VARCHAR(100) NOT NULL, -- e.g., 'investment_proposals', 'notifications'
    entity_id VARCHAR(100) NOT NULL,
    old_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 6. TRANSACTIONAL OUTBOX TABLE (Rule 10: Resilient Notification Delivery via BullMQ)
CREATE TYPE outbox_status_enum AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status outbox_status_enum NOT NULL DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'PENDING';

