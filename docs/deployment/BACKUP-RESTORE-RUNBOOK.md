# Database Backup & Restoration Runbook
## RYCOOP Smart Finance — Operational Procedures

---

### 1. Automated Daily Backup Execution

```bash
bash scripts/backup-db.sh
```

**Actions Performed:**
1. Executes `pg_dump` on `rycoop_test_postgres` container.
2. Compresses archive with `gzip` to `/var/backups/rycoop/rycoop_db_<TIMESTAMP>.sql.gz`.
3. Computes and saves SHA256 checksum in `<ARCHIVE>.sha256`.
4. Prunes local backups older than 14 days.

---

### 2. Restoration Drill Procedure

```bash
bash scripts/restore-db.sh /var/backups/rycoop/rycoop_db_<TIMESTAMP>.sql.gz
```

**Verification Steps:**
1. Checks SHA256 hash against archive.
2. Ingests schema and data into PostgreSQL container.
3. Executes post-restore sanity query checking row counts for `users`, `notifications`, `investment_proposals`, and `audit_logs`.

