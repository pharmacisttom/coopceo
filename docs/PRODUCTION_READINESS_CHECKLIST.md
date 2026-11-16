# รายการตรวจสอบความพร้อมก่อนขึ้นระบบจริง (Production Readiness Checklist)
## ระบบ RYCOOP Smart Finance Enterprise

> **คำเตือนสำคัญ:** ห้ามเปิดใช้งานระบบบน Production จนกว่าจะผ่านการตรวจสอบครบทุกข้อในรายการนี้ และได้รับความเห็นชอบเป็นลายลักษณ์อักษรจากคณะกรรมการสหกรณ์และหัวหน้าฝ่ายเทคโนโลยีสารสนเทศ

---

### หมวดที่ 1: โครงสร้างพื้นฐานและประสิทธิภาพ (Infrastructure & Capacity)
- [ ] รันสคริปต์ `bash scripts/vps-check.sh` และผ่านการประเมิน (CPU >= 4 Cores, RAM >= 8GB, Disk >= 40GB)
- [ ] มีการกำหนด Docker Resource Limits (Memory & CPU) ทุกคอนเทนเนอร์ เพื่อป้องกัน Memory Leak สูบแรมทั้งเครื่อง
- [ ] ทุกคอนเทนเนอร์มี Health Check configuration และทดสอบสถานะ Healthy ครบถ้วน
- [ ] ติดตั้ง SSL/TLS Certificate ที่ถูกต้อง (Let's Encrypt หรือ Commercial Cert) พร้อมเปิดใช้งาน HTTP/2
- [ ] ตรวจสอบว่าระบบทำงานแยกขาดจาก Production ของ RYCOOPWEB เดิม (Database, Storage, Port, Container Network)

---

### หมวดที่ 2: ความปลอดภัยและการพิสูจน์ตัวตน (Security & Authentication)
- [ ] เปลี่ยน Default Passwords และ Secret Keys ทั้งหมด (`JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`)
- [ ] ปิดการเปิดพอร์ต Database (5432) และ Redis (6379) ออกสู่สาธารณะ ให้เข้าถึงได้เฉพาะผ่าน Docker Network
- [ ] ติดตั้ง Google OpenID Connect และทดสอบ Login ด้วยอีเมลโดเมนสหกรณ์เท่านั้น
- [ ] เปิดใช้งาน WebAuthn / Passkey และ TOTP 2FA สำหรับบัญชีผู้ดูแลและ Checker
- [ ] ทดสอบ Step-Up 2FA ในรายการลงทุนมูลค่าเกินเกณฑ์กำหนด
- [ ] ตรวจสอบความปลอดภัยของคุกกี้: มีแฟล็ก `Secure; HttpOnly; SameSite=Strict` ครบถ้วน
- [ ] ติดตั้ง HTTP Security Headers (HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff)

---

### หมวดที่ 3: ระบบ SweetAlert2 และ UI/UX
- [ ] ล็อกเวอร์ชัน SweetAlert2 คงที่ใน `package.json` (`sweetalert2@11.17.2`)
- [ ] ทดสอบการแสดงผลบน Desktop (1920x1080), Tablet (iPad 1024x768) และ Mobile (iPhone/Android 390x844)
- [ ] ทดสอบการทำงานของ Focus Trap, ปุ่ม ESC, และ Screen Reader (ARIA Labels ภาษาไทย)
- [ ] ตรวจสอบ z-index ของโมดอล (`.rycoop-swal-container`) ไม่ถูก Navbar หรือ Dropdown บัง
- [ ] ยืนยันว่า **Modal ยืนยันธุรกรรมสำคัญห้ามปิดได้ (Non-dismissible)** ระหว่างที่กำลังบันทึกข้อมูล
- [ ] ยืนยันว่าไม่มีจุดใดใน Frontend ที่ถือว่าการกด Confirm เป็นการอนุมัติขั้นสุดท้ายโดยไม่ผ่าน Backend

---

### หมวดที่ 4: ระบบการแจ้งเตือน (Real-time Notification System)
- [ ] ทดสอบการเชื่อมต่อ SSE สตรีมเสถียร ไม่หลุด มีการส่ง Heartbeat ทุก 15 วินาที
- [ ] ทดสอบการ Reconnect อัตโนมัติเมื่อสัญญาณเครือข่ายขัดข้อง
- [ ] ทดสอบระบบป้องกันเหตุการณ์ซ้ำซ้อน (Event Deduplication)
- [ ] ตรวจสอบการคัดกรองข้อมูลตามสิทธิ์ (RBAC Notification Stream)
- [ ] ตรวจสอบว่าไม่มีข้อมูลทางการเงินที่ละเอียดอ่อน (เลขบัญชีเต็ม) หลุดออกไปยังแจ้งเตือนทั่วไป
- [ ] ทดสอบการทำงานของปุ่ม "อ่านแล้ว" และ "รับทราบ (Acknowledge)" บันทึกลง PostgreSQL สำเร็จ
- [ ] ทดสอบการส่ง Notification เมื่อ Worker มีปัญหา: ธุรกรรมหลักยังคงต้องบันทึกได้ปกติ (Outbox Pattern)

---

### หมวดที่ 5: การสำรองข้อมูลและการกู้คืน (Backup & Disaster Recovery)
- [ ] ตั้ง Cron Job รันสคริปต์ `backup-db.sh` อัตโนมัติทุกวันเวลา 01:00 น.
- [ ] ดำเนินการซ้อมกู้คืนข้อมูลจริงด้วย `scripts/restore-db.sh` และผ่านการตรวจสอบ Sanity Check
- [ ] มีการจัดเก็บสำรองข้อมูลนอกสถานที่ (Off-site Backup / Cloud Storage)
- [ ] ผ่านเกณฑ์ RTO (< 30 นาที) และ RPO (< 1 ชั่วโมง)

---

### หมวดที่ 6: การอนุมัติขั้นสุดท้าย (Sign-Off & Approvals)
| บทบาท | ชื่อ-นามสกุล | วันที่ | ลายมือชื่อ / ผลการอนุมัติ |
|---|---|---|---|
| **Lead Developer** | ____________________ | ___/___/___ | [ ] ผ่านการทดสอบระดับโค้ด |
| **Security Officer** | ____________________ | ___/___/___ | [ ] ผ่านการประเมินช่องโหว่ |
| **Coop Manager / Director** | ____________________ | ___/___/___ | [ ] อนุมัติขึ้นระบบ Production |
