# คู่มือการปฏิบัติการและการรักษาความปลอดภัย (Security & Operations Runbook)
## ระบบ RYCOOP Smart Finance — UI Alert, Real-time Notification & Maker-Checker

---

### 1. บทนำและขอบเขต (Overview & Scope)
เอกสารนี้เป็นคู่มือมาตรฐานการปฏิบัติการ (Standard Operating Procedure: SOP) และแนวทางการรักษาความปลอดภัยของระบบ **RYCOOP Smart Finance** สำหรับสหกรณ์ออมทรัพย์ เพื่อควบคุมสภาพแวดล้อมระบบ ตั้งแต่ระดับโครงสร้างพื้นฐาน การจัดการสิทธิ์ การแจ้งเตือนธุรกรรมแบบเรียลไทม์ ไปจนถึงการรับมือภัยคุกคามและการกู้คืนระบบ

---

### 2. สภาพแวดล้อมและการแยกส่วน (Environment Segregation)
ตามข้อกำหนดความปลอดภัยขั้นสูง:
- **TEST Environment เท่านั้น:** การพัฒนา ทดสอบ และปรับปรุงระบบทั้งหมด ต้องดำเนินการบนเครือข่ายและเครื่องแม่ข่ายทดสอบ (TEST) ห้ามเชื่อมต่อหรือแก้ไขระบบ Production ของ RYCOOPWEB เดิมโดยเด็ดขาด
- **Isolated Containers & Networks:** คอนเทนเนอร์ทั้งหมดทำงานบนเครือข่ายบริดจ์เสมือน `rycoop_isolated_test_network`
- **Secrets Management:** ไฟล์ `.env.test` และคีย์เข้ารหัสต้องเก็บแยกต่างหาก และห้ามคอมมิตลงใน Git Repository สาธารณะ

---

### 3. มาตรฐานการควบคุมธุรกรรมแบบคู่ (Maker–Checker Dual Authorization)
1. **การสร้างรายการ (Maker):**
   - เจ้าหน้าที่การเงิน (Maker) บันทึกคำขอลงทุนหรือโอนเงินผ่าน UI
   - ระบบแสดง SweetAlert2 Modal ยืนยันข้อมูลสำคัญ (Non-dismissible: ปิดไม่ได้ระหว่างประมวลผล)
   - **Frontend Confirmation ไม่ถือเป็นการอนุมัติที่สมบูรณ์** ข้อมูลจะถูกส่งไปพักไว้ที่สถานะ `PENDING_CHECKER` ในฐานข้อมูล
2. **การตรวจสอบและอนุมัติ (Checker):**
   - ผู้ตรวจสอบ (Checker) ได้รับแจ้งเตือนแบบเรียลไทม์ผ่าน SSE
   - ก่อนอนุมัติ Checker ต้องผ่านการยืนยันตัวตนระดับสูง **Step-Up Authentication (WebAuthn/Passkey หรือ TOTP 6 หลัก)**
   - ระบบฝั่ง Backend บังคับใช้เงื่อนไข `maker_id != checker_id` เสมอ เพื่อป้องกัน Maker อนุมัติรายการของตนเอง

---

### 4. มาตรการจัดการ Real-time Notification & SSE
1. **Event Deduplication:** ทุก Notification มี `eventId` เฉพาะ (UUID/Hash) หากระบบหรือเบราว์เซอร์ได้รับ `eventId` เดิมซ้ำภายใน 10 นาที ระบบจะ Drop ทิ้งอัตโนมัติ เพื่อป้องกันการแสดง Alert ซ้ำซ้อน
2. **Data Masking:** ห้ามเปิดเผยข้อมูลเลขที่บัญชีเต็ม ยอดเงินที่ละเอียดอ่อน หรือข้อมูลระบุตัวบุคคลผ่าน Push Notification ของระบบปฏิบัติการ โดยระบบ Backend จะ Mask เป็น `xxx-x-xx56789-0` เสมอ
3. **Resilient Delivery (Transactional Outbox):**
   - การบันทึกธุรกรรมการเงินและการสร้าง Notification ทำงานแบบ Decoupled
   - บันทึกลงตาราง `outbox_events` พร้อมกับธุรกรรมทางการเงิน
   - แม้ระบบแจ้งเตือนหรือเครือข่ายภายนอกขัดข้อง ธุรกรรมทางการเงินจะไม่สูญหายและไม่ถูก Rollback โดย BullMQ Worker จะ Retry ส่งให้อัตโนมัติ

---

### 5. แนวทางรับมือเหตุการณ์ฉุกเฉิน (Incident Response Matrix)

| สถานการณ์ | ระดับความรุนแรง | การวิเคราะห์สาเหตุ | ขั้นตอนการแก้ไข |
|---|---|---|---|
| **SSE Reconnection ล้มเหลวต่อเนื่อง** | Warning | Nginx Buffer ปิดไม่สมบูรณ์ หรือเครือข่ายหลุด | ตรวจสอบคำสั่ง `proxy_buffering off;` ใน Nginx และรัน `docker restart rycoop_test_backend` |
| **สภาพคล่องต่ำกว่าเกณฑ์วิกฤต (<6%)** | Critical | สมาชิกลดเงินฝากหรือปล่อยกู้เกินเกณฑ์ | ระบบแจ้งเตือนระดับสีแดง ผู้บริหารเรียกประชุมด่วนเพื่อจัดสรรเงินกู้ยืมระหว่างสหกรณ์ |
| **Maker พยายาม Bypass Frontend Confirmation** | Critical | มีการส่งคำขอตรงเข้า API | Backend RBAC Guard และ Step-Up Guard ปฏิเสธคำขอ (HTTP 403) และบันทึก IP ลง `audit_logs` |
| **ฐานข้อมูล PostgreSQL Disk เต็ม** | Critical | ไฟล์ WAL หรือ Backup สะสม | รัน `bash scripts/backup-db.sh` นำไฟล์ไป Offsite แล้วลบไฟล์ที่เกิน 14 วัน |

---

### 6. การตรวจสอบและบำรุงรักษาประจำวัน (Daily Operations Checklist)
1. ตรวจสอบสถานะคอนเทนเนอร์: `docker compose ps` (ทุกตัวต้อง Healthy)
2. ตรวจสอบบันทึกความปลอดภัย: `SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours';`
3. ตรวจสอบคิว Outbox ที่ตกค้าง: `SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING';`
4. ยืนยันสถานะ Backup ประจำวันใน `/var/backups/rycoop/`
