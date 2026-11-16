-- ============================================================================
-- RYCOOP Smart Finance — Seed Test Data
-- Designed exclusively for TEST Environment
-- ============================================================================

-- Insert Test Users (Maker & Checker)
INSERT INTO users (id, email, full_name, role_id, department) VALUES
('a0000000-0000-0000-0000-000000000001', 'maker.finance@rycoop.test', 'คุณสมชาย พัฒนากร (Maker)', 2, 'ฝ่ายการเงินและการลงทุน'),
('b0000000-0000-0000-0000-000000000002', 'checker.director@rycoop.test', 'คุณกมลฉัตร วงศ์วิจิตร (Checker)', 3, 'คณะกรรมการกำกับดูแลการเงิน'),
('c0000000-0000-0000-0000-000000000003', 'auditor@rycoop.test', 'ผู้ตรวจสอบบัญชีสหกรณ์ (Auditor)', 4, 'ฝ่ายตรวจสอบภายใน')
ON CONFLICT (email) DO NOTHING;

-- Insert Seed Notifications
INSERT INTO notifications (id, event_id, category, priority, status, title, message, target_role, action_url) VALUES
(
    gen_random_uuid(),
    'evt-init-bank-01',
    'NEW_BANK_DATA',
    'INFORMATION',
    'UNREAD',
    'ข้อมูลอัตราดอกเบี้ยเงินฝากธนาคารออมสินล่าสุด',
    'ธนาคารออมสินประกาศปรับอัตราดอกเบี้ยเงินฝากสหกรณ์ 12 เดือน เพิ่มขึ้น 0.20% เป็น 2.30% ต่อปี',
    'MAKER',
    '/dashboard#bank-rates'
),
(
    gen_random_uuid(),
    'evt-init-bond-02',
    'BOND_MATURITY',
    'WARNING',
    'UNREAD',
    'หุ้นกู้ บมจ. ปูนซิเมนต์ไทย (SCC26DA) ครบกำหนดใน 15 วัน',
    'ตราสารหนี้มูลค่า 30,000,000 บาท จะครบกำหนดไถ่ถอนวันที่ 30 พ.ย. 2026 กรุณาวางแผนจัดสรรสภาพคล่อง',
    'MAKER',
    '/dashboard#bonds'
),
(
    gen_random_uuid(),
    'evt-init-liq-03',
    'LOW_LIQUIDITY',
    'CRITICAL',
    'UNREAD',
    'แจ้งเตือนสภาพคล่องสำรองต่ำกว่าเกณฑ์ความปลอดภัย 6.0%',
    'อัตราส่วนสภาพคล่องสุทธิ (LCR) ลดเหลือ 5.8% จากเกณฑ์ขั้นต่ำ 6.0% แนะนำลดการปล่อยสินเชื่อระยะยาวชั่วคราว',
    'EXECUTIVE',
    '/dashboard#liquidity'
)
ON CONFLICT (event_id) DO NOTHING;

-- Insert Pending Investment Proposal for Checker review
INSERT INTO investment_proposals (
    id,
    reference_id,
    investment_type,
    issuer_name,
    amount,
    expected_yield,
    tenor_months,
    purpose,
    status,
    maker_id,
    maker_notes
) VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'INV-889102',
    'พันธบัตรรัฐบาล (LB28DA)',
    'กระทรวงการคลัง / ธนาคารแห่งประเทศไทย',
    15000000.00,
    3.25,
    36,
    'บริหารสภาพคล่องเงินกองทุนสหกรณ์และเพิ่มผลตอบแทนปลอดภัยตามระเบียบ',
    'PENDING_CHECKER',
    'a0000000-0000-0000-0000-000000000001',
    'จัดซื้อผ่านสถาบันการเงินพันธมิตรในราคาหน้าตั๋ว'
) ON CONFLICT (reference_id) DO NOTHING;

