# RYCOOP Smart Finance — UI Alert, Real-time Notification & Infrastructure Architecture

ระบบศูนย์รวมการแจ้งเตือนธุรกรรมทางการเงินและการควบคุมแบบคู่ (Maker–Checker Dual Authorization) พัฒนาขึ้นสำหรับสหกรณ์ออมทรัพย์ระดับองค์กร

---

## สถาปัตยกรรมเทคโนโลยี (Technology Stack)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + Lucide Icons + SweetAlert2 (Locked v11.17.2)
- **Backend API:** NestJS + TypeScript + Server-Sent Events (SSE) + RxJS
- **Analytics Worker:** Python FastAPI (คำนวณ Liquidity Coverage Ratio & Bond Maturity)
- **Database & Cache:** PostgreSQL 16 + Redis 7 + BullMQ Transactional Outbox
- **Authentication & Security:** Google OpenID Connect, WebAuthn/Passkey, TOTP 2FA Step-Up
- **Infrastructure:** Docker Compose (Resource Limits & Healthchecks) + Nginx Reverse Proxy (TLS 1.3, SSE Buffering Off)

---

## สรุปการตอบโจทย์ข้อกำหนดครบทุกด้าน (Compliance Matrix)

### 1. SweetAlert2 Requirements (10 ข้อ)
1. **Centralized Alert Service:** พัฒนาที่ [`frontend/src/components/alert/alert.service.ts`](file:///D:/ceocoop/frontend/src/components/alert/alert.service.ts) และ React Hook [`frontend/src/hooks/useAlert.ts`](file:///D:/ceocoop/frontend/src/hooks/useAlert.ts) สามารถเรียกใช้ได้จากทุกหน้า
2. **Premium UI Theme:** Navy Blue (`#0B192C`, `#1E3E62`), Cyan (`#00ADB5`, `#38BDF8`), Gold (`#F1C40F`, `#D4AF37`) พร้อมรองรับ Light & Dark mode ที่ [`frontend/src/styles/sweetalert2-rycoop.css`](file:///D:/ceocoop/frontend/src/styles/sweetalert2-rycoop.css)
3. **ครบทุกประเภทโมดอล:** Success, Error, Warning, Information, Confirmation, Loading, และ Toast
4. **Responsive:** ปรับแต่ง CSS สำหรับ Desktop, Tablet และ Mobile พร้อมขนาด Touch Target >= 44px
5. **ภาษาไทยและ Accessibility:** ข้อความปุ่มมาตรฐานภาษาไทย ("ตกลง", "ยกเลิก", "รับทราบ"), รองรับ ARIA Live Regions, Screen Reader และ Focus Trap
6. **ป้องกัน Modal ซ้อนทับและ z-index:** กำหนด `z-index: 99999` และมี Singleton Guard ปิดหน้าต่างเดิมก่อนเปิดใหม่เสมอ
7. **Keyboard Navigation:** รองรับ Focus Trap, ปุ่ม ESC, และ Return Focus ไปยังปุ่มที่เปิดโมดอล
8. **ห้ามปิด Modal สำคัญระหว่างบันทึก (Rule 8):** ในฟังก์ชัน `criticalTransactionConfirm()` และ `loading()` มีการตั้งค่า `allowOutsideClick: false`, `allowEscapeKey: false` และปิดการกด Cancel ระหว่างประมวลผล
9. **Frontend Confirmation != การอนุมัติสมบูรณ์ (Rule 9):** หน้าบ้านเป็นเพียงจุดส่ง Maker Intent โดยการอนุมัติจริงต้องผ่าน Backend Maker-Checker และ Step-Up MFA
10. **Unit & E2E Testing:** เขียนชุดทดสอบครบถ้วนที่ [`tests/unit/alert.service.spec.ts`](file:///D:/ceocoop/tests/unit/alert.service.spec.ts) และ Playwright E2E ที่ [`tests/e2e/alert-notification-maker-checker.spec.ts`](file:///D:/ceocoop/tests/e2e/alert-notification-maker-checker.spec.ts)

---

### 2. Notification System (10 ข้อ)
1. **Notification Center:** พัฒนาคอมโพเนนต์ [`frontend/src/components/notification/NotificationCenter.tsx`](file:///D:/ceocoop/frontend/src/components/notification/NotificationCenter.tsx) พร้อม Bell Icon, Pulse Animation เมื่อมีรายการเร่งด่วน และ Unread Counter Badge
2. **SSE Real-time Stream:** พัฒนาที่ [`backend/src/modules/notifications/notifications.controller.ts`](file:///D:/ceocoop/backend/src/modules/notifications/notifications.controller.ts) และ [`frontend/src/hooks/useSSE.ts`](file:///D:/ceocoop/frontend/src/hooks/useSSE.ts) พร้อมระบบตัดเหตุการณ์ซ้ำซ้อน (Event Deduplication)
3. **จัดเก็บบน PostgreSQL:** ตาราง `notifications` ที่ [`database/migrations/init_schema.sql`](file:///D:/ceocoop/database/migrations/init_schema.sql)
4. **Priority Matrix:** รองรับ Information, Warning, Critical
5. **แจ้งเตือน 4 กรณีหลัก:**
   - ข้อมูลธนาคารใหม่ (`NEW_BANK_DATA`)
   - หุ้นกู้ครบกำหนด (`BOND_MATURITY`)
   - สภาพคล่องต่ำกว่าเกณฑ์ความปลอดภัย (`LOW_LIQUIDITY`)
   - รายการลงทุนรออนุมัติ (`INVESTMENT_PENDING_APPROVAL`)
6. **ควบคุมตาม Role & Permission:** Backend SSE กรองข้อมูลตามบทบาท (Maker, Checker, Executive)
7. **Audit Log:** บันทึกลงตาราง `audit_logs` ทุกครั้งที่มีการสร้าง, อ่าน หรือรับทราบรายการ
8. **การปกป้องข้อมูลการเงินที่ละเอียดอ่อน (Data Masking):** เซ็นเซอร์เลขที่บัญชีเป็น `xxx-x-xx56789-0` ก่อนส่งแจ้งเตือน
9. **การกดอ่านและรับทราบ (Acknowledge):** รองรับการกด Mark as read, Acknowledge และติดตามสถานะผ่าน API
10. **Resilient Delivery (Outbox Pattern):** แยกการแจ้งเตือนจากธุรกรรมทางการเงินด้วย `outbox_events` ป้องกันธุรกรรมสูญหายแม้ระบบแจ้งเตือนภายนอกล้มเหลว

---

### 3. Infrastructure & Security (10 ข้อ)
1. **ตรวจสอบ VPS Capacity ก่อนติดตั้ง:** สคริปต์อัตโนมัติ [`scripts/vps-check.sh`](file:///D:/ceocoop/scripts/vps-check.sh) ตรวจสอบ CPU, RAM, Disk, Port
2. **พัฒนาบน TEST Environment เท่านั้น:** คอนฟิกแยกสภาพแวดล้อมที่ [`docker/env.test.example`](file:///D:/ceocoop/docker/env.test.example)
3. **ป้องกัน Production ของ RYCOOPWEB เดิม:** แยก Container Network `rycoop_isolated_test_network` และ Volume ขาดจากเดิม 100%
4. **แยก Database, Secrets, Storage:** มี Service Account และ credentials เฉพาะของระบบ Test
5. **Docker Resource Limits & Healthchecks:** กำหนดใน [`docker/docker-compose.yml`](file:///D:/ceocoop/docker/docker-compose.yml)
6. **HTTPS & Secure Session Cookies:** Nginx TLS 1.3 พร้อมคุกกี้แฟล็ก `SameSite=Strict; Secure; HttpOnly` ที่ [`docker/nginx/nginx.conf`](file:///D:/ceocoop/docker/nginx/nginx.conf)
7. **Backup & Disaster Recovery:** สคริปต์สำรองข้อมูล [`scripts/backup-db.sh`](file:///D:/ceocoop/scripts/backup-db.sh), กู้คืนข้อมูล [`scripts/restore-db.sh`](file:///D:/ceocoop/scripts/restore-db.sh), และแผน DR [`docs/DISASTER_RECOVERY_PLAN.md`](file:///D:/ceocoop/docs/DISASTER_RECOVERY_PLAN.md)
8. **Maker–Checker & Step-Up Authentication:** ตรวจสอบสองชั้นและการยืนยันตัวตน 2FA สำหรับรายการลงทุน
9. **Backend Data Validation:** ตรวจสอบความถูกต้องของข้อมูลก่อนสร้าง Notification Event เสมอ
10. **Production Gatekeeping:** เอกสาร [`docs/PRODUCTION_READINESS_CHECKLIST.md`](file:///D:/ceocoop/docs/PRODUCTION_READINESS_CHECKLIST.md) และ [`docs/UAT_REPORT_TEMPLATE.md`](file:///D:/ceocoop/docs/UAT_REPORT_TEMPLATE.md)

---

## แผนผังโฟลเดอร์โครงการ (Directory Structure)

```
d:/ceocoop/
├── analytics-worker/           # Python FastAPI Worker (Liquidity & Bond Monitor)
│   ├── app/main.py
│   ├── requirements.txt
│   └── Dockerfile
├── backend/                    # NestJS API & Real-time SSE Engine
│   ├── src/
│   │   ├── modules/
│   │   │   ├── notifications/  # SSE Controller, Deduplication & Masking
│   │   │   ├── audit/          # Immutable Audit Log Service
│   │   │   ├── investment/     # Maker-Checker Workflow Engine
│   │   │   └── auth/           # RBAC & Step-Up 2FA Guards
│   ├── package.json
│   └── Dockerfile
├── database/                   # Database Schemas & Seeds
│   ├── migrations/init_schema.sql
│   └── seeds/seed_test_data.sql
├── docker/                     # Container Orchestration & Security
│   ├── docker-compose.yml
│   ├── env.test.example
│   └── nginx/nginx.conf        # TLS termination & SSE buffering off
├── docs/                       # Enterprise Governance & Runbooks
│   ├── RUNBOOK_SECURITY_OPS.md
│   ├── PRODUCTION_READINESS_CHECKLIST.md
│   ├── UAT_REPORT_TEMPLATE.md
│   └── DISASTER_RECOVERY_PLAN.md
├── frontend/                   # Next.js 14 Web Application
│   ├── src/
│   │   ├── app/                # App Router (Dashboard & Showcase)
│   │   ├── components/
│   │   │   ├── alert/          # Centralized SweetAlert2 Service
│   │   │   ├── notification/   # Notification Center (Bell + Unread)
│   │   │   └── investment/     # Maker & Checker UI Panels
│   │   ├── hooks/useAlert.ts, useSSE.ts
│   │   └── styles/sweetalert2-rycoop.css
│   ├── tailwind.config.js
│   └── package.json
├── scripts/                    # Automation & Maintenance Scripts
│   ├── vps-check.sh
│   ├── backup-db.sh
│   └── restore-db.sh
└── tests/                      # Testing Suites
    ├── unit/alert.service.spec.ts, sse-dedup.spec.ts
    └── e2e/alert-notification-maker-checker.spec.ts
```

---

## ขั้นตอนการติดตั้งและทดสอบ (Deployment on TEST Environment)

### 1. ตรวจสอบความพร้อมของ VPS ก่อนติดตั้ง
```bash
chmod +x scripts/*.sh
bash scripts/vps-check.sh
```

### 2. ตั้งค่าไฟล์ Environment (TEST)
```bash
cp docker/env.test.example docker/.env.test
# ปรับแต่ง Secret Keys ตามความเหมาะสม
```

### 3. สตาร์ตระบบด้วย Docker Compose
```bash
cd docker
docker compose --env-file env.test.example up -d --build
```

### 4. ตรวจสอบสถานะการทำงาน (Health Checks)
```bash
docker compose ps
docker compose logs -f nginx backend
```

### 5. เปิดทดสอบแดชบอร์ด
เข้าใช้งานที่ `https://test.rycoop.coop` หรือ `http://localhost:3000` เพื่อทดลองการทำงานของ SweetAlert2, Notification Center และ Maker-Checker แบบอินเทอร์แอคทีฟ

