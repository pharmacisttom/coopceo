# Rollback & Recovery Procedures (RC01)
## RYCOOP Smart Finance — Incident Management

---

### 1. Fast Container Rollback

If a critical deployment failure or container malfunction occurs during a release update:

```bash
# 1. Stop the TEST project containers without touching volumes
cd docker
docker compose --project-name rycoop-smart-finance-test down

# 2. Checkout the previous known-good Git tag or commit
git checkout <PREVIOUS_COMMIT_SHA>

# 3. Rebuild and restart the container stack
docker compose --project-name rycoop-smart-finance-test --env-file env.test.example up -d --build
```

---

### 2. Database State Rollback

If a bad migration or data corruption occurs:

```bash
# Locate the last known valid daily backup
LATEST_BACKUP=$(ls -t /var/backups/rycoop/rycoop_db_*.sql.gz | head -n 1)

# Execute restore script
bash scripts/restore-db.sh "$LATEST_BACKUP"
```

---

### 3. Emergency Clean Shutdown

If a security compromise or unexpected performance degradation is observed:
```bash
docker compose --project-name rycoop-smart-finance-test down
```
All persistent database state is preserved in Docker volume `rycoop_test_pgdata_vol`.

